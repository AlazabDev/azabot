import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import azabotLogo from "@/assets/azabot-logo.png";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Paperclip,
  Download,
  Mic,
  MessageSquare,
  Volume2,
  VolumeX,
  X,
  Bot,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Attachment = { name: string; size: number; type: string };
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  ts: number;
};

const QUICK_ACTIONS = [
  "ما هي خدمات الشركة؟",
  "أريد عرض سعر تشطيب",
  "ما هي أسعار التشطيب؟",
  "ما هي فروع الشركة؟",
];

const VOICES = [
  { id: "default", label: "الصوت الأساسي", desc: "عربي • ذكر • شاب", lang: "ar-SA" },
  { id: "sarah", label: "سارة", desc: "أمريكي • أنثى • شابة", lang: "en-US" },
  { id: "george", label: "جورج", desc: "أمريكي • ذكر • متوسط", lang: "en-US" },
];

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const uid = () => Math.random().toString(36).slice(2);

export default function AzaBot() {
  const [tab, setTab] = useState<"text" | "voice">("text");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [voice, setVoice] = useState(VOICES[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // Stop speech on unmount
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speak = (text: string) => {
    if (!ttsEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice.lang;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang === voice.lang) || voices.find((v) => v.lang.startsWith(voice.lang.split("-")[0]));
    if (match) u.voice = match;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    synthRef.current = u;
    window.speechSynthesis.speak(u);
  };

  const stopSpeak = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 5);
    setPendingFiles((p) => [...p, ...arr]);
    setPending((p) => [...p, ...arr.map((f) => ({ name: f.name, size: f.size, type: f.type }))]);
  };

  const removePending = (idx: number) => {
    setPending((p) => p.filter((_, i) => i !== idx));
    setPendingFiles((p) => p.filter((_, i) => i !== idx));
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text && pending.length === 0) return;
    if (streaming) return;

    const userMsg: Msg = {
      id: uid(),
      role: "user",
      content: text,
      attachments: pending.length ? pending : undefined,
      ts: Date.now(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPending([]);
    setPendingFiles([]);
    setStreaming(true);

    // Build context for AI (include attachment names as text hint)
    const aiMessages = next.map((m) => ({
      role: m.role,
      content:
        m.attachments && m.attachments.length
          ? `${m.content}\n\n[المرفقات: ${m.attachments.map((a) => a.name).join(", ")}]`
          : m.content,
    }));

    const assistantId = uid();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", ts: Date.now() }]);

    let acc = "";
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: aiMessages }),
      });

      if (resp.status === 429) {
        toast.error("تم تجاوز حد الطلبات. حاول بعد قليل.");
        setStreaming(false);
        setMessages((p) => p.filter((m) => m.id !== assistantId));
        return;
      }
      if (resp.status === 402) {
        toast.error("الرصيد غير كافٍ. يرجى إضافة رصيد لمساحة العمل.");
        setStreaming(false);
        setMessages((p) => p.filter((m) => m.id !== assistantId));
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("فشل الاتصال");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(j);
            const c = p.choices?.[0]?.delta?.content;
            if (c) {
              acc += c;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
              );
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      if (acc && tab === "voice") speak(acc);
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ. حاول مرة أخرى.");
      setMessages((p) => p.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  };

  const startVoiceInput = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("متصفحك لا يدعم التعرف على الصوت. جرّب Chrome.");
      return;
    }
    const rec = new SR();
    rec.lang = voice.lang;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      send(t);
    };
    rec.onerror = () => toast.error("تعذّر التعرف على الصوت.");
    rec.start();
    toast.info("تحدّث الآن…");
  };

  const downloadChat = () => {
    if (messages.length === 0) {
      toast.info("لا توجد محادثة لتحميلها.");
      return;
    }
    const lines = messages.map((m) => {
      const who = m.role === "user" ? "أنت" : "AzaBot";
      const time = new Date(m.ts).toLocaleString("ar-EG");
      const att = m.attachments?.length
        ? `\nالمرفقات: ${m.attachments.map((a) => a.name).join(", ")}`
        : "";
      return `[${time}] ${who}:\n${m.content}${att}\n`;
    });
    const blob = new Blob([`محادثة AzaBot\n\n${lines.join("\n")}`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `azabot-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تحميل المحادثة.");
  };

  const clearChat = () => {
    setMessages([]);
    stopSpeak();
    toast.success("تمت مسح المحادثة.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/40 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md h-[640px] bg-card rounded-3xl shadow-chat overflow-hidden flex flex-col border border-border">
        {/* Header */}
        <header className="bg-gradient-header text-primary-foreground px-5 py-4 flex items-center justify-between">
          <button
            onClick={clearChat}
            className="text-primary-foreground/70 hover:text-primary-foreground transition-smooth"
            aria-label="إغلاق"
            title="مسح المحادثة"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-bold text-base flex items-center gap-1.5 justify-end">
                <span className="text-brand">(AzaBot)</span>
                <span>عزبوت</span>
              </div>
              <div className="text-xs text-primary-foreground/70 flex items-center gap-1.5 justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                المساعد الذكي - متصل الآن
              </div>
            </div>
            <div className="w-11 h-11 rounded-full bg-brand flex items-center justify-center shrink-0">
              <img src={azabotLogo} alt="AzaBot" className="w-8 h-8" />
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-border bg-card">
          <TabButton active={tab === "text"} onClick={() => setTab("text")} icon={<MessageSquare className="w-4 h-4" />} label="محادثة نصية" />
          <TabButton active={tab === "voice"} onClick={() => setTab("voice")} icon={<Mic className="w-4 h-4" />} label="محادثة صوتية" />
        </div>

        {/* Voice selector (only visible in voice tab) */}
        {tab === "voice" && (
          <div className="px-4 pt-3">
            <button
              onClick={() => setVoiceOpen((o) => !o)}
              className="w-full flex items-center justify-between bg-muted/60 hover:bg-muted transition-smooth rounded-xl px-3 py-2.5 text-sm"
            >
              <ChevronDown className={`w-4 h-4 transition-smooth ${voiceOpen ? "rotate-180" : ""}`} />
              <div className="flex items-center gap-2">
                <span className="text-foreground">{voice.label}</span>
                <span className="text-muted-foreground text-xs">• {voice.desc.split("•")[0].trim()}</span>
                <Volume2 className="w-4 h-4 text-brand" />
              </div>
            </button>
            {voiceOpen && (
              <div className="mt-2 bg-popover border border-border rounded-xl overflow-hidden shadow-bubble animate-fade-in-up">
                {VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { setVoice(v); setVoiceOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/60 transition-smooth text-sm ${voice.id === v.id ? "bg-accent" : ""}`}
                  >
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                    <div className="text-right flex-1 mx-2">
                      <div className="font-semibold text-foreground">{v.label}</div>
                      <div className="text-xs text-muted-foreground">{v.desc}</div>
                    </div>
                    {voice.id === v.id && <span className="text-brand font-bold">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
          {tab === "voice" ? (
            <VoiceView isSpeaking={isSpeaking} onStart={startVoiceInput} streaming={streaming} />
          ) : messages.length === 0 ? (
            <Welcome onPick={(t) => send(t)} />
          ) : (
            <div className="space-y-3">
              {messages.map((m) => (
                <Bubble key={m.id} msg={m} onSpeak={() => speak(m.content)} ttsEnabled={ttsEnabled} />
              ))}
              {streaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
                <TypingDots />
              )}
            </div>
          )}
        </div>

        {/* Pending attachments */}
        {pending.length > 0 && tab === "text" && (
          <div className="px-4 py-2 border-t border-border flex flex-wrap gap-2 bg-muted/30">
            {pending.map((a, i) => (
              <div key={i} className="flex items-center gap-2 bg-card border border-border rounded-lg px-2 py-1 text-xs">
                <button onClick={() => removePending(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
                <span className="text-muted-foreground">({formatBytes(a.size)})</span>
                <span className="text-foreground font-medium truncate max-w-[120px]">{a.name}</span>
                <Paperclip className="w-3 h-3 text-brand" />
              </div>
            ))}
          </div>
        )}

        {/* Footer / Input */}
        <footer className="border-t border-border bg-card p-3">
          {tab === "text" ? (
            <div className="flex items-end gap-2">
              <Button
                size="icon"
                onClick={() => send()}
                disabled={streaming || (!input.trim() && pending.length === 0)}
                className="bg-brand hover:bg-brand-glow text-brand-foreground rounded-xl shrink-0"
                aria-label="إرسال"
              >
                <Send className="w-4 h-4 rotate-180" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="اكتب رسالتك..."
                rows={1}
                className="resize-none min-h-[40px] max-h-32 bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-brand text-right rounded-xl"
              />
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => fileRef.current?.click()}
                className="rounded-xl shrink-0 hover:bg-muted"
                aria-label="إرفاق"
                title="إرفاق ملف"
              >
                <Paperclip className="w-5 h-5 text-muted-foreground" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={downloadChat}
                className="rounded-xl shrink-0 hover:bg-muted"
                aria-label="تحميل"
                title="تحميل المحادثة"
              >
                <Download className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <Button variant="secondary" className="rounded-full text-xs px-4">
                خدمة العملاء
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={isSpeaking ? stopSpeak : () => setTtsEnabled((v) => !v)}
                  className="rounded-xl"
                  title={ttsEnabled ? "إيقاف النطق" : "تشغيل النطق"}
                >
                  {ttsEnabled ? <Volume2 className="w-5 h-5 text-brand" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setTab("text")} className="rounded-xl" title="الكتابة">
                  <MessageSquare className="w-5 h-5 text-muted-foreground" />
                </Button>
                <Button
                  size="icon"
                  onClick={startVoiceInput}
                  className="bg-brand hover:bg-brand-glow text-brand-foreground rounded-xl"
                  disabled={streaming}
                  title="ابدأ التحدّث"
                >
                  <Mic className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            مدعوم بالذكاء الاصطناعي • قد يخطئ أحياناً
          </p>
        </footer>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-smooth relative ${
        active ? "text-brand" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {icon}
      {active && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-brand rounded-full" />}
    </button>
  );
}

function Welcome({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center text-center pt-4 animate-fade-in-up">
      <div className="w-14 h-14 rounded-2xl bg-brand/15 flex items-center justify-center mb-3">
        <MessageSquare className="w-7 h-7 text-brand" />
      </div>
      <h2 className="font-bold text-lg text-foreground">
        مرحباً! أنا عزبوت <span>👋</span>
      </h2>
      <p className="text-sm text-muted-foreground mt-1 mb-4">كيف يمكنني مساعدتك؟</p>
      <div className="grid grid-cols-2 gap-2 w-full">
        {QUICK_ACTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="text-xs text-foreground bg-card border border-border hover:border-brand hover:bg-accent rounded-full px-3 py-2 transition-smooth shadow-bubble"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ msg, onSpeak, ttsEnabled }: { msg: Msg; onSpeak: () => void; ttsEnabled: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 animate-fade-in-up ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-brand text-brand-foreground"
        }`}
      >
        {isUser ? <span className="text-xs font-bold">أنا</span> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`px-3.5 py-2.5 rounded-2xl shadow-bubble text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          }`}
        >
          {msg.content ? (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-2">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          ) : (
            <span className="text-muted-foreground">…</span>
          )}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {msg.attachments.map((a, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1 ${isUser ? "bg-primary-foreground/10" : "bg-card"}`}>
                  <Paperclip className="w-3 h-3" />
                  <span className="truncate flex-1">{a.name}</span>
                  <span className="opacity-70">{formatBytes(a.size)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {!isUser && msg.content && ttsEnabled && (
          <button onClick={onSpeak} className="text-xs text-muted-foreground hover:text-brand flex items-center gap-1 transition-smooth">
            <Volume2 className="w-3 h-3" /> استماع
          </button>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
      <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
    </div>
  );
}

function VoiceView({ isSpeaking, onStart, streaming }: { isSpeaking: boolean; onStart: () => void; streaming: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <button
        onClick={onStart}
        disabled={streaming}
        className={`w-20 h-20 rounded-full bg-brand/15 flex items-center justify-center mb-5 transition-smooth hover:bg-brand/25 ${
          isSpeaking ? "animate-pulse-ring" : ""
        }`}
      >
        <Mic className="w-9 h-9 text-brand" />
      </button>
      <h3 className="font-bold text-foreground">محادثة صوتية مع عزبوت</h3>
      <p className="text-sm text-muted-foreground mt-1">
        {streaming ? "يفكّر…" : isSpeaking ? "يتحدث الآن…" : "اضغط على زر المايك لبدء المحادثة"}
      </p>
    </div>
  );
}
