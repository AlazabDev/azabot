/**
 * AzaBot — Central Configuration
 * لا قيم مكتوبة مباشرة في الكود — كلها من .env
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (import.meta.env.DEV && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  console.error("[AzaBot] تحقق من ملف .env — VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY مطلوبان.");
}

export const CONFIG = {
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  },

  api: {
    // دائماً chat-v2 (multi-site + rate limiting + Claude/Gemini)
    chat: `${SUPABASE_URL}/functions/v1/chat-v2`,
    tts: `${SUPABASE_URL}/functions/v1/elevenlabs-tts`,
    stt: `${SUPABASE_URL}/functions/v1/elevenlabs-stt`,
  },

  chat: {
    maxAttachments: 5,
    maxFileSizeMB: 10,
    maxContextMessages: 20,
    sendCooldownMs: 500,
    allowedFileTypes: [
      "image/*",
      "application/pdf",
      ".doc,.docx",
      ".xls,.xlsx",
      ".txt,.csv",
    ],
  },

  /** معرف الموقع — يُكشف من env أو النطاق */
  siteId: (import.meta.env.VITE_SITE_ID as string | undefined) || undefined,
} as const;

/** Headers مشتركة لجميع طلبات Supabase */
export function getAuthHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}
