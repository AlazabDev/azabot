import { createServerFn } from "@tanstack/react-start";

const API_VERSION = "2024-12-01-preview";
const REALTIME_API_VERSION = "2025-04-01-preview";

interface FoundryAttachment {
  url: string;
  name: string;
  type: string;
}

interface FoundryChatInput {
  threadId?: string | null;
  message: string;
  attachments?: FoundryAttachment[];
  systemPrompt?: string;
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
    throw new Error(`Foundry ${res.status}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

export const foundryChat = createServerFn({ method: "POST" })
  .inputValidator((data: FoundryChatInput) => data)
  .handler(async ({ data }) => {
    const agentId = process.env.FOUNDRY_AGENT_ID;
    if (!agentId) throw new Error("FOUNDRY_AGENT_ID is not configured");

    // 1) Ensure thread
    let threadId = data.threadId || null;
    if (!threadId) {
      const thread = await foundryFetch<{ id: string }>("/threads", {
        method: "POST",
        body: JSON.stringify({}),
      });
      threadId = thread.id;
    }

    // 2) Build message content (text + optional image_url parts)
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

    // 3) Create run
    const runBody: Record<string, unknown> = { assistant_id: agentId };
    if (data.systemPrompt) {
      runBody.instructions = data.systemPrompt;
    }
    const run = await foundryFetch<{ id: string; status: string }>(
      `/threads/${threadId}/runs`,
      { method: "POST", body: JSON.stringify(runBody) },
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
      const s = await foundryFetch<{ status: string; id: string; last_error?: { message?: string } }>(
        `/threads/${threadId}/runs/${runId}`,
      );
      status = s.status;
      runId = s.id;
      if (status === "failed") {
        throw new Error(s.last_error?.message || "Foundry run failed");
      }
    }

    if (status !== "completed") {
      throw new Error(`Foundry run status: ${status}`);
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

    return { threadId, reply };
  });

/**
 * Mint an ephemeral Realtime session for the browser WebRTC/WS client.
 * Returns the raw provider payload; the client uses client_secret.value.
 */
export const foundryRealtimeSession = createServerFn({ method: "POST" })
  .inputValidator((data: { voice?: string; instructions?: string }) => data)
  .handler(async ({ data }) => {
    const deployment = process.env.FOUNDRY_REALTIME_DEPLOYMENT;
    if (!deployment) throw new Error("FOUNDRY_REALTIME_DEPLOYMENT is not configured");

    const base = getBase();
    const url = `${base}/openai/realtimeapi/sessions?api-version=${REALTIME_API_VERSION}`;
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        model: deployment,
        voice: data.voice || "alloy",
        instructions:
          data.instructions ||
          "You are Azab Assistant. Respond concisely in the user's language (Arabic or English).",
      }),
    });
    if (!res.ok) {
      throw new Error(`Foundry Realtime ${res.status}: ${(await res.text()).slice(0, 400)}`);
    }
    return (await res.json()) as {
      client_secret?: { value: string; expires_at: number };
      id?: string;
      webrtc_url?: string;
    };
  });
