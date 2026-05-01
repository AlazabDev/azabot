import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, Bot, Sparkles, CheckCircle2, XCircle, Server } from "lucide-react";
import { AdminSettings, errorMessage } from "@/types/admin";

const MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (سريع ومتوازن)" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (الأسرع والأرخص)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (الأقوى)" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { id: "openai/gpt-5", label: "GPT-5 (الأقوى من OpenAI)" },
];

export default function GeneralTab() {
  const [s, setS] = useState<AdminSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [rasaTest, setRasaTest] = useState<{ ok: boolean; status?: number; duration_ms?: number; error?: string; response?: string } | null>(null);

  useEffect(() => {
    adminApi<AdminSettings>("get_settings", { method: "GET" })
      .then(setS)
      .catch((e: unknown) => toast.error(errorMessage(e)));
  }, []);

  const upd = <K extends keyof AdminSettings>(k: K, v: AdminSettings[K]) => {
    setS((p) => (p ? { ...p, [k]: v } : p));
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminApi<AdminSettings>("update_settings", { body: s });
      setS(updated);
      toast.success("تم الحفظ");
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const testRasa = async () => {
    if (!s?.rasa_url) return toast.error("أدخل رابط Rasa أولاً");
    setTesting(true);
    setRasaTest(null);
    try {
      const r = await adminApi<typeof rasaTest>("test_rasa", { body: { url: s.rasa_url } });
      setRasaTest(r);
      if (r?.ok) toast.success(`اتصال ناجح (${r.duration_ms}ms)`);
      else toast.error(r?.error || `فشل الاتصال (${r?.status})`);
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setTesting(false); }
  };

  if (!s) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* ─── Engine ─── */}
      <Card className="p-6 space-y-4 border-brand/30">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-brand" />
          <h3 className="font-bold text-lg">محرك المحادثة</h3>
          <Badge variant="outline" className="ms-auto">{s.engine === "rasa" ? "Rasa Pro" : "Lovable AI"}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => upd("engine", "lovable")}
            className={`p-4 rounded-lg border-2 text-right transition ${s.engine === "lovable" ? "border-brand bg-brand/5" : "border-border hover:border-brand/40"}`}
          >
            <div className="flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4 text-brand" /><span className="font-bold">Lovable AI</span></div>
            <p className="text-xs text-muted-foreground">Gemini / GPT — جاهز فوراً، يدعم Streaming</p>
          </button>
          <button
            type="button"
            onClick={() => upd("engine", "rasa")}
            className={`p-4 rounded-lg border-2 text-right transition ${s.engine === "rasa" ? "border-brand bg-brand/5" : "border-border hover:border-brand/40"}`}
          >
            <div className="flex items-center gap-2 mb-1"><Server className="w-4 h-4 text-brand" /><span className="font-bold">Rasa Pro Self-hosted</span></div>
            <p className="text-xs text-muted-foreground">سيرفرك الخاص — تحكم كامل بالنوايا والـ flows</p>
          </button>
        </div>

        {s.engine === "rasa" && (
          <div className="space-y-3 pt-2 border-t">
            <div>
              <Label>رابط سيرفر Rasa</Label>
              <Input
                dir="ltr"
                value={s.rasa_url}
                onChange={(e) => upd("rasa_url", e.target.value)}
                placeholder="https://rasa.example.com"
                className="mt-1.5 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                سيُضاف تلقائياً <code dir="ltr">/webhooks/rest/webhook</code>
              </p>
            </div>
            <div>
              <Label>مهلة الاتصال (مللي ثانية)</Label>
              <Input
                type="number" min={1000} max={60000} step={1000}
                value={s.rasa_timeout_ms}
                onChange={(e) => upd("rasa_timeout_ms", Number(e.target.value))}
                className="mt-1.5"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={testRasa} disabled={testing} variant="outline" size="sm">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                اختبار الاتصال
              </Button>
              {rasaTest && (
                <Badge variant={rasaTest.ok ? "default" : "destructive"} className="gap-1">
                  {rasaTest.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {rasaTest.ok ? `${rasaTest.duration_ms}ms` : (rasaTest.error || `HTTP ${rasaTest.status}`)}
                </Badge>
              )}
            </div>
            {rasaTest?.response && (
              <pre dir="ltr" className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">{rasaTest.response}</pre>
            )}
          </div>
        )}

        {s.engine === "lovable" && (
          <div className="pt-2 border-t">
            <Label>النموذج</Label>
            <Select value={s.ai_model} onValueChange={(v) => upd("ai_model", v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Label className="mt-3 block">شخصية البوت (System Prompt)</Label>
            <Textarea
              value={s.system_prompt} onChange={(e) => upd("system_prompt", e.target.value)}
              rows={5} className="mt-1.5 font-mono text-sm"
            />
          </div>
        )}
      </Card>

      {/* ─── الهوية والمظهر ─── */}
      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-lg">الهوية والمظهر</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>اسم البوت</Label>
            <Input value={s.bot_name} onChange={(e) => upd("bot_name", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>اللون الأساسي</Label>
            <div className="flex gap-2 mt-1.5">
              <Input type="color" value={s.primary_color} onChange={(e) => upd("primary_color", e.target.value)} className="w-16 p-1" />
              <Input value={s.primary_color} onChange={(e) => upd("primary_color", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>موضع الزر العائم</Label>
            <Select value={s.position} onValueChange={(v) => upd("position", v as AdminSettings["position"])}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="right">يمين</SelectItem>
                <SelectItem value="left">يسار</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>نمط الفقاعات</Label>
            <Select value={s.bubble_style} onValueChange={(v) => upd("bubble_style", v as AdminSettings["bubble_style"])}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="modern">عصري (مدوّر)</SelectItem>
                <SelectItem value="classic">كلاسيكي</SelectItem>
                <SelectItem value="compact">مدمج</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>عنوان فرعي للهيدر (مثل: متصل الآن • نرد خلال دقائق)</Label>
            <Input value={s.header_subtitle} onChange={(e) => upd("header_subtitle", e.target.value)} className="mt-1.5" />
          </div>
          <div className="md:col-span-2">
            <Label>رابط صورة الأفاتار (اختياري)</Label>
            <Input dir="ltr" value={s.avatar_url} onChange={(e) => upd("avatar_url", e.target.value)} placeholder="https://..." className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label>رسالة الترحيب</Label>
          <Textarea value={s.welcome_message} onChange={(e) => upd("welcome_message", e.target.value)} className="mt-1.5" rows={2} />
        </div>
        <div>
          <Label>الردود السريعة (سطر لكل رد)</Label>
          <Textarea
            value={(s.quick_replies || []).join("\n")}
            onChange={(e) => upd("quick_replies", e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))}
            className="mt-1.5" rows={4}
          />
        </div>
        <div className="grid md:grid-cols-3 gap-3 pt-2">
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
            <Label className="cursor-pointer">شارة Powered by</Label>
            <Switch checked={s.show_branding} onCheckedChange={(v) => upd("show_branding", v)} />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
            <Label className="cursor-pointer">صوت إشعار</Label>
            <Switch checked={s.sound_enabled} onCheckedChange={(v) => upd("sound_enabled", v)} />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
            <Label className="cursor-pointer">السماح بتدخّل بشري</Label>
            <Switch checked={s.allow_human_takeover} onCheckedChange={(v) => upd("allow_human_takeover", v)} />
          </div>
        </div>
      </Card>

      {/* ─── الصوت ─── */}
      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-lg">الصوت</h3>
        <div className="flex items-center justify-between">
          <Label>تفعيل الميزات الصوتية</Label>
          <Switch checked={s.voice_enabled} onCheckedChange={(v) => upd("voice_enabled", v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label>نطق ردود البوت تلقائياً</Label>
          <Switch checked={s.auto_speak} onCheckedChange={(v) => upd("auto_speak", v)} />
        </div>
        <div>
          <Label>لغة الصوت الافتراضية</Label>
          <Select value={s.voice_name} onValueChange={(v) => upd("voice_name", v)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ar-SA">العربية (السعودية)</SelectItem>
              <SelectItem value="ar-EG">العربية (مصر)</SelectItem>
              <SelectItem value="en-US">English (US)</SelectItem>
              <SelectItem value="en-GB">English (UK)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* ─── ساعات العمل ─── */}
      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-lg">ساعات العمل</h3>
        <div className="flex items-center justify-between">
          <Label>تفعيل الرد خارج الدوام</Label>
          <Switch checked={s.business_hours_enabled} onCheckedChange={(v) => upd("business_hours_enabled", v)} />
        </div>
        {s.business_hours_enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>من</Label>
                <Input type="time" value={s.business_hours?.start || "09:00"}
                  onChange={(e) => upd("business_hours", { ...s.business_hours, start: e.target.value })}
                  className="mt-1.5" />
              </div>
              <div>
                <Label>إلى</Label>
                <Input type="time" value={s.business_hours?.end || "18:00"}
                  onChange={(e) => upd("business_hours", { ...s.business_hours, end: e.target.value })}
                  className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>رسالة خارج ساعات العمل</Label>
              <Textarea value={s.offline_message} onChange={(e) => upd("offline_message", e.target.value)} rows={2} className="mt-1.5" />
            </div>
          </>
        )}
      </Card>

      <div className="flex justify-end sticky bottom-4">
        <Button onClick={save} disabled={saving} className="bg-brand hover:bg-brand-glow text-brand-foreground gap-2 shadow-chat">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ التغييرات
        </Button>
      </div>
    </div>
  );
}
