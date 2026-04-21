import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { signJWT, verifyPassword, hashPassword } from "../_shared/jwt.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { password, action } = await req.json();
    if (!password || typeof password !== "string" || password.length < 4) {
      return new Response(JSON.stringify({ error: "كلمة المرور غير صالحة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SECRET = Deno.env.get("ADMIN_JWT_SECRET")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row } = await supabase
      .from("admin_auth").select("password_hash").eq("id", 1).maybeSingle();

    // First-time setup: no password set yet → set the provided password
    if (!row?.password_hash || action === "setup") {
      if (row?.password_hash && action === "setup") {
        return new Response(JSON.stringify({ error: "كلمة المرور مُعيَّنة مسبقاً" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const hash = await hashPassword(password);
      await supabase.from("admin_auth").update({ password_hash: hash }).eq("id", 1);
      const token = await signJWT({ role: "admin" }, SECRET);
      return new Response(JSON.stringify({ token, setup: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return new Response(JSON.stringify({ error: "كلمة المرور خاطئة" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await signJWT({ role: "admin" }, SECRET);
    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-login error:", e);
    return new Response(JSON.stringify({ error: "خطأ في الخادم" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
