/**
 * AzaBot — ElevenLabs STT (Whisper) Edge Function
 * POST /functions/v1/elevenlabs-stt
 * Body: FormData { audio: Blob }
 */

const WHISPER_API = "https://api.elevenlabs.io/v1/speech-to-text";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return new Response("STT not configured", { status: 503 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response("Expected multipart/form-data", { status: 400 });
  }

  const audio = formData.get("audio") as File | null;
  if (!audio) return new Response("audio field required", { status: 400 });

  const outForm = new FormData();
  outForm.append("file", audio, audio.name || "recording.webm");
  outForm.append("model_id", "scribe_v1");

  const resp = await fetch(WHISPER_API, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: outForm,
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("[stt] ElevenLabs error:", resp.status, err);
    return new Response("STT failed", { status: 502, headers: CORS });
  }

  const data = await resp.json();
  return new Response(
    JSON.stringify({ text: data.text ?? "" }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
