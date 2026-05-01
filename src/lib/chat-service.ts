/**
 * AzaBot — Chat Service
 * طبقة خدمة موحدة للتواصل مع FastAPI/Rasa.
 */

import { CONFIG } from "./config";
import type { ApiMessage, MessageButton } from "@/types/chat";

let currentAudio: HTMLAudioElement | null = null;
let currentTtsAbortController: AbortController | null = null;
let currentTtsSequence = 0;

async function readJsonResponse<T = Record<string, unknown>>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("رد الخادم ليس JSON صالحًا");
  }
}

interface StreamChatOptions {
  messages: ApiMessage[];
  siteId?: string;
  onDelta: (text: string, buttons?: MessageButton[]) => void;
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
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content?.trim();
  if (!lastUserMessage) {
    onDone();
    return;
  }

  try {
    resp = await fetch(CONFIG.api.chat, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender_id: getSenderId(),
        message: lastUserMessage,
        channel: "website",
        site_host: window.location.hostname,
        site_path: window.location.pathname || "/",
        brand: siteId ?? CONFIG.siteId,
      }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    onError("تعذّر الاتصال بالخادم. تحقق من اتصالك.");
    return;
  }

  if (!resp.ok) {
    onError(`خطأ في الخادم (${resp.status}). حاول مرة أخرى.`);
    return;
  }

  try {
    const data = await readJsonResponse<{ responses?: unknown[] }>(resp);
    const normalized = normalizeResponses(data?.responses);
    if (normalized.text) onDelta(normalized.text, normalized.buttons);
  } catch {
    onError("تعذّر قراءة رد الخادم.");
    return;
  }

  onDone();
}

export async function speechToText(audioBlob: Blob): Promise<string> {
  const form = new FormData();
  form.append("sender_id", getSenderId());
  form.append("channel", "website");
  form.append("site_host", window.location.hostname);
  form.append("site_path", window.location.pathname || "/");
  form.append("file", audioBlob, "recording.webm");

  const response = await fetch(CONFIG.api.audio, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`STT failed: ${response.status}`);
  }

  const data = await readJsonResponse<{ transcript?: string }>(response);
  return (data?.transcript as string | undefined) || "";
}

interface UploadChatFileOptions {
  file: File;
  message?: string;
  siteId?: string;
  onDelta: (text: string, buttons?: MessageButton[]) => void;
  onDone: () => void;
  onError: (msg: string) => void;
  signal?: AbortSignal;
}

export async function uploadChatFile({
  file,
  message,
  siteId,
  onDelta,
  onDone,
  onError,
  signal,
}: UploadChatFileOptions): Promise<void> {
  const form = new FormData();
  form.append("sender_id", getSenderId());
  form.append("channel", "website");
  form.append("site_host", window.location.hostname);
  form.append("site_path", window.location.pathname || "/");
  form.append("file", file);
  if (message?.trim()) form.append("message", message.trim());
  if (siteId ?? CONFIG.siteId) form.append("brand", siteId ?? CONFIG.siteId ?? "");

  let response: Response;
  try {
    response = await fetch(CONFIG.api.upload, {
      method: "POST",
      body: form,
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    onError("تعذّر رفع الملف للخادم.");
    return;
  }

  if (!response.ok) {
    onError(`فشل رفع الملف (${response.status}). حاول مرة أخرى.`);
    return;
  }

  try {
    const data = await readJsonResponse<{ responses?: unknown[] }>(response);
    const normalized = normalizeResponses(data?.responses);
    if (normalized.text) onDelta(normalized.text, normalized.buttons);
  } catch {
    onError("تعذّر قراءة رد الخادم بعد رفع الملف.");
    return;
  }

  onDone();
}

export async function speakInBrowser(text: string, lang = "ar-SA", serverVoice?: string): Promise<void> {
  const cleanText = stripMarkdown(text);
  void lang;
  await playServerTTS(cleanText, serverVoice);
}

export function stopSpeechPlayback(): void {
  currentTtsSequence += 1;
  currentTtsAbortController?.abort();
  currentTtsAbortController = null;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();
}

// ─── Helpers ────────────────────────────────────────────────

async function playServerTTS(text: string, voice?: string): Promise<void> {
  if (!text) return;
  stopSpeechPlayback();
  const sequence = ++currentTtsSequence;
  const abortController = new AbortController();
  currentTtsAbortController = abortController;
  const response = await fetch(CONFIG.api.tts, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
    signal: abortController.signal,
  });
  if (!response.ok) {
    throw new Error(`TTS failed: ${response.status}`);
  }
  if (sequence !== currentTtsSequence) return;
  const blob = await response.blob();
  if (sequence !== currentTtsSequence) return;
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;

  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (sequence === currentTtsSequence) {
        currentAudio = null;
        currentTtsAbortController = null;
      }
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (sequence === currentTtsSequence) {
        currentAudio = null;
        currentTtsAbortController = null;
      }
      reject(new Error("Server TTS playback failed"));
    };
    audio.play().catch((error) => {
      URL.revokeObjectURL(url);
      if (sequence === currentTtsSequence) {
        currentAudio = null;
        currentTtsAbortController = null;
      }
      reject(error);
    });
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getSenderId(): string {
  const key = "azabot_sender_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const value = `web_${uid()}`;
  localStorage.setItem(key, value);
  return value;
}

function normalizeResponses(responses: unknown): { text: string; buttons: MessageButton[] } {
  if (!Array.isArray(responses)) return { text: "", buttons: [] };

  const buttons: MessageButton[] = [];
  const text = responses
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const textValue = (item as { text?: unknown }).text;
      const rawButtons = (item as { buttons?: unknown }).buttons;
      if (Array.isArray(rawButtons)) {
        rawButtons.forEach((button) => {
          if (!button || typeof button !== "object") return;
          const title = typeof (button as { title?: unknown }).title === "string"
            ? (button as { title: string }).title.trim()
            : "";
          const payload = typeof (button as { payload?: unknown }).payload === "string"
            ? (button as { payload: string }).payload.trim()
            : undefined;
          const url = typeof (button as { url?: unknown }).url === "string"
            ? (button as { url: string }).url.trim()
            : undefined;
          if (!title) return;
          buttons.push({ title, payload, url });
        });
      }
      return typeof textValue === "string" ? textValue.trim() : "";
    })
    .filter(Boolean)
    .join("\n\n");

  return { text, buttons };
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^\s*[-*+]\s/gm, "")
    .trim();
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
