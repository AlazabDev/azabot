import { useEffect, useRef, useState } from "react";
import type {
  ChatFile,
  ChatMessage,
  ChatSettingsState,
  ChatStatus,
  ExportFormat,
} from "@/types/chat";
import { sendChatMessage } from "@/lib/chatApi";
import { downloadChat } from "@/lib/chatExport";
import {
  detectLanguage,
  getSpeechRecognition,
  isSpeechRecognitionSupported,
  speak,
  stopSpeaking,
} from "@/lib/voice";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { ChatSettings } from "./ChatSettings";
import { VoiceCall } from "./VoiceCall";

interface ChatWindowProps {
  open: boolean;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  conversationId: string;
  setConversationId: (id: string) => void;
  settings: ChatSettingsState;
  setSettings: React.Dispatch<React.SetStateAction<ChatSettingsState>>;
  onClose: () => void;
}

export function ChatWindow({
  open,
  messages,
  setMessages,
  conversationId,
  setConversationId,
  settings,
  setSettings,
  onClose,
}: ChatWindowProps) {
  const [status, setStatus] = useState<ChatStatus>("online");
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState(false);

  const inputRef = useRef<ChatInputHandle>(null);
  const recognitionRef = useRef<ReturnType<typeof getSpeechRecognition>>(null);
  const voiceSupported = isSpeechRecognitionSupported();

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      recognitionRef.current?.stop();
    };
  }, []);

  const handleSend = async (
    text: string,
    files: ChatFile[],
    rawFiles: File[],
  ) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      files,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    setStatus("thinking");

    try {
      const res = await sendChatMessage({
        message: text,
        conversationId,
        files: rawFiles,
        metadata: {
          language: detectLanguage(text),
          source: "web-widget",
          voiceEnabled: settings.voiceReplies,
        },
      });
      if (res.conversationId && res.conversationId !== conversationId) {
        setConversationId(res.conversationId);
      }
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (settings.voiceReplies) {
        setSpeakingId(assistantMsg.id);
        speak(assistantMsg.content, detectLanguage(assistantMsg.content));
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `حدث خطأ أثناء الإرسال: ${(err as Error).message}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
      setStatus("online");
    }
  };

  const handleToggleVoice = () => {
    if (!voiceSupported) return;
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = getSpeechRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    rec.lang = "ar-SA";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: unknown) => {
      const evt = e as { results: ArrayLike<ArrayLike<{ transcript: string }>> };
      const transcript = Array.from(evt.results)
        .map((r) => r[0].transcript)
        .join(" ");
      inputRef.current?.appendText(transcript);
    };
    rec.onerror = (e: unknown) => {
      const evt = e as { error?: string };
      if (evt.error === "not-allowed" || evt.error === "service-not-allowed") {
        alert("تم رفض صلاحية الميكروفون. يرجى السماح بالوصول من إعدادات المتصفح.");
      }
      setIsListening(false);
      setStatus("online");
    };
    rec.onend = () => {
      setIsListening(false);
      setStatus("online");
    };
    try {
      rec.start();
      setIsListening(true);
      setStatus("listening");
    } catch {
      setIsListening(false);
    }
  };

  const handleDownload = (format: ExportFormat) => {
    if (messages.length === 0) return;
    downloadChat(messages, format);
  };

  const handleClear = () => {
    if (!confirm("هل تريد بالتأكيد مسح المحادثة؟")) return;
    setMessages([]);
    setSettingsOpen(false);
    stopSpeaking();
    setSpeakingId(null);
  };

  const handleToggleSpeak = (msg: ChatMessage) => {
    if (speakingId === msg.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(msg.id);
    speak(msg.content, detectLanguage(msg.content));
  };

  if (!open) return null;

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-label="Azab Assistant"
      className="azab-pop-in fixed bottom-24 right-4 z-[9998] flex h-[min(640px,calc(100dvh-7rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white sm:right-6"
      style={{ boxShadow: "var(--azab-shadow)" }}
    >
      <ChatHeader
        status={status}
        onClose={onClose}
        onDownload={handleDownload}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        onStartCall={() => setCallOpen(true)}
        defaultExportFormat={settings.exportFormat}
      />

      <div className="relative flex flex-1 flex-col overflow-hidden bg-white">
        {settingsOpen && (
          <ChatSettings
            settings={settings}
            onChange={setSettings}
            onClear={handleClear}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        <ChatMessages
          messages={messages}
          isThinking={isThinking}
          voiceRepliesEnabled={settings.voiceReplies}
          speakingMessageId={speakingId}
          onToggleSpeak={handleToggleSpeak}
          onSuggestion={(t) => inputRef.current?.setText(t)}
        />


        <ChatInput
          ref={inputRef}
          disabled={isThinking}
          isListening={isListening}
          voiceSupported={voiceSupported}
          onSend={handleSend}
          onToggleVoice={handleToggleVoice}
        />

        <VoiceCall
          open={callOpen}
          conversationId={conversationId}
          onConversationId={setConversationId}
          onTranscript={(m) => setMessages((prev) => [...prev, m])}
          onClose={() => setCallOpen(false)}
        />
      </div>
    </div>
  );
}
