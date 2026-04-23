/**
 * AzaBot — SitePage
 * ─────────────────────────────────────────────────────────
 * الصفحة الموحدة لكل مواقع عزبوت.
 * تقرأ إعدادات الموقع النشط من SiteContext وتُطبّقها:
 *   • لون العلامة التجارية (CSS variable)
 *   • عنوان الصفحة (document.title)
 *   • تمرير siteId لـ AzaBot
 * ─────────────────────────────────────────────────────────
 */

import { useEffect } from "react";
import { useSite } from "@/context/useSite";
import AzaBot from "@/components/AzaBot";

export default function SitePage() {
  const { site } = useSite();

  /* ── ضبط لون العلامة التجارية ديناميكياً ─────────────── */
  useEffect(() => {
    const root = document.documentElement;
    // حوّل hex → HSL لتوافق CSS variables الخاصة بـ Tailwind
    const hsl = hexToHsl(site.brandColor);
    if (hsl) {
      root.style.setProperty("--brand", hsl);
      root.style.setProperty("--ring", hsl);
    }
    return () => {
      root.style.removeProperty("--brand");
      root.style.removeProperty("--ring");
    };
  }, [site.brandColor]);

  /* ── عنوان الصفحة ─────────────────────────────────────── */
  useEffect(() => {
    const prev = document.title;
    document.title = site.name;
    return () => {
      document.title = prev;
    };
  }, [site.name]);

  return (
    <>
      {/* محتوى الصفحة المضيفة — اختياري */}
      <main
        className="min-h-screen flex items-center justify-center bg-background"
        lang={site.language === "en" ? "en" : "ar"}
        dir={site.language === "en" ? "ltr" : "rtl"}
      >
        <p className="text-muted-foreground text-sm select-none">
          {site.name}
        </p>
      </main>

      {/* البوت العائم — يستقبل siteId من السياق */}
      <AzaBot />
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────

/**
 * يحوّل لون hex (#RRGGBB) إلى سلسلة HSL مقبولة بـ Tailwind
 * مثال: "#F39C12" → "39 91% 50%"
 */
function hexToHsl(hex: string): string | null {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m || m.length < 3) return null;
  const [r, g, b] = m.map((h) => parseInt(h, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
