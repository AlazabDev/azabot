import { createFileRoute, Link } from "@tanstack/react-router";
import { ChatbotWidget } from "@/components/chatbot/ChatbotWidget";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div
      dir="rtl"
      className="min-h-dvh"
      style={{
        background:
          "radial-gradient(1200px 600px at 80% -10%, #fff4cc 0%, transparent 60%), linear-gradient(180deg, #ffffff 0%, #f4f5fb 100%)",
      }}
    >
      <main className="mx-auto flex min-h-dvh max-w-4xl flex-col items-start justify-center px-6 py-16">
        <span
          className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{ backgroundColor: "#fff4cc", color: "#030957" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "#ffb900" }}
          />
          Azab Assistant — Floating Widget
        </span>
        <h1
          className="text-4xl font-bold leading-tight md:text-5xl"
          style={{ color: "#030957" }}
        >
          مساعدك الذكي، جاهز على كل صفحة.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
          اضغط على الزر العائم أسفل يمين الشاشة لبدء محادثة. يدعم العربية
          والإنجليزية، إرفاق الملفات، التحويل الصوتي، وتحميل المحادثة بصيغ
          مختلفة.
        </p>
        <Link
          to="/admin"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#030957] px-4 py-2 text-sm font-semibold text-white hover:bg-[#030957]/90"
        >
          فتح لوحة الإدارة ←
        </Link>
      </main>

      <ChatbotWidget />
    </div>
  );
}
