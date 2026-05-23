import type {
  ChatApiRequestMeta,
  ChatApiResponse,
  ChatFile,
} from "@/types/chat";

export interface SendMessageArgs {
  message: string;
  conversationId: string;
  files: File[];
  metadata: ChatApiRequestMeta;
  signal?: AbortSignal;
  endpoint?: string;
}

/**
 * Sends a chat message (and optional files) to the backend.
 * Falls back to a simulated reply when the endpoint is unavailable so the
 * widget remains usable in development.
 */
export async function sendChatMessage({
  message,
  conversationId,
  files,
  metadata,
  signal,
  endpoint = "/api/chat",
}: SendMessageArgs): Promise<ChatApiResponse> {
  const formData = new FormData();
  formData.append("message", message);
  formData.append("conversationId", conversationId);
  formData.append("metadata", JSON.stringify(metadata));
  files.forEach((file) => formData.append("files", file, file.name));

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal,
    });

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    const data = (await res.json()) as ChatApiResponse;
    return data;
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    // Graceful local fallback so the widget still demonstrates flow.
    return simulateReply(message, conversationId, metadata.language);
  }
}

async function simulateReply(
  message: string,
  conversationId: string,
  language: "ar" | "en",
): Promise<ChatApiResponse> {
  await new Promise((r) => setTimeout(r, 700));
  const reply =
    language === "ar"
      ? `تم استلام رسالتك: "${message}". هذا رد تجريبي محلي لأن الـ API غير متصل.`
      : `Received: "${message}". This is a local fallback reply (API offline).`;
  return { reply, conversationId, sources: [], actions: [] };
}

export function fileToChatFile(file: File): Promise<ChatFile> {
  return new Promise((resolve) => {
    const base: ChatFile = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
    };
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ ...base, dataUrl: reader.result as string });
      reader.onerror = () => resolve(base);
      reader.readAsDataURL(file);
    } else {
      resolve(base);
    }
  });
}
