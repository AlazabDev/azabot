/**
 * AzaBot — Chat v1 (مهجورة)
 * يُعيد توجيه الطلبات إلى chat-v2
 * ─────────────────────────────────────────────────────────
 * احتفظ بهذا الملف للتوافق مع الإصدارات القديمة
 */

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.warn("[chat-v1] Deprecated — use chat-v2 instead");

  // أعد توجيه الطلب لـ chat-v2
  const v2Url = req.url.replace("/chat", "/chat-v2");
  return fetch(v2Url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });
});
