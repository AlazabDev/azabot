import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function ChatButton({ isOpen, onClick }: ChatButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? "إغلاق المساعد" : "فتح المساعد"}
      aria-expanded={isOpen}
      className={cn(
        "fixed bottom-5 right-5 z-[9999] flex h-14 w-14 items-center justify-center rounded-full text-white transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-[#ffb900]/40 sm:bottom-6 sm:right-6",
        !isOpen && "azab-float-pulse",
      )}
      style={{
        background: isOpen
          ? "linear-gradient(135deg, #1a2280 0%, #030957 100%)"
          : "linear-gradient(135deg, #030957 0%, #1a2280 100%)",
      }}
    >
      <span className="relative flex items-center justify-center">
        <span
          className={cn(
            "absolute transition-all duration-300",
            isOpen ? "rotate-0 opacity-100 scale-100" : "rotate-90 opacity-0 scale-50",
          )}
        >
          <X className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <span
          className={cn(
            "transition-all duration-300",
            isOpen ? "-rotate-90 opacity-0 scale-50" : "rotate-0 opacity-100 scale-100",
          )}
        >
          <MessageCircle className="h-6 w-6" strokeWidth={2.2} />
        </span>
      </span>
      {!isOpen && (
        <span
          className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white"
          style={{ backgroundColor: "#ffb900" }}
          aria-hidden
        />
      )}
    </button>
  );
}
