import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

const GREETING = "مرحباً، أنا عزبوت، كيف يمكنني مساعدتك؟";

export function ChatButton({ isOpen, onClick }: ChatButtonProps) {
  const [typed, setTyped] = useState("");
  const [showBubble, setShowBubble] = useState(true);

  // Typewriter effect that loops while the widget is closed.
  useEffect(() => {
    if (isOpen) {
      setShowBubble(false);
      return;
    }
    setShowBubble(true);
    let i = 0;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (cancelled) return;
      if (i <= GREETING.length) {
        setTyped(GREETING.slice(0, i));
        i += 1;
        timeout = setTimeout(tick, 70);
      } else {
        timeout = setTimeout(() => {
          i = 0;
          tick();
        }, 3500);
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isOpen]);

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      {showBubble && !isOpen && (
        <div
          dir="rtl"
          className="azab-pop-in relative max-w-[240px] rounded-2xl bg-white px-3.5 py-2 text-[13px] font-medium text-[#030957] shadow-lg ring-1 ring-black/5"
          style={{ minHeight: 36 }}
        >
          <span className="whitespace-pre-wrap leading-relaxed">
            {typed}
            <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-[#030957]" />
          </span>
          <span
            className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 bg-white ring-1 ring-black/5"
            aria-hidden
          />
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        aria-label={isOpen ? "إغلاق المساعد" : "فتح المساعد"}
        aria-expanded={isOpen}
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-full bg-white shadow-xl ring-2 ring-[#ffb900]/70 transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-[#ffb900]/50",
          // Closed: keep the astro-bot image at its original size.
          // Open: 30% smaller so the close control stays discreet.
          isOpen ? "h-11 w-11" : "h-16 w-16",
          !isOpen && "azab-float-pulse",
        )}
      >
        {isOpen ? (
          <span
            className="flex h-full w-full items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #1a2280 0%, #030957 100%)",
              color: "#fff",
            }}
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </span>
        ) : (
          <img
            src="/astro-bot.gif"
            alt="عزبوت"
            className="h-full w-full object-cover"
            draggable={false}
          />
        )}
        {!isOpen && (
          <span
            className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-white"
            style={{ backgroundColor: "#22c55e" }}
            aria-hidden
          />
        )}
      </button>
    </div>
  );
}
