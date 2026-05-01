/**
 * AzaBot — المكوّن الرئيسي
 * يقرأ الإعدادات الديناميكية من Lovable Cloud (bot_settings_public)
 * ويستقبل رسائل الأدمن لحظياً عبر Realtime
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageSquare, Mic, MessageCircle, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { useChat } from "@/hooks/useChat";
import { useTTS } from "@/hooks/useTTS";
import { useSite } from "@/context/useSite";

import { ChatHeader } from "./chat/ChatHeader";
import { MessageBubble } from "./chat/MessageBubble";
import { TypingDots } from "./chat/TypingDots";
import { WelcomeScreen } from "./chat/WelcomeScreen";
import { ChatInput } from "./chat/ChatInput";
import { VoiceView } from "./chat/VoiceView";
import { VoiceSelector } from "./chat/VoiceSelector";

import type { Attachment, ChatTab, Message } from "@/types/chat";

interface PublicSettings {
  bot_name?: string;
  primary_color?: string;
  position?: "left" | "right";
  show_branding?: boolean;
  sound_enabled?: boolean;
  bubble_style?: "modern" | "classic" | "compact";
  header_subtitle?: string;
  welcome_message?: string;
  quick_replies?: string[];
}

// Short notification beep (base64 wav)
const NOTIFICATION_SOUND = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export default function AzaBot() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ChatTab>("text");
  const [unread, setUnread] = useState(0);
  const [publicSettings, setPublicSettings] = useState<PublicSettings>({});

  const [inputText, setInputText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAutoSpokenMessageId = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { site } = useSite();
  const { messages, streaming, send, clearMessages, downloadConversation, injectMessage } = useChat(site.id);
  const tts = useTTS();

  // ─── Fetch public settings ───
  useEffect(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-public-settings`;
    fetch(url, { headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data && !data.error) setPublicSettings(data); })
      .catch(() => {});
  }, []);

  // ─── Realtime: listen for admin replies on this session ───
  useEffect(() => {
    const sessionId = localStorage.getItem("azabot_session_id");
    if (!sessionId) return;

    let conversationId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase
        .from("conversations").select("id").eq("session_id", sessionId).maybeSingle();
      if (!data?.id) return;
      conversationId = data.id;

      channel = supabase
        .channel(`conv-${conversationId}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const m = payload.new as { role: string; content: string; id: string };
            // Only inject admin messages (not bot's own SSE replies which are already shown)
            if (m.role === "assistant" && m.content.startsWith("👨‍💼")) {
              injectMessage({ id: m.id, role: "assistant", content: m.content, ts: Date.now() });
              if (publicSettings.sound_enabled !== false) playSound();
              if (!open) setUnread((n) => n + 1);
            }
          })
        .subscribe();
    })();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [open, publicSettings.sound_enabled, injectMessage]);

  const playSound = () => {
    try {
      if (!audioRef.current) audioRef.current = new Audio(NOTIFICATION_SOUND);
      audioRef.current.play().catch(() => {});
    } catch { /* noop */ }
  };

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // Reset unread on open
  useEffect(() => { if (open) setUnread(0); }, [open]);

  // TTS
  useEffect(() => {
    if (tab !== "voice") return;
    const lastBot = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastBot || streaming) return;
    if (lastAutoSpokenMessageId.current === lastBot.id) return;
    lastAutoSpokenMessageId.current = lastBot.id;
    tts.speak(lastBot.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, streaming, tab]);

  // Handlers
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text && pendingFiles.length === 0) return;
    if (streaming) return;
    send(text, pendingAttachments.length > 0 ? pendingAttachments : undefined,
         pendingFiles.length > 0 ? pendingFiles : undefined);
    setInputText("");
    setPendingAttachments([]);
    setPendingFiles([]);
  }, [inputText, pendingFiles, pendingAttachments, streaming, send]);

  const handlePickQuestion = useCallback((q: string) => send(q), [send]);
  const handleVoiceSend = useCallback((text: string) => send(text), [send]);
  const handleAddFiles = useCallback((files: File[]) => {
    setPendingFiles((p) => [...p, ...files]);
    setPendingAttachments((p) => [...p, ...files.map((f) => ({ name: f.name, size: f.size, type: f.type }))]);
  }, []);
  const handleRemoveFile = useCallback((idx: number) => {
    setPendingFiles((p) => p.filter((_, i) => i !== idx));
    setPendingAttachments((p) => p.filter((_, i) => i !== idx));
  }, []);
  const handleClose = useCallback(() => { setOpen(false); tts.stop(); }, [tts]);
  const handleClear = useCallback(() => {
    clearMessages();
    setInputText("");
    setPendingAttachments([]);
    setPendingFiles([]);
    lastAutoSpokenMessageId.current = null;
    toast.success("تم بدء محادثة جديدة.");
  }, [clearMessages]);

  // Position from settings
  const position = publicSettings.position || "left";
  const positionClass = position === "right" ? "right-6" : "left-6";

  // Floating button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 ${positionClass} z-50 w-14 h-14 rounded-full bg-brand text-brand-foreground flex items-center justify-center shadow-[0_8px_32px_-8px_hsl(var(--brand)/0.55)] hover:scale-110 active:scale-95 transition-transform`}
        aria-label={`فتح المساعد الذكي ${publicSettings.bot_name || site.botName}`}
      >
        <MessageCircle className="w-6 h-6" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 ${positionClass} z-50 w-[390px] max-w-[calc(100vw-1.5rem)] h-[600px] max-h-[calc(100svh-2rem)] bg-background rounded-2xl shadow-[var(--shadow-chat)] border border-border flex flex-col overflow-hidden animate-fade-in-up`}
      role="dialog" aria-modal="true"
      aria-label={`نافذة دردشة ${publicSettings.bot_name || site.botName}`}
    >
      <ChatHeader onClose={handleClose} onClear={handleClear} streaming={streaming} />

      <div className="flex items-stretch border-b border-border bg-card shrink-0">
        <div className="flex flex-1" role="tablist">
          <TabButton active={tab === "text"} onClick={() => setTab("text")}
            icon={<MessageSquare className="w-4 h-4" />} label="محادثة نصية" id="tab-text" />
          <TabButton active={tab === "voice"} onClick={() => setTab("voice")}
            icon={<Mic className="w-4 h-4" />} label="محادثة صوتية" id="tab-voice" />
        </div>
        {tab === "text" && (
          <div className="flex items-center px-2 border-r border-border">
            <Button size="icon" variant="ghost" onClick={tts.toggle} className="w-9 h-9 rounded-full"
              aria-label={tts.enabled ? "إيقاف النطق" : "تشغيل النطق"}>
              {tts.enabled ? <Volume2 className="w-4 h-4 text-brand" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
            </Button>
          </div>
        )}
      </div>

      {tab === "voice" && (
        <VoiceSelector voices={tts.voices} selected={tts.selectedVoice} onSelect={tts.setSelectedVoice} />
      )}

      {tab === "voice" ? (
        <VoiceView messages={messages} streaming={streaming} onSendText={handleVoiceSend} onSpeakText={tts.speak} />
      ) : (
        <>
          <div ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-border"
            role="log" aria-live="polite" aria-label="سجل المحادثة">
            {messages.length === 0 ? (
              <WelcomeScreen onPickQuestion={handlePickQuestion} />
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg}
                    ttsEnabled={tts.enabled} onSpeak={() => tts.speak(msg.content)} />
                ))}
                {streaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
                  <TypingDots />
                )}
              </>
            )}
          </div>

          <ChatInput value={inputText} onChange={setInputText} onSend={handleSend}
            onDownload={downloadConversation} streaming={streaming}
            pendingAttachments={pendingAttachments} pendingFiles={pendingFiles}
            onAddFiles={handleAddFiles} onRemoveFile={handleRemoveFile} />

          {publicSettings.show_branding !== false && (
            <div className="text-center text-[10px] text-muted-foreground py-1.5 border-t border-border bg-card/50">
              Powered by <span className="font-bold text-brand">AzaBot</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label, id }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; id: string;
}) {
  return (
    <button id={id} role="tab" aria-selected={active} onClick={onClick}
      className={"flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors relative " +
        (active ? "text-brand" : "text-muted-foreground hover:text-foreground")}>
      {label}
      {icon}
      {active && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-brand rounded-full" aria-hidden />}
    </button>
  );
}

// silence unused-import warning
export type { Message };
