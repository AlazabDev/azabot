import { useState } from "react";
import { adminApi, adminToken } from "@/lib/adminApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, Code2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/types/admin";

export default function SecurityTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const change = async () => {
    if (next.length < 6) return toast.error("الحد الأدنى 6 أحرف");
    if (next !== confirm) return toast.error("تأكيد كلمة المرور غير مطابق");
    setLoading(true);
    try {
      await adminApi("change_password", { body: { current_password: current, new_password: next } });
      toast.success("تم تغيير كلمة المرور — سجّل الدخول مجدداً");
      setTimeout(() => { adminToken.clear(); window.location.href = "/admin/login"; }, 1200);
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  };

  // Embed snippet
  const origin = window.location.origin;
  const snippet = `<azabot-convai agent-id="azabot_default"></azabot-convai>
<script src="${origin}/embed/azabot-convai.js" async type="text/javascript"></script>`;
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-5 h-5 text-brand" />
          <h3 className="font-bold">تغيير كلمة مرور الإدارة</h3>
        </div>
        <div className="grid gap-4 max-w-md">
          <div>
            <Label>كلمة المرور الحالية</Label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1.5" autoComplete="current-password" />
          </div>
          <div>
            <Label>كلمة المرور الجديدة</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="mt-1.5" autoComplete="new-password" />
          </div>
          <div>
            <Label>تأكيد كلمة المرور الجديدة</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1.5" autoComplete="new-password" />
          </div>
          <Button onClick={change} disabled={loading} className="bg-brand hover:bg-brand-glow text-brand-foreground gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            تحديث كلمة المرور
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Code2 className="w-5 h-5 text-brand" />
          <h3 className="font-bold">شيفرة التضمين (Embed Snippet)</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          الصق هذا الكود قبل وسم <code dir="ltr">&lt;/body&gt;</code> في أي موقع لإظهار البوت.
        </p>
        <div className="relative">
          <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs overflow-x-auto" dir="ltr">{snippet}</pre>
          <Button size="sm" variant="outline" onClick={copy} className="absolute top-2 left-2 gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "تم النسخ" : "نسخ"}
          </Button>
        </div>
        <div className="mt-4 grid md:grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="font-bold text-foreground mb-1">خصائص اختيارية:</div>
            <ul className="space-y-1">
              <li><code dir="ltr">agent-id</code> — معرّف الوكيل (افتراضي default)</li>
              <li><code dir="ltr">data-position</code> — left أو right</li>
              <li><code dir="ltr">data-color</code> — لون مخصص #hex</li>
            </ul>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="font-bold text-foreground mb-1">مثال متقدم:</div>
            <pre dir="ltr" className="whitespace-pre-wrap">{`<azabot-convai
  agent-id="azabot_1701..."
  data-position="left"
  data-color="#FFB800">
</azabot-convai>`}</pre>
          </div>
        </div>
      </Card>
    </div>
  );
}
