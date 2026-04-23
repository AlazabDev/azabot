/**
 * AzaBot — App Root
 * ─────────────────────────────────────────────────────────
 * • SiteProvider يُغلّف كل شيء داخل BrowserRouter
 *   حتى يستطيع useLocation قراءة المسار الحالي
 * • كل وجهة موقع تستخدم <SitePage> التي تستهلك السياق
 * • lazy loading للصفحات غير الحيوية
 * ─────────────────────────────────────────────────────────
 */

import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteProvider } from "@/context/SiteContext";

// Page حيوية — eager
import SitePage from "./pages/SitePage";

// Pages — lazy (تحمّل عند الطلب فقط)
const Admin = lazy(() => import("./pages/Admin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

function PageFallback() {
  return <div className="min-h-screen bg-background" aria-hidden />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" richColors />
        <BrowserRouter>
          {/*
           * SiteProvider داخل BrowserRouter كي يستخدم useLocation
           * لمعرفة المسار الحالي وتحديد الموقع النشط
           */}
          <SiteProvider>
            <Routes>
              {/* ─── وجهات المواقع ───────────────────── */}
              <Route path="/" element={<SitePage />} />
              <Route path="/brand-identity" element={<SitePage />} />
              <Route path="/luxury-finishing" element={<SitePage />} />
              <Route path="/uberfix" element={<SitePage />} />
              <Route path="/laban-alasfour" element={<SitePage />} />

              {/* ─── لوحة الإدارة ─────────────────────── */}
              <Route
                path="/admin"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Admin />
                  </Suspense>
                }
              />
              <Route
                path="/admin/login"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <AdminLogin />
                  </Suspense>
                }
              />

              {/* ─── 404 ──────────────────────────────── */}
              <Route
                path="*"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <NotFound />
                  </Suspense>
                }
              />
            </Routes>
          </SiteProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
