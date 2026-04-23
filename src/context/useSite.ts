/**
 * AzaBot — useSite hook
 * ─────────────────────────────────────────────────────────
 * Hook منفصل لاستخدام SiteContext — مطلوب لـ react-refresh
 * ─────────────────────────────────────────────────────────
 */

import { useContext } from "react";
import { SiteContext } from "./SiteContextDef";
import type { SiteContextValue } from "./SiteContextDef";

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used inside <SiteProvider>");
  return ctx;
}
