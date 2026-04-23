/**
 * AzaBot — Chat Service
 * طبقة خدمة موحدة للتواصل مع Supabase Edge Functions
 * - stream chat (SSE)
 * - text-to-speech (ElevenLabs)
 * - speech-to-text (ElevenLabs Whisper)
 */

import { CONFIG, getAuthHeaders } from "./config";
import type { ApiMessage } from "@/types/chat";

// ─── Stream Chat ────────────────────────────────────────────

interface StreamChatOptions {
  messages: ApiMessage[];
  siteId?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
  signal?: AbortSignal;
}

export async function streamChat({
  messages,
  siteId,
  onDelta,
  onDone,
  onError,
  signal,
}: StreamChatOptions): Promise<void> {
  let resp: Response;
  try {
    resp = await fetch(CONFIG.api.chat, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages.slice(-CONFIG.chat.maxContextMessages),
        siteId: siteId ?? CONFIG.siteId,
        origin: window.location.origin,
      }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    onError("تعذّر الاتصال بالخادم. تحقق من اتصالك.");
    return;
  }

  if (resp.status === 429) {
    onError("تم تجاوز الحد المسموح. انتظر لحظة ثم حاول مرة أخرى.");
    return;
  }
  if (resp.status === 402) {
    onError("الخدمة غير متاحة حالياً.");
    return;
  }
  if (!resp.ok || !resp.body) {
    onError(`خطأ في الخادم (${resp.status}). حاول مرة أخرى.`);
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;

        const json = line.slice(6).trim();
        if (json === "[DONE]") {
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          // إعادة المحاولة للسطر الناقص
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  onDone();
}

// ─── Text-to-Speech (ElevenLabs) ───────────────────────────

export async function textToSpeech(text: string): Promise<string> {
  const response = await fetch(CONFIG.api.tts, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// ─── Speech-to-Text (ElevenLabs Whisper) ───────────────────

export async function speechToText(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");

  const response = await fetch(CONFIG.api.stt, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`STT failed: ${response.status}`);
  }

  const data = await response.json();
  return (data.text as string) || "";
}

// ─── Helpers ────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function downloadChat(messages: Array<{ role: string; content: string; ts: number }>): void {
  const lines = messages.map((m) => {
    const time = new Date(m.ts).toLocaleTimeString("ar-EG");
    const role = m.role === "user" ? "👤 أنت" : "🤖 عزبوت";
    return `[${time}] ${role}:\n${m.content}\n`;
  });
  const blob = new Blob([lines.join("\n---\n\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `azabot-chat-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
