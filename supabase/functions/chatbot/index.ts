import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const API_VERSION = Deno.env.get("FOUNDRY_API_VERSION") ?? "2024-12-01-preview";
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_ATTACHMENTS = 10;
const THREAD_TTL_DAYS = 30;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getFoundryBase(): string {
  return requireEnv("FOUNDRY_PROJECT_ENDPOINT").replace(/\/+$/, "");
}

function foundryHeaders(): HeadersInit {
  const key = requireEnv("FOUNDRY_API_KEY");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "api-key": key,
  };
}

async function hmacHex(value: string): Promise<string> {
  const secret = new TextEncoder().encode(
    Deno.env.get("THREAD_SIGNING_SECRET") ?? requireEnv("FOUNDRY_API_KEY"),
  );
  const data = new TextEncoder().encode(value);
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  return Array.from(signature, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function signThreadId(threadId: string): Promise<string> {
  return `${threadId}.${await hmacHex(threadId)}`;
}

async function verifyThreadToken(token: string): Promise<string | null> {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const threadId = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(threadId)) return null;
  if (!/^[a-f0-9]{64}$/.test(signature)) return null;

  const expected = await hmacHex(threadId);
  const a = new TextEncoder().encode(signature);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return null;

  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0 ? threadId : null;
}

async function foundryFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${getFoundryBase()}${path}${separator}api-version=${API_VERSION}`;
  const response = await fetch(url, {
    ...init,
    headers: { ...foundryHeaders(), ...(init.headers ?? {}) },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[chatbot] Foundry ${response.status}: ${text.slice(0, 1000)}`);
    throw new Error("UPSTREAM_ERROR");
  }

  return (await response.json()) as T;
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate.url === "string" &&
        typeof candidate.name === "string" &&
        typeof candidate.type === "string"
      );
    })
    .slice(0, MAX_ATTACHMENTS)
    .map((item) => {
      const candidate = item as Record<string, string>;
      return {
        url: candidate.url.slice(0, 2_000),
        name: candidate.name.slice(0, 255),
        type: candidate.type.slice(0, 128),
      };
    });
}

async function createThread() {
  const thread = await foundryFetch<{ id?: string }>("/threads", {
    method: "POST",
    body: JSON.stringify({}),
  });

  if (!thread.id) throw new Error("UPSTREAM_ERROR");
  return thread.id;
}

async function runChat(input: {
  message: string;
  threadToken?: string | null;
  attachments: ReturnType<typeof normalizeAttachments>;
}) {
  const agentId = requireEnv("FOUNDRY_AGENT_ID");

  let threadId = input.threadToken
    ? await verifyThreadToken(input.threadToken)
    : null;

  if (!threadId) threadId = await createThread();

  const content: Array<Record<string, unknown>> = [];
  if (input.message) content.push({ type: "text", text: input.message });

  const fileLinks: string[] = [];
  for (const attachment of input.attachments) {
    if (attachment.type.startsWith("image/")) {
      content.push({
        type: "image_url",
        image_url: { url: attachment.url, detail: "auto" },
      });
    } else {
      fileLinks.push(`- ${attachment.name}: ${attachment.url}`);
    }
  }

  if (fileLinks.length) {
    content.push({
      type: "text",
      text: `\nالمرفقات:\n${fileLinks.join("\n")}`,
    });
  }

  if (!content.length) content.push({ type: "text", text: "" });

  await foundryFetch(`/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ role: "user", content }),
  });

  const run = await foundryFetch<{ id?: string; status?: string }>(
    `/threads/${threadId}/runs`,
    {
      method: "POST",
      body: JSON.stringify({ assistant_id: agentId }),
    },
  );

  if (!run.id) throw new Error("UPSTREAM_ERROR");

  const startedAt = Date.now();
  let status = run.status ?? "queued";

  while (
    !["completed", "failed", "cancelled", "expired"].includes(status) &&
    Date.now() - startedAt < 90_000
  ) {
    await new Promise((resolve) => setTimeout(resolve, 900));

    const current = await foundryFetch<{
      id?: string;
      status?: string;
      last_error?: { message?: string };
    }>(`/threads/${threadId}/runs/${run.id}`);

    status = current.status ?? status;
    if (status === "failed") {
      console.error(`[chatbot] run failed: ${current.last_error?.message ?? "unknown"}`);
    }
  }

  if (status !== "completed") {
    console.error(`[chatbot] run ended with status: ${status}`);
    throw new Error("UPSTREAM_ERROR");
  }

  const messages = await foundryFetch<{
    data?: Array<{
      role?: string;
      created_at?: number;
      content?: Array<{ type?: string; text?: { value?: string } }>;
    }>;
  }>(`/threads/${threadId}/messages?limit=10&order=desc`);

  const assistant = messages.data?.find((item) => item.role === "assistant");
  const reply =
    assistant?.content
      ?.filter((part) => part.type === "text")
      .map((part) => part.text?.value ?? "")
      .join("\n")
      .trim() ?? "";

  return {
    threadId: await signThreadId(threadId),
    reply: reply || "تعذر الحصول على رد حالياً، يرجى المحاولة مرة أخرى.",
    expiresInDays: THREAD_TTL_DAYS,
  };
}

async function handle(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (request.method === "GET") {
    return json({ ok: true, service: "chatbot", version: 1 });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!body || typeof body !== "object") {
    return json({ error: "Invalid request body" }, 400);
  }

  const data = body as Record<string, unknown>;
  const message = typeof data.message === "string" ? data.message.trim() : "";

  if (!message && !Array.isArray(data.attachments)) {
    return json({ error: "message is required" }, 400);
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return json({ error: `message exceeds ${MAX_MESSAGE_LENGTH} characters` }, 413);
  }

  const threadToken =
    typeof data.threadId === "string" && data.threadId.length <= 512
      ? data.threadId
      : null;

  try {
    const result = await runChat({
      message,
      threadToken,
      attachments: normalizeAttachments(data.attachments),
    });
    return json(result);
  } catch (error) {
    console.error("[chatbot] request failed:", error);
    return json(
      { error: "تعذر معالجة الطلب حالياً، يرجى المحاولة لاحقاً." },
      500,
    );
  }
}

Deno.serve(handle);
