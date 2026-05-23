import { useEffect, useRef } from "react";
import { Bot, FileText, Pause, User, Volume2 } from "lucide-react";
import type { ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isThinking: boolean;
  voiceRepliesEnabled: boolean;
  speakingMessageId: string | null;
  onToggleSpeak: (msg: ChatMessage) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "#fff4cc", color: "#030957" }}
      >
        <Bot className="h-7 w-7" />
      </div>
      <div>
        <div className="text-base font-semibold" style={{ color: "#030957" }}>
          مرحباً! أنا Azab 👋
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          كيف يمكنني مساعدتك اليوم؟
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{ backgroundColor: "#ffb900", color: "#030957" }}
      >
        <Bot className="h-4 w-4" />
      </div>
      <div
        className="flex items-center gap-1 rounded-2xl px-4 py-3"
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
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  if (messages.length === 0 && !isThinking) {
    return (
      <div className="flex-1 overflow-y-auto">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      {messages.map((m) => {
        const isUser = m.role === "user";
        const isSpeaking = speakingMessageId === m.id;
        const dir = /[\u0600-\u06FF]/.test(m.content) ? "rtl" : "ltr";
        return (
          <div
            key={m.id}
            className={cn(
              "azab-pop-in flex items-end gap-2",
              isUser ? "flex-row-reverse" : "flex-row",
            )}
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              )}
              style={{
                backgroundColor: isUser ? "#030957" : "#ffb900",
                color: isUser ? "#ffffff" : "#030957",
              }}
              aria-hidden
            >
              {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            <div className="flex max-w-[78%] flex-col gap-1">
              <div
                dir={dir}
                className={cn(
                  "whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                )}
                style={{
                  backgroundColor: isUser
                    ? "var(--azab-user-bubble)"
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
                        <span className="ml-auto opacity-70">
                          {formatBytes(f.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!isUser && voiceRepliesEnabled && (
                <button
                  type="button"
                  onClick={() => onToggleSpeak(m)}
                  aria-label={isSpeaking ? "إيقاف القراءة" : "قراءة الرد"}
                  className="self-start rounded p-1 text-[#030957]/70 transition hover:bg-[#030957]/5 hover:text-[#030957] focus:outline-none focus:ring-2 focus:ring-[#ffb900]"
                >
                  {isSpeaking ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {isThinking && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
