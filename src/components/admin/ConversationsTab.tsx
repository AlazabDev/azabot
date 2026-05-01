import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, adminAssetUrl } from "@/lib/adminApi";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, Paperclip, Search, Trash2, MessageSquare, Send, Download, Radio, UserCog } from "lucide-react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/chat-service";
import { ConversationDetail, ConversationMessage, ConversationSummary, errorMessage } from "@/types/admin";

export default function ConversationsTab() {
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [msgs, setMsgs] = useState<ConversationMessage[]>([]);
  const [adminText, setAdminText] = useState("");
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(true);
  const msgsScrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    adminApi<ConversationSummary[]>("list_conversations", { method: "GET", query: q ? { q } : {} })
      .then(setList)
      .catch((e: unknown) => toast.error(errorMessage(e)));
  }, [q]);

  useEffect(() => { load(); }, [load]);

  // ─── Realtime subscription ───
  useEffect(() => {
    if (!live) return;
    const channel = supabase
      .channel("admin-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: { new: ConversationMessage & { conversation_id: string } }) => {
        const newMsg = payload.new as ConversationMessage & { conversation_id: string };
        if (selected && newMsg.conversation_id === selected.id) {
          setMsgs((prev) => [...prev, newMsg]);
        }
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [live, selected, load]);

  useEffect(() => {
    msgsScrollRef.current?.scrollTo({ top: msgsScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const open = async (c: ConversationSummary) => {
    setSelected(c);
    const r = await adminApi<ConversationDetail>("get_conversation", { method: "GET", query: { id: c.id } });
    setMsgs(r.messages || []);
  };

  const del = async (id: string) => {
    if (!confirm("حذف المحادثة؟")) return;
    await adminApi("delete_conversation", { body: { id } });
    toast.success("تم الحذف");
    if (selected?.id === id) setSelected(null);
    load();
  };

  const toggleTakeover = async (enabled: boolean) => {
    if (!selected) return;
    try {
      const updated = await adminApi<ConversationSummary>("toggle_human_takeover", {
        body: { id: selected.id, enabled },
      });
      setSelected(updated);
      toast.success(enabled ? "تم استلام المحادثة بشرياً — رد AI متوقف" : "تم إعادة المحادثة لـ AI");
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const sendAdmin = async () => {
    const text = adminText.trim();
    if (!selected || !text) return;
    setSending(true);
    try {
      await adminApi("send_admin_message", { body: { conversation_id: selected.id, content: text } });
      setAdminText("");
      toast.success("تم الإرسال");
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setSending(false); }
  };

  const exportCSV = async () => {
    try {
      const data = await adminApi<ConversationSummary[]>("export_conversations", { method: "GET" });
      const rows = [
        ["session_id", "visitor_name", "visitor_email", "messages", "human_takeover", "last_message_at"],
        ...data.map((c) => [
          c.session_id, c.visitor_name || "", c.visitor_email || "",
          String(c.message_count), String(c.human_takeover ? 1 : 0), c.last_message_at,
        ]),
      ];
      const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `conversations-${Date.now()}.csv`;
      a.click();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="ابحث بالاسم/الإيميل/معرف الجلسة" className="pr-10" />
          </div>
          <Button onClick={load}>بحث</Button>
          <Button variant="outline" onClick={exportCSV} className="gap-1.5"><Download className="w-4 h-4" />CSV</Button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md">
            <Radio className={`w-4 h-4 ${live ? "text-green-500 animate-pulse" : "text-muted-foreground"}`} />
            <span className="text-xs">Live</span>
            <Switch checked={live} onCheckedChange={setLive} />
          </div>
        </div>
      </Card>

      <Card className="divide-y divide-border">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">لا توجد محادثات</p>
        ) : list.map((c) => (
          <div key={c.id} className="p-4 flex items-center gap-3 hover:bg-muted/40">
            <MessageSquare className="w-5 h-5 text-brand shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-mono text-xs text-muted-foreground truncate">{c.session_id}</div>
                {c.human_takeover && <Badge variant="default" className="text-[10px] gap-1"><UserCog className="w-3 h-3" />بشري</Badge>}
              </div>
              <div className="text-sm">{c.message_count} رسالة · {new Date(c.last_message_at).toLocaleString("ar-EG")}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => open(c)}>عرض</Button>
            <Button size="icon" variant="ghost" onClick={() => del(c.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <span>محادثة {selected?.session_id?.slice(0, 16)}…</span>
              <div className="ms-auto flex items-center gap-2 text-sm font-normal">
                <Label className="text-xs cursor-pointer">تدخّل بشري</Label>
                <Switch
                  checked={!!selected?.human_takeover}
                  onCheckedChange={toggleTakeover}
                />
              </div>
            </DialogTitle>
          </DialogHeader>

          <div ref={msgsScrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-2 min-h-0">
            {msgs.map((m) => (
              <div key={m.id} className={`p-3 rounded-lg ${m.role === "user" ? "bg-primary/10" : "bg-brand/10"}`}>
                <div className="text-xs font-bold mb-1">{m.role === "user" ? "👤 الزائر" : m.content.startsWith("👨‍💼") ? "👨‍💼 موظف" : "🤖 البوت"}</div>
                <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {m.attachments.map((attachment) => {
                      const href = adminAssetUrl(attachment.download_url || attachment.url);
                      return href ? (
                        <a key={attachment.id || href} href={href} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 rounded-md border border-border bg-background/70 px-3 py-2 text-xs hover:bg-background">
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{formatBytes(attachment.size)}</span>
                          <span className="truncate font-medium">{attachment.name}</span>
                          <Paperclip className="w-3.5 h-3.5 text-brand" />
                        </a>
                      ) : (
                        <div key={attachment.id || attachment.name}
                          className="flex items-center gap-2 rounded-md border border-border bg-background/70 px-3 py-2 text-xs">
                          <span className="text-muted-foreground">{formatBytes(attachment.size)}</span>
                          <span className="truncate font-medium">{attachment.name}</span>
                          <Paperclip className="w-3.5 h-3.5 text-brand" />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString("ar-EG")}</div>
              </div>
            ))}
          </div>

          {/* Admin reply */}
          <div className="border-t p-4 bg-muted/20">
            <div className="flex gap-2">
              <Textarea
                value={adminText} onChange={(e) => setAdminText(e.target.value)}
                placeholder={selected?.human_takeover ? "اكتب رداً للزائر…" : "فعّل التدخل البشري أعلاه ليتوقف رد AI، ثم اكتب رداً"}
                rows={2}
                className="resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendAdmin(); }}
              />
              <Button onClick={sendAdmin} disabled={sending || !adminText.trim()} className="bg-brand text-brand-foreground hover:bg-brand-glow self-end gap-1.5">
                <Send className="w-4 h-4" />إرسال
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Ctrl/⌘ + Enter للإرسال</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Local Label tag (no extra import)
function Label({ children, className = "", ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`text-sm font-medium ${className}`} {...rest}>{children}</label>;
}
