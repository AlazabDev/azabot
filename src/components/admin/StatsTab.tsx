import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Card } from "@/components/ui/card";
import { MessageSquare, Users, Calendar, TrendingUp, Loader2 } from "lucide-react";
import { AdminStats } from "@/types/admin";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";

export default function StatsTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi<AdminStats>("stats", { method: "GET" })
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const items = [
    { label: "إجمالي المحادثات", value: stats?.conversations ?? 0, icon: Users, color: "text-brand" },
    { label: "إجمالي الرسائل", value: stats?.messages ?? 0, icon: MessageSquare, color: "text-primary" },
    { label: "محادثات اليوم", value: stats?.today ?? 0, icon: Calendar, color: "text-green-500" },
    { label: "متوسط رسائل/محادثة", value: stats?.avg_messages_per_conversation ?? 0, icon: TrendingUp, color: "text-amber-500" },
  ];

  const daily = (stats?.daily || []).map((d) => ({
    ...d, label: new Date(d.date).toLocaleDateString("ar-EG", { day: "numeric", month: "short" }),
  }));
  const hourly = stats?.hourly || [];
  const topQR = stats?.top_quick_replies || [];
  const maxQR = Math.max(1, ...topQR.map((q) => q.count));

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((it) => (
          <Card key={it.label} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{it.label}</p>
                <p className="text-2xl font-bold mt-1.5 text-foreground">{it.value}</p>
              </div>
              <it.icon className={`w-9 h-9 ${it.color} opacity-70`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Daily chart */}
      <Card className="p-6">
        <h3 className="font-bold mb-4">آخر 14 يوماً</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="grad-c" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-m" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="messages" stroke="hsl(var(--primary))" fill="url(#grad-m)" name="رسائل" />
              <Area type="monotone" dataKey="conversations" stroke="hsl(var(--brand))" fill="url(#grad-c)" name="محادثات" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Hourly */}
        <Card className="p-6">
          <h3 className="font-bold mb-4">توزيع الرسائل بحسب الساعة</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top quick replies */}
        <Card className="p-6">
          <h3 className="font-bold mb-4">أكثر الردود السريعة استخداماً</h3>
          {topQR.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات بعد</p>
          ) : (
            <div className="space-y-3">
              {topQR.map((q) => (
                <div key={q.text}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="truncate">{q.text}</span>
                    <span className="font-bold text-brand">{q.count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand to-brand-glow rounded-full transition-all"
                      style={{ width: `${(q.count / maxQR) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Embed code */}
      <Card className="p-6">
        <h3 className="font-bold mb-2">رابط البوت العائم — تركيب على ووردبريس</h3>
        <p className="text-sm text-muted-foreground mb-3">
          ضع هذا الكود في موقع ووردبريس (Custom HTML / Header & Footer plugin):
        </p>
        <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto" dir="ltr">{`<iframe
  src="${window.location.origin}"
  style="position:fixed;bottom:0;right:0;width:100%;height:100%;border:0;pointer-events:none;z-index:999999;"
  allow="microphone"
  onload="this.style.pointerEvents='auto'"
></iframe>`}</pre>
      </Card>
    </div>
  );
}
