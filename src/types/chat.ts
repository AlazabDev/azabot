/** AzaBot — Shared TypeScript Types */

export interface Attachment {
  name: string;
  size: number;
  type: string;
}

export interface MessageButton {
  title: string;
  payload?: string;
  url?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  buttons?: MessageButton[];
  ts: number;
  isError?: boolean;
}

/** ما يُرسل فعلياً لـ AI API */
export interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface VoiceOption {
  id: string;
  label: string;
  desc: string;
  lang: string;
  serverVoice?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  external?: boolean;
}

export type ChatTab = "text" | "voice";

export const QUICK_ACTIONS = [
  "ما هي خدمات الشركة؟",
  "أريد عرض سعر تشطيب",
  "ما هي أسعار التشطيب؟",
  "ما هي فروع الشركة؟",
] as const;

export const VOICES: VoiceOption[] = [
  { id: "ar-soft", label: "هادئ", desc: "عربي • ناعم • مريح", lang: "ar-SA", serverVoice: "nova" },
  { id: "ar-warm", label: "دافئ", desc: "عربي • واضح • هادي", lang: "ar-SA", serverVoice: "shimmer" },
  { id: "ar-clear", label: "واضح", desc: "عربي • سريع الفهم", lang: "ar-SA", serverVoice: "sage" },
];

export const NAV_ITEMS: NavItem[] = [
  { label: "مؤسسة الـعـزب", href: "https://linktr.ee/Alazab.co", icon: "📁", external: true },
  { label: "Luxury Finishing", href: "https://luxury-finishing.alazab.com", icon: "🏛", external: true },
  { label: "Brand Identity", href: "https://brand-identity.alazab.com", icon: "🏪", external: true },
  { label: "UberFix", href: "https://uberfix.alazab.com", icon: "🛠", external: true },
  { label: "Laban Alasfour", href: "https://laban-alasfour.alazab.com", icon: "📦", external: true },
  { label: "طلب صيانة", href: "https://uberfix.shop/service-request", icon: "📝", external: true },
  { label: "الشكاوى والمقترحات", href: "https://alazab.com/complaints", icon: "⚠️", external: true },
  { label: "اتصال الطوارئ", href: "tel:0227047955", icon: "🚨", external: true },
  { label: "تواصل معنا", href: "https://alazab.com/contact", icon: "☎️", external: true },
];
