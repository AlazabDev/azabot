/* eslint-disable @typescript-eslint/no-explicit-any */
// Web Speech API typings vary across browsers; we use minimal `any` only here.

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor() as SpeechRecognitionLike;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition,
  );
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, lang: "ar" | "en" = "ar"): void {
  if (!isSpeechSynthesisSupported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === "ar" ? "ar-SA" : "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}

export function detectLanguage(text: string): "ar" | "en" {
  return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}
