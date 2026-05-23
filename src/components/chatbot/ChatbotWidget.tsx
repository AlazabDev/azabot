import { useEffect, useState } from "react";
import type { ChatMessage, ChatSettingsState } from "@/types/chat";
import { ChatButton } from "./ChatButton";
import { ChatWindow } from "./ChatWindow";

const LS_MESSAGES = "azab.chat.messages";
const LS_SETTINGS = "azab.chat.settings";
const LS_CONV_ID = "azab.chat.conversationId";

const DEFAULT_SETTINGS: ChatSettingsState = {
  voiceReplies: false,
  exportFormat: "txt",
  theme: "light",
};

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<ChatSettingsState>(DEFAULT_SETTINGS);
  const [conversationId, setConversationId] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMessages(loadJSON<ChatMessage[]>(LS_MESSAGES, []));
    setSettings(loadJSON<ChatSettingsState>(LS_SETTINGS, DEFAULT_SETTINGS));
    let id = window.localStorage.getItem(LS_CONV_ID);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(LS_CONV_ID, id);
    }
    setConversationId(id);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(LS_MESSAGES, JSON.stringify(messages));
  }, [messages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (conversationId) {
      window.localStorage.setItem(LS_CONV_ID, conversationId);
    }
  }, [conversationId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme, hydrated]);

  if (!hydrated) return null;

  return (
    <>
      <ChatWindow
        open={open}
        messages={messages}
        setMessages={setMessages}
        conversationId={conversationId}
        setConversationId={setConversationId}
        settings={settings}
        setSettings={setSettings}
        onClose={() => setOpen(false)}
      />
      <ChatButton isOpen={open} onClick={() => setOpen((v) => !v)} />
    </>
  );
}
