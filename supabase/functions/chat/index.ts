import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

interface Integration {
  id: string;
  type: "webhook" | "telegram" | "whatsapp" | "twilio" | string;
  name: string;
  enabled: boolean;
  events: string[];
  config: Record<string, string>;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, session_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const { data: settings } = await supabase
      .from("bot_settings").select("*").eq("id", 1).single();

    const engine = settings?.engine || "lovable";
    const model = settings?.ai_model || "google/gemini-2.5-flash";
    const systemContent = settings?.system_prompt ||
      "أنت AzaBot، مساعد ذكي ودود يتحدث بالعربية الفصحى السهلة افتراضياً.";

    // Business hours check
    if (settings?.business_hours_enabled) {
      const bh = settings.business_hours || {};
      const now = new Date();
      const day = now.getDay();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const inDays = (bh.days || []).includes(day);
      const inHours = time >= (bh.start || "00:00") && time <= (bh.end || "23:59");
      if (!inDays || !inHours) {
        const offline = settings.offline_message || "نحن خارج ساعات العمل.";
        return sseStatic(offline);
      }
    }

    // Persist conversation + last user message
    let conversationId: string | null = null;
    let humanTakeover = false;
    const lastUser = [...messages].reverse().find((m: { role: string; content: string }) => m.role === "user");
    if (session_id) {
      try {
        const { data: existing } = await supabase
          .from("conversations").select("id, human_takeover").eq("session_id", session_id).maybeSingle();
        if (existing) {
          conversationId = existing.id;
          humanTakeover = !!existing.human_takeover;
        } else {
          const { data: created } = await supabase
            .from("conversations").insert({ session_id, metadata: {} }).select("id, human_takeover").single();
          conversationId = created?.id || null;
          if (conversationId) await dispatchAll("conversation.started", { session_id, conversation_id: conversationId });
        }
        if (conversationId && lastUser) {
          await supabase.from("messages").insert({
            conversation_id: conversationId, role: "user", content: lastUser.content,
          });
          dispatchAll("message.created", {
            conversation_id: conversationId, session_id,
            role: "user", content: lastUser.content,
          }).catch(() => {});
        }
      } catch (e) { console.error("persist error:", e); }
    }

    // If human took over → don't auto-reply
    if (humanTakeover) {
      return sseStatic("⏳ تم تحويل المحادثة لموظف بشري. سيرد عليك في أقرب وقت.");
    }

    // ─── Engine: RASA ──────────────────────────────────────
    if (engine === "rasa") {
      const rasaUrl = String(settings?.rasa_url || "").trim();
      if (!rasaUrl) {
        await logRasa("error", null, "rasa.send", { session_id, message: lastUser?.content }, null, "", "rasa_url غير معرّف");
        return sseStatic("⚠️ لم يتم ضبط رابط سيرفر Rasa من لوحة الإدارة.");
      }
      const startedAt = Date.now();
      const target = rasaUrl.replace(/\/$/, "") + "/webhooks/rest/webhook";
      const timeout = Number(settings?.rasa_timeout_ms || 15000);
      const reqPayload = { sender: session_id || "anonymous", message: lastUser?.content || "" };
      try {
        const res = await fetch(target, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqPayload),
          signal: AbortSignal.timeout(timeout),
        });
        const respText = await res.text();
        if (!res.ok) {
          console.error("Rasa error:", res.status, respText);
          await logRasa("failed", res.status, "rasa.send", { ...reqPayload, target, duration_ms: Date.now() - startedAt }, respText.slice(0, 2000), `HTTP ${res.status}`);
          return sseStatic(`⚠️ خطأ في الاتصال بسيرفر Rasa (${res.status}).`);
        }
        let arr: unknown = [];
        try { arr = JSON.parse(respText); } catch { /* ignore */ }
        const fullText = (Array.isArray(arr) ? arr : [])
          .map((m: { text?: string }) => m.text).filter(Boolean).join("\n\n") || "…";

        await logRasa("success", res.status, "rasa.send", { ...reqPayload, target, duration_ms: Date.now() - startedAt }, respText.slice(0, 2000), "");

        if (conversationId) {
          await supabase.from("messages").insert({
            conversation_id: conversationId, role: "assistant", content: fullText,
          });
          dispatchAll("message.created", {
            conversation_id: conversationId, session_id,
            role: "assistant", content: fullText,
          }).catch(() => {});
        }
        return sseStatic(fullText);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown";
        console.error("Rasa fetch failed:", e);
        await logRasa("failed", null, "rasa.send", { ...reqPayload, target, duration_ms: Date.now() - startedAt }, "", msg);
        return sseStatic(`⚠️ تعذر الاتصال بسيرفر Rasa: ${msg}`);
      }
    }

    async function logRasa(
      status: string, statusCode: number | null, event: string,
      payload: Record<string, unknown>, responseBody: string, errorMessage: string,
    ) {
      try {
        await supabase.from("webhook_logs").insert({
          integration_id: null, integration_type: "rasa",
          event, status, status_code: statusCode,
          request_payload: payload, response_body: responseBody, error_message: errorMessage,
        });
      } catch (e) { console.error("logRasa failed:", e); }
    }

    // ─── Engine: LOVABLE AI (default) ──────────────────────
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemContent }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return errJson("تم تجاوز حد الطلبات، حاول لاحقاً.", 429);
      if (response.status === 402) return errJson("الرصيد غير كافٍ. يرجى إضافة رصيد لمساحة العمل.", 402);
      console.error("AI error:", response.status, await response.text());
      return errJson("AI gateway error", 500);
    }

    const [toClient, toCapture] = response.body!.tee();
    captureAssistantReply(toCapture, conversationId, session_id).catch(() => {});

    return new Response(toClient, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return errJson(e instanceof Error ? e.message : "Unknown", 500);
  }
});

function sseStatic(text: string) {
  // Stream text chunked so client typing indicator behaves naturally
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const chunks = text.match(/.{1,40}/gs) || [text];
      for (const c of chunks) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`));
      }
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
}

function errJson(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function captureAssistantReply(
  stream: ReadableStream<Uint8Array>,
  conversationId: string | null,
  sessionId: string | undefined,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let full = "", buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) full += delta;
      } catch (_e) { /* skip malformed SSE JSON chunk */ }
    }
  }
  if (full && conversationId) {
    await supabase.from("messages").insert({
      conversation_id: conversationId, role: "assistant", content: full,
    });
    dispatchAll("message.created", {
      conversation_id: conversationId, session_id: sessionId,
      role: "assistant", content: full,
    }).catch((_e) => { /* fire-and-forget — errors intentionally swallowed */ });
  }
}

async function dispatchAll(event: string, payload: Record<string, unknown>) {
  const { data: integs } = await supabase.from("integrations")
    .select("*").eq("enabled", true);
  if (!integs?.length) return;
  for (const integ of integs) {
    if (!(integ.events || []).includes(event)) continue;
    fireOne(integ, event, payload).catch(() => {});
  }
}

async function fireOne(integ: Integration, event: string, payload: Record<string, unknown>) {
  let status = "failed", statusCode = 0, responseBody = "", errorMessage = "";
  try {
    if (integ.type === "webhook") {
      const url = integ.config?.url;
      if (!url) throw new Error("Webhook URL not configured");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (integ.config?.secret) headers["X-AzaBot-Secret"] = integ.config.secret;
      const res = await fetch(url, {
        method: "POST", headers,
        body: JSON.stringify({ event, integration: integ.name, data: payload }),
      });
      statusCode = res.status; responseBody = (await res.text()).slice(0, 2000);
      status = res.ok ? "success" : "failed";
    } else if (integ.type === "telegram") {
      const { bot_token, chat_id } = integ.config || {};
      const text = formatForChat(event, payload);
      const res = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: "HTML" }),
      });
      statusCode = res.status; responseBody = (await res.text()).slice(0, 2000);
      status = res.ok ? "success" : "failed";
    } else if (integ.type === "whatsapp") {
      const { phone_number_id, access_token, recipient } = integ.config || {};
      const text = formatForChat(event, payload);
      const res = await fetch(`https://graph.facebook.com/v20.0/${phone_number_id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${access_token}` },
        body: JSON.stringify({
          messaging_product: "whatsapp", to: recipient, type: "text",
          text: { body: text },
        }),
      });
      statusCode = res.status; responseBody = (await res.text()).slice(0, 2000);
      status = res.ok ? "success" : "failed";
    } else if (integ.type === "twilio") {
      const { account_sid, auth_token, from, to } = integ.config || {};
      const text = formatForChat(event, payload);
      const basic = btoa(`${account_sid}:${auth_token}`);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: from, Body: text }),
      });
      statusCode = res.status; responseBody = (await res.text()).slice(0, 2000);
      status = res.ok ? "success" : "failed";
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Unknown";
  }
  await supabase.from("webhook_logs").insert({
    integration_id: integ.id, integration_type: integ.type,
    event, status, status_code: statusCode || null,
    request_payload: payload, response_body: responseBody, error_message: errorMessage,
  });
}

function formatForChat(event: string, p: Record<string, unknown>): string {
  if (event === "conversation.started") return `🆕 <b>محادثة جديدة AzaBot</b>\nالجلسة: <code>${p.session_id}</code>`;
  if (event === "message.created") {
    const role = p.role === "user" ? "👤 الزائر" : "🤖 البوت";
    return `${role}:\n${p.content}`;
  }
  return JSON.stringify(p);
}
