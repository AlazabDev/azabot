import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHmac, timingSafeEqual } from "crypto";

/** Azure AI Foundry v1 (conversations + responses) surface. */
const V1_PATH = "/openai/v1";
const REALTIME_API_VERSION = "2025-04-01-preview";

const GENERIC_CHAT_ERROR = "تعذر معالجة الطلب حالياً، يرجى المحاولة لاحقاً.";

interface FoundryAttachment {
  url: string;
  name: string;
  type: string;
}

interface FoundryChatInput {
  threadId?: string | null;
  message: string;
  attachments?: FoundryAttachment[];
  /** Optional bot_agents.id to route the message to a specific agent. */
  agentId?: string | null;
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

function safeAttachmentUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) return null;
    const allowed = new URL(supabaseUrl);

    if (url.protocol !== "https:" || url.host !== allowed.host) return null;
    if (!url.pathname.startsWith("/storage/v1/object/sign/chatbot-uploads/")) return null;

    return url.toString();
  } catch {
    return null;
  }
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

// [content omitted in update request generation]
