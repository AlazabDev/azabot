export type Role = "user" | "assistant";

export type ChatStatus = "online" | "thinking" | "listening";

export interface ChatFile {
  id: string;
  name: string;
  size: number;
  type: string;
  /** Optional data URL for previewing images locally. */
  dataUrl?: string;
  /** Remote (Supabase) URL after upload. */
  url?: string;
  /** Storage path within the bucket. */
  path?: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  files?: ChatFile[];
  timestamp: number;
}

export type ExportFormat = "txt" | "json" | "md";
export type ThemeMode = "light" | "dark";

export interface ChatSettingsState {
  voiceReplies: boolean;
  exportFormat: ExportFormat;
  theme: ThemeMode;
}

export interface ChatApiRequestMeta {
  language: "ar" | "en";
  source: "web-widget";
  voiceEnabled: boolean;
}

export interface ChatApiResponse {
  reply: string;
  conversationId: string;
  sources?: unknown[];
  actions?: unknown[];
}
