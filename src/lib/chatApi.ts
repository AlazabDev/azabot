import type {
  ChatApiRequestMeta,
  ChatApiResponse,
  ChatFile,
} from "@/types/chat";
import { supabase } from "@/integrations/supabase/client";
import { foundryChat } from "@/lib/foundry.functions";

const BUCKET = "chatbot-uploads";

export interface SendMessageArgs {
  message: string;
  conversationId: string;
  files: File[];
  metadata: ChatApiRequestMeta;
  signal?: AbortSignal;
  systemPrompt?: string;
}

interface UploadedAttachment {
  url: string;
  path: string;
  name: string;
  type: string;
  size: number;
}

async function uploadFile(
  file: File,
  conversationId: string,
): Promise<UploadedAttachment> {
  const safe = file.name.replace(/[^\w.\-()\s]/g, "_");
  const path = `${conversationId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`فشل رفع ${file.name}: ${error.message}`);

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (signErr || !signed) throw new Error(`تعذر إنشاء رابط للملف ${file.name}`);

  return {
    url: signed.signedUrl,
    path,
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

/**
 * Sends a chat message + files to Microsoft Foundry Agent (Threads API).
 * conversationId is stored as the Foundry thread_id.
 */
export async function sendChatMessage({
  message,
  conversationId,
  files,
  systemPrompt,
}: SendMessageArgs): Promise<ChatApiResponse> {
  const attachments: UploadedAttachment[] = [];
  for (const f of files) {
    attachments.push(await uploadFile(f, conversationId || "anon"));
  }

  const threadId =
    conversationId && conversationId.startsWith("thread_") ? conversationId : null;

  const res = await foundryChat({
    data: {
      threadId,
      message,
      attachments: attachments.map((a) => ({
        url: a.url,
        name: a.name,
        type: a.type,
      })),
      systemPrompt,
    },
  });

  return {
    reply: res.reply || "…",
    conversationId: res.threadId,
    sources: [],
    actions: [],
  };
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
