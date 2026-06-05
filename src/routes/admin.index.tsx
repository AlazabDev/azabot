import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Plug, GraduationCap, MessageSquare } from "lucide-react";
import { loadAzureConfig, loadTrainingExamples } from "@/lib/adminConfig";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const [connected, setConnected] = useState(false);
  const [deployment, setDeployment] = useState("");
  const [trainingCount, setTrainingCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    const cfg = loadAzureConfig();
    setConnected(Boolean(cfg.enabled && cfg.endpoint && cfg.apiKey && cfg.deployment));
    setDeployment(cfg.deployment);
    setTrainingCount(loadTrainingExamples().length);
    try {
      const raw = window.localStorage.getItem("azab.chat.messages");
      setMessageCount(raw ? (JSON.parse(raw) as unknown[]).length : 0);
    } catch {
      setMessageCount(0);
    }
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          نظرة عامة على حالة البوت والاتصال مع Azure OpenAI.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">حالة الاتصال</span>
            {connected ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>
          <div className="mt-2 text-lg font-bold">
            {connected ? "متصل بـ Azure OpenAI" : "غير مفعّل"}
          </div>
          {deployment && (
            <div className="mt-1 text-xs text-muted-foreground">
              النشر: <span className="font-mono">{deployment}</span>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">أمثلة التدريب</span>
            <GraduationCap className="h-5 w-5 text-[#ffb900]" />
          </div>
          <div className="mt-2 text-3xl font-bold">{trainingCount}</div>
          <div className="mt-1 text-xs text-muted-foreground">سؤال/جواب محفوظ</div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">رسائل الويدجت</span>
            <MessageSquare className="h-5 w-5 text-[#030957]" />
          </div>
          <div className="mt-2 text-3xl font-bold">{messageCount}</div>
          <div className="mt-1 text-xs text-muted-foreground">رسالة في المحادثة الحالية</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/admin/integration"
          className="group rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:border-[#ffb900]/40 hover:shadow-md"
        >
          <Plug className="h-6 w-6 text-[#030957]" />
          <div className="mt-3 font-bold">إعداد Azure OpenAI</div>
          <div className="mt-1 text-sm text-muted-foreground">
            أدخل الـ Endpoint و API Key وإعدادات النموذج لربط البوت.
          </div>
          <div className="mt-3 text-xs font-semibold text-[#030957] group-hover:text-[#ffb900]">
            فتح الإعدادات ←
          </div>
        </Link>

        <Link
          to="/admin/training"
          className="group rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:border-[#ffb900]/40 hover:shadow-md"
        >
          <GraduationCap className="h-6 w-6 text-[#030957]" />
          <div className="mt-3 font-bold">تدريب البوت</div>
          <div className="mt-1 text-sm text-muted-foreground">
            جرّب البوت مباشرة، عدّل الردود، واحفظها كأمثلة تدريبية.
          </div>
          <div className="mt-3 text-xs font-semibold text-[#030957] group-hover:text-[#ffb900]">
            فتح صفحة التدريب ←
          </div>
        </Link>
      </div>
    </div>
  );
}
