/**
 * AzaBot — SiteContext
 * ─────────────────────────────────────────────────────────
 * Context مركزي يوفر إعدادات الموقع النشط لكل المكوّنات
 * يُحل الموقع من: VITE_SITE_ID → مسار URL → اسم النطاق
 * ─────────────────────────────────────────────────────────
 */

import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { resolveSiteConfig, SITE_CONFIGS } from "@/config/sites";
import { CONFIG } from "@/lib/config";
import { SiteContext } from "./SiteContextDef";
import type { SiteContextValue } from "./SiteContextDef";

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const value = useMemo<SiteContextValue>(() => {
    // 1) VITE_SITE_ID من البيئة — الأولوية القصوى
    if (CONFIG.siteId && SITE_CONFIGS[CONFIG.siteId]) {
      const site = SITE_CONFIGS[CONFIG.siteId];
      return { site, isRoot: site.id === "alazab" };
    }

    // 2) مسار URL (pathname) — /luxury-finishing → luxury-finishing
    const pathSegment = location.pathname.replace(/^\//, "").split("/")[0];
    if (pathSegment && SITE_CONFIGS[pathSegment]) {
      const site = SITE_CONFIGS[pathSegment];
      return { site, isRoot: site.id === "alazab" };
    }

    // 3) النطاق الكامل — hostname
    const site = resolveSiteConfig(window.location.hostname);
    return { site, isRoot: site.id === "alazab" };
  }, [location.pathname]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
