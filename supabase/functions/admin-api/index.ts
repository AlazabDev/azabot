import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { verifyJWT } from "../_shared/jwt.ts";

interface Integration {
  id: string;
  type: "webhook" | "telegram" | "whatsapp" | "twilio" | string;
  name: string;
  enabled: boolean;
  events: string[];
  config: Record<string, string>;
}

const SECRET = Deno.env.get("ADMIN_JWT_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function requireAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const claims = await verifyJWT(auth.slice(7), SECRET);
  return claims?.role === "admin";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!(await requireAdmin(req))) return json({ error: "Unauthorized" }, 401);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const body = req.method !== "GET" ? await req.json().catch(() => ({})) : {};

    switch (action) {
      case "get_settings": {
        const { data } = await supabase.from("bot_settings").select("*").eq("id", 1).single();
        return json(data);
      }
      case "update_settings": {
        const allowed = [
          "bot_name", "primary_color", "welcome_message", "quick_replies", "ai_model",
          "system_prompt", "voice_enabled", "voice_name", "auto_speak",
          "business_hours_enabled", "business_hours", "offline_message", "position",
        ];
        const patch: Record<string, unknown> = {};
        for (const k of allowed) if (k in body) patch[k] = body[k];
        const { data, error } = await supabase
          .from("bot_settings").update(patch).eq("id", 1).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      case "list_integrations": {
        const { data } = await supabase.from("integrations")
          .select("*").order("created_at", { ascending: false });
        return json(data);
      }
      case "save_integration": {
        const { id, type, name, enabled, config, events } = body;
        if (id) {
          const { data, error } = await supabase.from("integrations")
            .update({ name, enabled, config, events }).eq("id", id).select().single();
          if (error) return json({ error: error.message }, 400);
          return json(data);
        }
        const { data, error } = await supabase.from("integrations")
          .insert({ type, name, enabled: !!enabled, config: config || {}, events: events || ["message.created"] })
          .select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      case "delete_integration": {
        await supabase.from("integrations").delete().eq("id", body.id);
        return json({ ok: true });
      }
      case "test_integration": {
        const { data: integ } = await supabase.from("integrations")
          .select("*").eq("id", body.id).single();
        if (!integ) return json({ error: "Integration not found" }, 404);
        const result = await dispatchEvent(integ, "test.event", {
          message: "هذه رسالة اختبار من AzaBot 🚀",
          timestamp: new Date().toISOString(),
        });
        return json(result);
      }
      case "list_conversations": {
        const q = url.searchParams.get("q") || "";
        let query = supabase.from("conversations")
          .select("*").order("last_message_at", { ascending: false }).limit(100);
        if (q) query = query.or(`visitor_name.ilike.%${q}%,visitor_email.ilike.%${q}%,session_id.ilike.%${q}%`);
        const { data } = await query;
        return json(data);
      }
      case "get_conversation": {
        const id = url.searchParams.get("id");
        const { data: conv } = await supabase.from("conversations").select("*").eq("id", id).single();
        const { data: msgs } = await supabase.from("messages")
          .select("*").eq("conversation_id", id).order("created_at");
        return json({ conversation: conv, messages: msgs });
      }
      case "delete_conversation": {
        await supabase.from("conversations").delete().eq("id", body.id);
        return json({ ok: true });
      }
      case "list_logs": {
        const { data } = await supabase.from("webhook_logs")
          .select("*").order("created_at", { ascending: false }).limit(200);
        return json(data);
      }
      case "stats": {
        const { count: convCount } = await supabase.from("conversations")
          .select("*", { count: "exact", head: true });
        const { count: msgCount } = await supabase.from("messages")
          .select("*", { count: "exact", head: true });
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { count: todayCount } = await supabase.from("conversations")
          .select("*", { count: "exact", head: true })
          .gte("created_at", today.toISOString());
        return json({ conversations: convCount || 0, messages: msgCount || 0, today: todayCount || 0 });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("admin-api error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

async function dispatchEvent(integ: Integration, event: string, payload: Record<string, unknown>) {
  const startedAt = Date.now();
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
      if (!bot_token || !chat_id) throw new Error("Telegram bot_token & chat_id required");
      const text = formatForChat(event, payload);
      const res = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: "HTML" }),
      });
      statusCode = res.status; responseBody = (await res.text()).slice(0, 2000);
      status = res.ok ? "success" : "failed";
    } else if (integ.type === "whatsapp") {
      const { phone_number_id, access_token, recipient } = integ.config || {};
      if (!phone_number_id || !access_token || !recipient)
        throw new Error("WhatsApp config incomplete");
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
      if (!account_sid || !auth_token || !from || !to)
        throw new Error("Twilio config incomplete");
      const text = formatForChat(event, payload);
      const basic = btoa(`${account_sid}:${auth_token}`);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: text }),
      });
      statusCode = res.status; responseBody = (await res.text()).slice(0, 2000);
      status = res.ok ? "success" : "failed";
    } else {
      throw new Error(`Unsupported integration type: ${integ.type}`);
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Unknown error";
  }

  await supabase.from("webhook_logs").insert({
    integration_id: integ.id, integration_type: integ.type,
    event, status, status_code: statusCode || null,
    request_payload: payload, response_body: responseBody, error_message: errorMessage,
  });

  return { status, statusCode, errorMessage, responseBody, durationMs: Date.now() - startedAt };
}

function formatForChat(event: string, p: Record<string, unknown>): string {
  if (event === "test.event") return `🧪 <b>اختبار AzaBot</b>\n${p.message}`;
  if (event === "conversation.started") {
    return `🆕 <b>محادثة جديدة</b>\nالجلسة: <code>${p.session_id}</code>`;
  }
  if (event === "message.created") {
    const role = p.role === "user" ? "👤 الزائر" : "🤖 البوت";
    return `${role}:\n${p.content}`;
  }
  return JSON.stringify(p);
}
