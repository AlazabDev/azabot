import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// Map of friendly voice ids to Gemini TTS voice names
const VOICE_MAP: Record<string, string> = {
  default: "Puck",
  sarah: "Kore",
  george: "Charon",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text, voice = "default" } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const voiceName = VOICE_MAP[voice] ?? VOICE_MAP.default;

    // Use OpenAI gpt-4o style audio output via Lovable AI gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        modalities: ["text"],
        messages: [
          {
            role: "system",
            content: "You convert input to clean spoken text. Just echo back the user's text.",
          },
          { role: "user", content: text.slice(0, 2000) },
        ],
      }),
    });

    // Note: Lovable AI Gateway doesn't currently expose Gemini TTS audio output directly,
    // so we fall back to browser SpeechSynthesis on the client.
    // Return a stub indicating client should use SpeechSynthesis.
    if (!response.ok) {
      return new Response(JSON.stringify({ useClientTTS: true, voice: voiceName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ useClientTTS: true, voice: voiceName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tts error:", e);
    return new Response(JSON.stringify({ useClientTTS: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
