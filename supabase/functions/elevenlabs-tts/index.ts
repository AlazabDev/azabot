/**
 * AzaBot — ElevenLabs TTS Edge Function
 * POST /functions/v1/elevenlabs-tts
 * Body: { text: string, voiceId?: string }
 */

const ELEVENLABS_API = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel (عربي جيد)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return new Response("TTS not configured", { status: 503 });

  let text: string;
  let voiceId: string = DEFAULT_VOICE_ID;
  try {
    const body = await req.json();
    text = (body.text as string)?.slice(0, 2000) ?? "";
    if (body.voiceId) voiceId = body.voiceId as string;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!text.trim()) return new Response("text is required", { status: 400 });

  const resp = await fetch(`${ELEVENLABS_API}/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("[tts] ElevenLabs error:", resp.status, err);
    return new Response("TTS failed", { status: 502, headers: CORS });
  }

  return new Response(resp.body, {
    status: 200,
    headers: { ...CORS, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
});
