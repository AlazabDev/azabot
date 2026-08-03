import { createServerFn } from "@tanstack/react-start";
import { createHmac, timingSafeEqual } from "crypto";

/** Azure AI Foundry v1 (conversations + responses) surface. */
const V1_PATH = "/openai/v1";
const REALTIME_API_VERSION = "2025-04-01-preview";

const GENERIC_CHAT_ERROR = "تعذر معالجة الطلب حالياً، يرجى المحاولة لاحقاً.";
const GENERIC_REALTIME_ERROR = "تعذر بدء المكالمة الصوتية حالياً، يرجى المحاولة لاحقاً.";


interface FoundryAttachment {
  url: string;
  name: string;
  type: string;
}

interface FoundryChatInput {
  threadId?: string | null;
  message: string;
  attachments?: FoundryAttachment[];
}

function getBase(): string {
  const base = process.env.FOUNDRY_PROJECT_ENDPOINT;
  if (!base) throw new Error("FOUNDRY_PROJECT_ENDPOINT is not configured");
  return base.replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const key = process.env.FOUNDRY_API_KEY;
  if (!key) throw new Error("FOUNDRY_API_KEY is not configured");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "api-key": key,
  };
}

function getSigningSecret(): string {
  const secret =
    process.env.THREAD_SIGNING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.FOUNDRY_API_KEY;
  if (!secret) throw new Error("Missing signing secret");
  return secret;
}

function signThreadId(threadId: string): string {
  const sig = createHmac("sha256", getSigningSecret()).update(threadId).digest("hex");
  return `${threadId}.${sig}`;
}

function verifyThreadToken(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const id = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!id || !sig) return null;
  const expected = createHmac("sha256", getSigningSecret()).update(id).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? id : null;
  } catch {
    return null;
  }
}

async function foundryFetch<T>(
  path: string,
  init: RequestInit = {},
  version = API_VERSION,
): Promise<T> {
  const base = getBase();
  const sep = path.includes("?") ? "&" : "?";
  const url = `${base}${path}${sep}api-version=${version}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    // Log server-side; do not leak to client.
    console.error(`[Foundry] ${res.status} ${path}: ${text.slice(0, 1000)}`);
    throw new Error(GENERIC_CHAT_ERROR);
  }
  return (await res.json()) as T;
}

export const foundryChat = createServerFn({ method: "POST" })
  .inputValidator((data: FoundryChatInput) => {
    if (!data || typeof data.message !== "string") {
      throw new Error("Invalid input");
    }
    return {
      threadId: typeof data.threadId === "string" ? data.threadId : null,
      message: data.message.slice(0, 8000),
      attachments: Array.isArray(data.attachments)
        ? data.attachments
            .filter(
              (a) =>
                a &&
                typeof a.url === "string" &&
                typeof a.name === "string" &&
                typeof a.type === "string",
            )
            .slice(0, 10)
        : [],
    } satisfies FoundryChatInput;
  })
  .handler(async ({ data }) => {
    try {
      const agentId = process.env.FOUNDRY_AGENT_ID;
      if (!agentId) throw new Error("FOUNDRY_AGENT_ID is not configured");

      // 1) Ensure thread — verify the caller's token or mint a new one.
      let threadId: string | null = null;
      if (data.threadId) {
        threadId = verifyThreadToken(data.threadId);
        if (!threadId) {
          // Unknown / forged / legacy token — start a fresh thread instead of trusting it.
          threadId = null;
        }
      }
      if (!threadId) {
        const thread = await foundryFetch<{ id: string }>("/threads", {
          method: "POST",
          body: JSON.stringify({}),
        });
        threadId = thread.id;
      }

      // 2) Build message content
      const contentParts: Array<Record<string, unknown>> = [];
      if (data.message) {
        contentParts.push({ type: "text", text: data.message });
      }
      const fileList: string[] = [];
      for (const att of data.attachments ?? []) {
        if (att.type.startsWith("image/")) {
          contentParts.push({
            type: "image_url",
            image_url: { url: att.url, detail: "auto" },
          });
        } else {
          fileList.push(`- ${att.name}: ${att.url}`);
        }
      }
      if (fileList.length) {
        contentParts.push({
          type: "text",
          text: `\n\nالمرفقات:\n${fileList.join("\n")}`,
        });
      }
      if (contentParts.length === 0) {
        contentParts.push({ type: "text", text: "" });
      }

      await foundryFetch(`/threads/${threadId}/messages`, {
        method: "POST",
        body: JSON.stringify({ role: "user", content: contentParts }),
      });

      // 3) Create run — instructions are always server-defined (never from the client).
      const run = await foundryFetch<{ id: string; status: string }>(
        `/threads/${threadId}/runs`,
        { method: "POST", body: JSON.stringify({ assistant_id: agentId }) },
      );

      // 4) Poll run
      const start = Date.now();
      let status = run.status;
      let runId = run.id;
      while (
        status !== "completed" &&
        status !== "failed" &&
        status !== "cancelled" &&
        status !== "expired" &&
        Date.now() - start < 90_000
      ) {
        await new Promise((r) => setTimeout(r, 900));
        const s = await foundryFetch<{
          status: string;
          id: string;
          last_error?: { message?: string };
        }>(`/threads/${threadId}/runs/${runId}`);
        status = s.status;
        runId = s.id;
        if (status === "failed") {
          console.error(`[Foundry] run failed: ${s.last_error?.message ?? "unknown"}`);
          throw new Error(GENERIC_CHAT_ERROR);
        }
      }

      if (status !== "completed") {
        console.error(`[Foundry] run status: ${status}`);
        throw new Error(GENERIC_CHAT_ERROR);
      }

      // 5) Fetch latest assistant message
      const list = await foundryFetch<{
        data: Array<{
          role: string;
          content: Array<{ type: string; text?: { value: string } }>;
        }>;
      }>(`/threads/${threadId}/messages?limit=5&order=desc`);

      const assistant = list.data.find((m) => m.role === "assistant");
      let reply = "";
      if (assistant) {
        reply = assistant.content
          .map((c) => (c.type === "text" ? c.text?.value ?? "" : ""))
          .join("\n")
          .trim();
      }

      return { threadId: signThreadId(threadId!), reply };
    } catch (err) {
      // Any unexpected error path: log server-side, return generic error to client.
      if (err instanceof Error && err.message === GENERIC_CHAT_ERROR) throw err;
      console.error("[Foundry] chat error:", err);
      throw new Error(GENERIC_CHAT_ERROR);
    }
  });

/**
 * Mint an ephemeral Realtime session for the browser WebRTC/WS client.
 * Instructions/voice are server-defined; the client cannot override them.
 */
export const foundryRealtimeSession = createServerFn({ method: "POST" })
  .inputValidator((_: unknown) => ({}))
  .handler(async () => {
    try {
      const deployment = process.env.FOUNDRY_REALTIME_DEPLOYMENT;
      if (!deployment) throw new Error("FOUNDRY_REALTIME_DEPLOYMENT is not configured");

      const base = getBase();
      const url = `${base}/openai/realtimeapi/sessions?api-version=${REALTIME_API_VERSION}`;
      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          model: deployment,
          voice: "alloy",
          instructions:
            "You are Azab Assistant. Respond concisely in the user's language (Arabic or English).",
        }),
      });
      if (!res.ok) {
        console.error(
          `[Foundry] realtime ${res.status}: ${(await res.text()).slice(0, 1000)}`,
        );
        throw new Error(GENERIC_REALTIME_ERROR);
      }
      return (await res.json()) as {
        client_secret?: { value: string; expires_at: number };
        id?: string;
        webrtc_url?: string;
      };
    } catch (err) {
      if (err instanceof Error && err.message === GENERIC_REALTIME_ERROR) throw err;
      console.error("[Foundry] realtime error:", err);
      throw new Error(GENERIC_REALTIME_ERROR);
    }
  });
