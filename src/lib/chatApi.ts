import type {
  ChatApiRequestMeta,
  ChatApiResponse,
  ChatFile,
} from "@/types/chat";
import { supabase } from "@/integrations/supabase/client";
import { foundryChat } from "@/lib/foundry.functions";
import { getChatUploadSignedUrl } from "@/lib/chatUploads.functions";

const BUCKET = "chatbot-uploads";

export interface SendMessageArgs {
  message: string;
  conversationId: string;
  files: File[];
  metadata: ChatApiRequestMeta;
  signal?: AbortSignal;
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
  scope: string,
): Promise<UploadedAttachment> {
  const safe = file.name.replace(/[^\w.\-()\s]/g, "_");
  const path = `${scope}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`فشل رفع ${file.name}`);

  // Signed URLs are minted server-side; the bucket has no public SELECT.
  const signed = await getChatUploadSignedUrl({ data: { path } });

  return {
    url: signed.url,
    path,
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

/**
 * Sends a chat message + files to the Foundry-backed server function.
 * conversationId is an HMAC-signed thread token issued by the server;
 * clients cannot forge or reuse other visitors' thread IDs.
 */
export async function sendChatMessage({
  message,
  conversationId,
  files,
}: SendMessageArgs): Promise<ChatApiResponse> {
  const attachments: UploadedAttachment[] = [];
  // Upload scope is a random per-request folder so paths aren't guessable.
  const scope = crypto.randomUUID();
  for (const f of files) {
    attachments.push(await uploadFile(f, scope));
  }

  // Only forward tokens issued by our own server (contain a signature ".").
  const threadId =
    conversationId && conversationId.includes(".") ? conversationId : null;

  const res = await foundryChat({
    data: {
      threadId,
      message,
      attachments: attachments.map((a) => ({
        url: a.url,
        name: a.name,
        type: a.type,
      })),
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
