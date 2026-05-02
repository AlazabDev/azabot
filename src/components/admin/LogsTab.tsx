import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Download, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { IntegrationLog, errorMessage } from "@/types/admin";

const TYPE_FILTERS = [
  { value: "", label: "الكل" },
  { value: "rasa", label: "Rasa" },
  { value: "webhook", label: "Webhook" },
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "twilio", label: "Twilio" },
];

export default function LogsTab() {
  const [list, setList] = useState<IntegrationLog[]>([]);
  const [type, setType] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const query: Record<string, string> = { limit: "300" };
      if (type) query.type = type;
      if (onlyErrors) query.status = "failed";
      const data = await adminApi<IntegrationLog[]>("list_logs", { method: "GET", query });
      setList(data || []);
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [type, onlyErrors]);

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((l) =>
      JSON.stringify(l.request_payload).toLowerCase().includes(s) ||
      (l.response_body || "").toLowerCase().includes(s) ||
      (l.error_message || "").toLowerCase().includes(s) ||
      (l.event || "").toLowerCase().includes(s),
    );
  }, [list, search]);

  const errorCount = list.filter((l) => l.status === "failed").length;

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    triggerDownload(blob, `azabot-logs-${type || "all"}-${Date.now()}.json`);
  };

  const downloadCSV = () => {
    const headers = ["created_at", "integration_type", "event", "status", "status_code", "error_message", "request_payload", "response_body"];
    const rows = filtered.map((l) => headers.map((h) => {
      const v = (l as unknown as Record<string, unknown>)[h];
      const s = typeof v === "string" ? v : JSON.stringify(v ?? "");
      return `"${s.replace(/"/g, '""')}"`;
    }).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    triggerDownload(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `azabot-logs-${type || "all"}-${Date.now()}.csv`);
  };

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const clearLogs = async () => {
    if (!confirm(`حذف كل سجلات ${type || "جميع الأنواع"}؟`)) return;
    try {
      await adminApi("clear_logs", { body: { type } });
      toast.success("تم الحذف");
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">إجمالي السجلات</div>
          <div className="text-2xl font-bold">{list.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">ناجحة</div>
          <div className="text-2xl font-bold text-green-600">{list.length - errorCount}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">فاشلة</div>
          <div className="text-2xl font-bold text-destructive">{errorCount}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">آخر سجل</div>
          <div className="text-sm font-medium truncate">
            {list[0] ? new Date(list[0].created_at).toLocaleString("ar-EG") : "-"}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Tabs value={type} onValueChange={setType}>
            <TabsList>
              {TYPE_FILTERS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button variant={onlyErrors ? "default" : "outline"} size="sm" onClick={() => setOnlyErrors(!onlyErrors)} className="gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> الأخطاء فقط
          </Button>
          <Input placeholder="بحث في المحتوى…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> تحديث</Button>
          <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5"><Download className="w-3.5 h-3.5" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={downloadJSON} className="gap-1.5"><Download className="w-3.5 h-3.5" /> JSON</Button>
          <Button variant="destructive" size="sm" onClick={clearLogs} className="gap-1.5"><Trash2 className="w-3.5 h-3.5" /> حذف</Button>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">لا توجد سجلات مطابقة</p>
          ) : filtered.map((l) => (
            <details key={l.id} className={`border rounded-lg ${l.status === "failed" ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
              <summary className="p-3 cursor-pointer flex flex-wrap items-center gap-2 list-none">
                <Badge variant={l.status === "success" ? "default" : "destructive"} className={l.status === "success" ? "bg-green-500" : ""}>
                  {l.status === "success" ? "نجح" : "فشل"}
                </Badge>
                <Badge variant="outline" className="text-xs font-mono uppercase">{l.integration_type}</Badge>
                <span className="text-sm flex-1 min-w-0 truncate">{l.event}</span>
                {l.status_code != null && <span className="text-xs text-muted-foreground">HTTP {l.status_code}</span>}
                <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar-EG")}</span>
              </summary>
              <div className="p-3 border-t border-border bg-muted/30 space-y-2 text-xs" dir="ltr">
                {l.error_message && <div className="text-destructive font-mono p-2 bg-destructive/10 rounded">⚠ {l.error_message}</div>}
                <div>
                  <div className="font-bold mb-1">Payload:</div>
                  <pre className="bg-background p-2 rounded overflow-x-auto max-h-48">{JSON.stringify(l.request_payload, null, 2)}</pre>
                </div>
                {l.response_body && (
                  <div>
                    <div className="font-bold mb-1">Response:</div>
                    <pre className="bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48">{l.response_body}</pre>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
