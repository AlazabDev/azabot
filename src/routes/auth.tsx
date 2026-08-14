import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AuthSearch = { reason?: "signin" | "forbidden" | "error" };

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const reason = search.reason;
    return reason === "forbidden" || reason === "error" || reason === "signin"
      ? { reason }
      : {};
  },
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — عزبوت" },
      { name: "description", content: "تسجيل الدخول للوصول إلى لوحة تحكم عزبوت." },
      { property: "og:title", content: "تسجيل الدخول — عزبوت" },
      { property: "og:description", content: "تسجيل الدخول للوصول إلى لوحة تحكم عزبوت." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { reason } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    reason === "forbidden"
      ? "هذا الحساب لا يملك صلاحية مدير للوصول إلى لوحة التحكم."
      : reason === "error"
        ? "تعذر التحقق من الصلاحيات حاليًا. حاول مرة أخرى."
        : null,
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setSignedInEmail(data.user?.email ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      if (import.meta.env.DEV) console.error("[auth] signIn failed", signInError);
      setError(
        signInError.message.toLowerCase().includes("confirm")
          ? "لم يتم تأكيد البريد الإلكتروني بعد."
          : "بيانات الدخول غير صحيحة.",
      );
      return;
    }
    navigate({ to: "/admin", replace: true });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSignedInEmail(null);
    setError(null);
  };

  return (
    <div dir="rtl" className="flex min-h-dvh items-center justify-center bg-[#f4f5fb] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold text-[#030957]">تسجيل الدخول</h1>
        <p className="mt-1 text-sm text-muted-foreground">للوصول إلى لوحة تحكم البوت.</p>

        <label className="mt-5 block text-xs font-semibold text-[#030957]">
          البريد الإلكتروني
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#ffb900]"
            dir="ltr"
          />
        </label>

        <label className="mt-3 block text-xs font-semibold text-[#030957]">
          كلمة المرور
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#ffb900]"
            dir="ltr"
          />
        </label>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#030957] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          دخول
        </button>
      </form>
    </div>
  );
}
