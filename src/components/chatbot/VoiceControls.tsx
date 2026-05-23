import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceControlsProps {
  isListening: boolean;
  supported: boolean;
  onToggle: () => void;
}

export function VoiceControls({
  isListening,
  supported,
  onToggle,
}: VoiceControlsProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!supported}
      aria-label={isListening ? "إيقاف التسجيل" : "بدء التسجيل الصوتي"}
      aria-pressed={isListening}
      title={
        !supported
          ? "المتصفح لا يدعم التحويل الصوتي"
          : isListening
            ? "إيقاف التسجيل"
            : "بدء التسجيل الصوتي"
      }
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#ffb900] disabled:cursor-not-allowed disabled:opacity-40",
        isListening
          ? "azab-pulse text-white"
          : "text-[#030957] hover:bg-[#030957]/5",
      )}
      style={isListening ? { backgroundColor: "#ffb900" } : undefined}
    >
      {isListening ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}
