import { useEffect, useRef } from "react";
import { Bot, FileText, Pause, Sparkles, User, Volume2 } from "lucide-react";
import type { ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isThinking: boolean;
  voiceRepliesEnabled: boolean;
  speakingMessageId: string | null;
  onToggleSpeak: (msg: ChatMessage) => void;
  onSuggestion?: (text: string) => void;
}

const SUGGESTIONS = [
  "كيف يمكنني مساعدتك؟",
  "اشرح لي ميزات المنصة",
  "أريد تجربة سريعة",
  "تواصل مع الدعم",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmptyState({ onSuggestion }: { onSuggestion?: (t: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-8 text-center">
      <div
        className="relative flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
        style={{
          background: "linear-gradient(135deg, #ffb900 0%, #ffd166 100%)",
          color: "#030957",
        }}
      >
        <Sparkles className="h-8 w-8" />
        <span
          className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow"
          style={{ backgroundColor: "#030957" }}
        >
          <Bot className="h-3 w-3 text-white" />
        </span>
      </div>
      <div>
        <div className="text-lg font-bold" style={{ color: "#030957" }}>
          مرحباً! أنا Azab 👋
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          كيف يمكنني مساعدتك اليوم؟
        </div>
      </div>
      {onSuggestion && (
        <div className="mt-2 flex w-full flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggestion(s)}
              className="rounded-full border border-[#030957]/10 bg-white px-3 py-1.5 text-xs text-[#030957] shadow-sm transition hover:border-[#ffb900] hover:bg-[#fff8e0] focus:outline-none focus:ring-2 focus:ring-[#ffb900]"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full shadow-sm"
        style={{ backgroundColor: "#ffb900", color: "#030957" }}
      >
        <Bot className="h-4 w-4" />
      </div>
      <div
        className="flex items-center gap-1 rounded-2xl px-4 py-3 shadow-sm"
        style={{ backgroundColor: "var(--azab-assistant-bubble)" }}
      >
        <span
          className="azab-typing-dot h-2 w-2 rounded-full"
          style={{ backgroundColor: "#030957" }}
        />
        <span
          className="azab-typing-dot h-2 w-2 rounded-full"
          style={{ backgroundColor: "#030957" }}
        />
        <span
          className="azab-typing-dot h-2 w-2 rounded-full"
          style={{ backgroundColor: "#030957" }}
        />
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  isThinking,
  voiceRepliesEnabled,
  speakingMessageId,
  onToggleSpeak,
  onSuggestion,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  if (messages.length === 0 && !isThinking) {
    return (
      <div className="azab-scroll flex-1 overflow-y-auto">
        <EmptyState onSuggestion={onSuggestion} />
      </div>
    );
  }

  return (
    <div className="azab-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
      {messages.map((m) => {
        const isUser = m.role === "user";
        const isSpeaking = speakingMessageId === m.id;
        const dir = /[\u0600-\u06FF]/.test(m.content) ? "rtl" : "ltr";
        return (
          <div
            key={m.id}
            className={cn(
              "azab-fade-up flex items-end gap-2",
              isUser ? "flex-row-reverse" : "flex-row",
            )}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm"
              style={{
                backgroundColor: isUser ? "#030957" : "#ffb900",
                color: isUser ? "#ffffff" : "#030957",
              }}
              aria-hidden
            >
              {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            <div
              className={cn(
                "flex max-w-[78%] flex-col gap-1",
                isUser ? "items-end" : "items-start",
              )}
            >
              <div
                dir={dir}
                className="whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm"
                style={{
                  background: isUser
                    ? "linear-gradient(135deg, #030957 0%, #1a2280 100%)"
                    : "var(--azab-assistant-bubble)",
                  color: isUser ? "#ffffff" : "#030957",
                  borderBottomRightRadius: isUser ? 6 : undefined,
                  borderBottomLeftRadius: !isUser ? 6 : undefined,
                }}
              >
                {m.content}

                {m.files && m.files.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {m.files.map((f) => (
                      <div
                        key={f.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                          isUser ? "bg-white/15" : "bg-white",
                        )}
                      >
                        {f.dataUrl ? (
                          <img
                            src={f.dataUrl}
                            alt={f.name}
                            className="h-8 w-8 rounded object-cover"
                          />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">{f.name}</span>
                        <span className="ms-auto opacity-70">
                          {formatBytes(f.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                className={cn(
                  "flex items-center gap-2 px-1 text-[10px] text-muted-foreground",
                  isUser ? "flex-row-reverse" : "flex-row",
                )}
              >
                <span>{formatTime(m.timestamp)}</span>
                {!isUser && voiceRepliesEnabled && (
                  <button
                    type="button"
                    onClick={() => onToggleSpeak(m)}
                    aria-label={isSpeaking ? "إيقاف القراءة" : "قراءة الرد"}
                    className="rounded p-0.5 text-[#030957]/60 transition hover:bg-[#030957]/5 hover:text-[#030957] focus:outline-none focus:ring-2 focus:ring-[#ffb900]"
                  >
                    {isSpeaking ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Volume2 className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {isThinking && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
