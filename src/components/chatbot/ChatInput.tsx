import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Paperclip, Send } from "lucide-react";
import type { ChatFile } from "@/types/chat";
import { fileToChatFile } from "@/lib/chatApi";
import { FileAttachmentPreview } from "./FileAttachmentPreview";
import { VoiceControls } from "./VoiceControls";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];
const ACCEPT_ATTR =
  ".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,image/*";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export interface ChatInputHandle {
  setText: (text: string) => void;
  appendText: (text: string) => void;
  focus: () => void;
}

interface ChatInputProps {
  disabled: boolean;
  isListening: boolean;
  voiceSupported: boolean;
  onSend: (text: string, files: ChatFile[], rawFiles: File[]) => void;
  onToggleVoice: () => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput(
    { disabled, isListening, voiceSupported, onSend, onToggleVoice },
    ref,
  ) {
    const [text, setText] = useState("");
    const [files, setFiles] = useState<ChatFile[]>([]);
    const [rawFiles, setRawFiles] = useState<File[]>([]);
    const [error, setError] = useState<string | null>(null);
    const taRef = useRef<HTMLTextAreaElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      setText: (t: string) => setText(t),
      appendText: (t: string) =>
        setText((prev) => (prev ? `${prev} ${t}` : t).trim()),
      focus: () => taRef.current?.focus(),
    }));

    useEffect(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
    }, [text]);

    const canSend = !disabled && (text.trim().length > 0 || files.length > 0);

    const handleSend = () => {
      if (!canSend) return;
      onSend(text.trim(), files, rawFiles);
      setText("");
      setFiles([]);
      setRawFiles([]);
      setError(null);
    };

    const handleFiles = async (list: FileList | null) => {
      if (!list) return;
      setError(null);
      const accepted: File[] = [];
      const newChatFiles: ChatFile[] = [];
      for (const file of Array.from(list)) {
        const typeOk =
          ACCEPTED_TYPES.includes(file.type) ||
          /\.(pdf|docx|xlsx|csv|txt|png|jpe?g|webp)$/i.test(file.name);
        if (!typeOk) {
          setError(`نوع غير مدعوم: ${file.name}`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          setError(`الحد الأقصى 20MB. تجاوز: ${file.name}`);
          continue;
        }
        accepted.push(file);
        newChatFiles.push(await fileToChatFile(file));
      }
      setRawFiles((prev) => [...prev, ...accepted]);
      setFiles((prev) => [...prev, ...newChatFiles]);
      if (inputRef.current) inputRef.current.value = "";
    };

    const removeFile = (id: string) => {
      const idx = files.findIndex((f) => f.id === id);
      if (idx === -1) return;
      setFiles((prev) => prev.filter((_, i) => i !== idx));
      setRawFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    return (
      <div className="border-t border-black/5 bg-white">
        <FileAttachmentPreview files={files} onRemove={removeFile} />

        {error && (
          <div
            role="alert"
            className="border-t border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-600"
          >
            {error}
          </div>
        )}

        <div className="flex items-end gap-2 p-2.5">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="إرفاق ملفات"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#030957] transition hover:bg-[#030957]/5 focus:outline-none focus:ring-2 focus:ring-[#ffb900]"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <VoiceControls
            isListening={isListening}
            supported={voiceSupported}
            onToggle={onToggleVoice}
          />

          <textarea
            ref={taRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isListening ? "جاري الاستماع..." : "اكتب رسالتك..."}
            aria-label="نص الرسالة"
            className="max-h-[140px] min-h-[38px] flex-1 resize-none rounded-2xl border border-black/10 bg-[#f8f9fc] px-3 py-2 text-sm leading-relaxed text-[#030957] placeholder:text-muted-foreground focus:border-[#ffb900] focus:outline-none focus:ring-2 focus:ring-[#ffb900]/30"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="إرسال"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#ffb900] disabled:cursor-not-allowed disabled:opacity-40",
            )}
            style={{
              backgroundColor: canSend ? "#ffb900" : "#e5e7eb",
              color: "#030957",
            }}
          >
            <Send className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </div>
    );
  },
);
