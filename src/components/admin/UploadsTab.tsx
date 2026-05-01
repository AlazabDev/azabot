import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Mic, Paperclip, RefreshCw, Search } from "lucide-react";
import { adminApi, adminAssetUrl } from "@/lib/adminApi";
import { formatBytes } from "@/lib/chat-service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminUpload, errorMessage } from "@/types/admin";
import { toast } from "sonner";

type UploadKind = "" | "file" | "audio";

export default function UploadsTab() {
  const [uploads, setUploads] = useState<AdminUpload[]>([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<UploadKind>("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const query: Record<string, string> = {};
    if (q.trim()) query.q = q.trim();
    if (kind) query.kind = kind;
    adminApi<AdminUpload[]>("list_uploads", { method: "GET", query })
      .then(setUploads)
      .catch((e: unknown) => toast.error(errorMessage(e, "تعذر تحميل الملفات")))
      .finally(() => setLoading(false));
  }, [kind, q]);

  useEffect(() => { load(); }, [load]);

  const filters: Array<{ value: UploadKind; label: string }> = [
    { value: "", label: "الكل" },
    { value: "file", label: "ملفات" },
    { value: "audio", label: "صوتيات" },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="ابحث باسم الملف أو الجلسة أو البراند"
              className="pr-10"
            />
          </div>
          <div className="flex gap-2">
            {filters.map((filter) => (
              <Button
                key={filter.value || "all"}
                type="button"
                variant={kind === filter.value ? "default" : "outline"}
                onClick={() => setKind(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
            <Button type="button" variant="outline" onClick={load} disabled={loading} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </Button>
          </div>
        </div>
      </Card>

      <Card className="divide-y divide-border">
        {uploads.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">لا توجد ملفات مرفوعة حتى الآن</p>
        ) : uploads.map((upload) => {
          const isAudio = upload.kind === "audio";
          const Icon = isAudio ? Mic : FileText;
          const href = adminAssetUrl(upload.download_url || upload.url);
          return (
            <div key={upload.id || href || upload.name} className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center hover:bg-muted/40">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{upload.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(upload.size)} · {upload.content_type || "application/octet-stream"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {upload.brand || "بدون براند"} · {upload.channel || "غير محدد"} · {upload.created_at ? new Date(upload.created_at).toLocaleString("ar-EG") : "بدون تاريخ"}
                  </div>
                  {upload.note && <div className="text-xs text-muted-foreground mt-1 truncate">ملاحظة: {upload.note}</div>}
                </div>
              </div>

              <div className="flex gap-2 lg:justify-end">
                {href ? (
                  <>
                    <Button asChild size="sm" variant="outline" className="gap-2">
                      <a href={href} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-4 h-4" />
                        مشاهدة
                      </a>
                    </Button>
                    <Button asChild size="sm" className="gap-2">
                      <a href={href} download>
                        <Download className="w-4 h-4" />
                        تحميل
                      </a>
                    </Button>
                  </>
                ) : (
                  <Button type="button" size="sm" variant="outline" disabled>
                    غير متاح
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Paperclip className="w-4 h-4" />
        التخزين الحالي محلي على السيرفر مع روابط تحميل إدارية محمية.
      </div>
    </div>
  );
}
