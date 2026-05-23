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
        "fixed bottom-5 right-5 z-[9999] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[#ffb900]/40",
        "sm:bottom-6 sm:right-6",
      )}
      style={{
        backgroundColor: isOpen ? "#030957" : "#030957",
        boxShadow: "var(--azab-shadow)",
      }}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "linear-gradient(135deg, #030957 0%, #1a2280 100%)",
        }}
        aria-hidden
      />
      <span className="relative">
        {isOpen ? (
          <X className="h-6 w-6" strokeWidth={2.5} />
        ) : (
          <MessageCircle className="h-6 w-6" strokeWidth={2.2} />
        )}
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
