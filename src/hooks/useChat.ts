/**
 * AzaBot — useChat Hook
 * يحتوي على كل منطق المحادثة بعيداً عن الـ UI
 * يقبل siteId ويمرره لطبقة الشبكة
 */

import { useState, useCallback, useRef } from "react";
import { streamChat, uploadChatFile, uid, downloadChat } from "@/lib/chat-service";
import { toast } from "sonner";
import type { Message, ApiMessage, Attachment, MessageButton } from "@/types/chat";

export function useChat(siteId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastSendRef = useRef<number>(0);

  // إلغاء الطلب الحالي
  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback(
    async (text: string, attachments?: Attachment[], files?: File[]) => {
      const trimmed = text.trim();
      if (!trimmed && (!attachments || attachments.length === 0)) return;
      if (streaming) return;

      // منع الإرسال السريع جداً
      const now = Date.now();
      if (now - lastSendRef.current < 500) return;
      lastSendRef.current = now;

      // إضافة رسالة المستخدم
      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: trimmed,
        attachments,
        ts: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setStreaming(true);

      // بناء context للـ AI
      const apiMessages: ApiMessage[] = [...messages, userMsg].map((m) => ({
        role: m.role,
        content:
          m.attachments?.length
            ? `${m.content}\n\n[المرفقات: ${m.attachments.map((a) => a.name).join(", ")}]`
            : m.content,
      }));

      // placeholder رسالة البوت
      const assistantId = uid();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", ts: Date.now() },
      ]);

      let accumulated = "";
      const controller = new AbortController();
      abortRef.current = controller;

      const appendAssistantText = (chunk: string, fileName?: string, buttons?: MessageButton[]) => {
        const text = files && files.length > 1 && fileName
          ? `ملف ${fileName}:\n${chunk}`
          : chunk;
        accumulated += accumulated ? `\n\n${text}` : text;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: accumulated,
                  buttons: buttons && buttons.length > 0 ? buttons : m.buttons,
                }
              : m
          )
        );
      };

      const finishRequest = () => {
        setStreaming(false);
        abortRef.current = null;
        if (!accumulated) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          toast.error("لم يأتِ رد من الخادم. حاول مرة أخرى.");
        }
      };

      const request = files?.length
        ? (async () => {
            for (const file of files) {
              if (controller.signal.aborted) break;
              await uploadChatFile({
                file,
                message: trimmed,
                siteId,
                onDelta: (chunk, buttons) => appendAssistantText(chunk, file.name, buttons),
                onDone: () => {},
                onError: (msg) => {
                  const errorText = `${file.name}: ${msg}`;
                  toast.error(errorText);
                  appendAssistantText(errorText, file.name);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, isError: true } : m
                    )
                  );
                },
                signal: controller.signal,
              });
            }
            finishRequest();
          })()
        : streamChat({
            messages: apiMessages,
            siteId,
            onDelta: (chunk, buttons) => {
              accumulated += chunk;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: accumulated,
                        buttons: buttons && buttons.length > 0 ? buttons : m.buttons,
                      }
                    : m
                )
              );
            },
            onDone: finishRequest,
            onError: (msg) => {
              toast.error(msg);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: msg, isError: true }
                    : m
                )
              );
              setStreaming(false);
              abortRef.current = null;
            },
            signal: controller.signal,
          });

      await request;
    },
    [messages, streaming, siteId]
  );

  const clearMessages = useCallback(() => {
    abort();
    setMessages([]);
  }, [abort]);

  const downloadConversation = useCallback(() => {
    if (messages.length === 0) {
      toast.info("لا توجد محادثة للتحميل.");
      return;
    }
    downloadChat(messages);
  }, [messages]);

  return {
    messages,
    streaming,
    send,
    abort,
    clearMessages,
    downloadConversation,
  };
}
