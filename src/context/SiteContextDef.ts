/**
 * AzaBot — SiteContextDef
 * ─────────────────────────────────────────────────────────
 * تعريف الـ context والـ interface منفصلَين عن المكوّنات
 * ─────────────────────────────────────────────────────────
 */

import { createContext } from "react";
import type { SiteConfig } from "@/config/sites";

export interface SiteContextValue {
  site: SiteConfig;
  /** هل هذا الموقع الرئيسي (alazab)؟ */
  isRoot: boolean;
}

export const SiteContext = createContext<SiteContextValue | null>(null);
