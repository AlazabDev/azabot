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

async function foundryFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${getBase()}${V1_PATH}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    // Log server-side; do not leak provider details to the client.
    console.error(`[Foundry] ${res.status} ${path}: ${text.slice(0, 1000)}`);
    throw new Error(GENERIC_CHAT_ERROR);
  }
  return (await res.json()) as T;
}

interface ResponsesResult {
  output_text?: string;
  output?: Array<{
    type?: string;
    phase?: string;
    role?: string;
    content?: Array<{ type?: string; text?: string | { value?: string } }>;
  }>;
}

function extractText(res: ResponsesResult): string {
  if (typeof res.output_text === "string" && res.output_text.trim()) {
    return res.output_text.trim();
  }
  const items = (res.output ?? []).filter(
    (i) => i.role === "assistant" || i.type === "message",
  );
  const finals = items.filter((i) => i.phase === "final_answer");
  const parts: string[] = [];
  for (const item of finals.length ? finals : items) {
    for (const c of item.content ?? []) {
      if (typeof c.text === "string") parts.push(c.text);
      else if (c.text?.value) parts.push(c.text.value);
    }
  }
  return parts.join("\n").trim();
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
      const agentName = process.env.FOUNDRY_AGENT_ID;
      if (!agentName) throw new Error("FOUNDRY_AGENT_ID is not configured");
      const agentVersion = process.env.FOUNDRY_AGENT_VERSION || "1";

      // 1) Build the user message content parts.
      const contentParts: Array<Record<string, unknown>> = [];
      const fileList: string[] = [];
      for (const att of data.attachments ?? []) {
        if (att.type.startsWith("image/")) {
          contentParts.push({ type: "input_image", image_url: att.url });
        } else {
          fileList.push(`- ${att.name}: ${att.url}`);
        }
      }
      const text =
        (data.message || "") +
        (fileList.length ? `\n\nالمرفقات:\n${fileList.join("\n")}` : "");
      contentParts.unshift({ type: "input_text", text: text || "..." });

      const userItem = {
        type: "message",
        role: "user",
        content: contentParts,
      };

      // 2) Ensure a conversation — verify the caller's signed token or mint a new one.
      let conversationId: string | null = data.threadId
        ? verifyThreadToken(data.threadId)
        : null;
      let itemsSent = false;

      if (!conversationId) {
        const conv = await foundryFetch<{ id: string }>("/conversations", {
          method: "POST",
          body: JSON.stringify({ items: [userItem] }),
        });
        conversationId = conv.id;
        itemsSent = true;
      }

      // 3) Generate the agent response for this conversation.
      const body: Record<string, unknown> = {
        conversation: conversationId,
        agent_reference: {
          type: "agent_reference",
          name: agentName,
          version: agentVersion,
        },
      };

      if (!itemsSent) body.input = [userItem];

      const result = await foundryFetch<ResponsesResult>("/responses", {
        method: "POST",
        body: JSON.stringify(body),
      });

      return { threadId: signThreadId(conversationId), reply: extractText(result) };
    } catch (err) {
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
