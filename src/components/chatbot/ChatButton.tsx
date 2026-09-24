import { ChevronDown, Maximize2, MessageCircle, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatButtonProps {
  isOpen: boolean;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onOpenChat: () => void;
  onStartCall: () => void;
}

export function ChatButton({
  isOpen,
  isExpanded,
  onExpand,
  onCollapse,
  onOpenChat,
  onStartCall,
}: ChatButtonProps) {
  if (isOpen) return null;

  return (
    <div
      dir="rtl"
      className={cn(
        "fixed bottom-4 right-4 z-[9999] flex items-end justify-end transition-[width,height] duration-300 motion-reduce:transition-none sm:bottom-5 sm:right-5",
        isExpanded ? "h-[118px] w-[min(380px,calc(100vw-2rem))]" : "h-16 w-[92px]",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {isExpanded ? (
        <div className="azab-launcher-expand w-full overflow-hidden rounded-2xl border border-azab-line bg-azab-surface shadow-azab-launcher">
          <div className="flex h-[58px] items-center gap-2 px-3">
            <img src="/astro-bot.gif" alt="" className="h-10 w-10 shrink-0 object-contain" draggable={false} />
            <p className="min-w-0 flex-1 text-sm font-semibold text-azab-navy">هل تحتاج إلى مساعدة؟</p>
            <span className="h-2 w-2 shrink-0 rounded-full bg-azab-online" aria-label="متصل" />
            <Button type="button" variant="ghost" size="icon" onClick={onCollapse} aria-label="تصغير عزبوت" className="h-8 w-8 shrink-0 text-azab-navy hover:bg-azab-soft">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid h-[58px] grid-cols-[minmax(0,1.45fr)_42px_minmax(0,1fr)_42px] gap-2 border-t border-azab-line p-2">
            <Button type="button" onClick={onStartCall} className="h-10 min-w-0 rounded-lg bg-azab-navy px-3 text-xs text-azab-on-navy shadow-none hover:bg-azab-navy-strong">
              <Phone className="h-4 w-4" />
              <span className="truncate">دعم مكالمة</span>
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onOpenChat} aria-label="بدء محادثة" className="h-10 w-10 rounded-lg border-azab-line text-azab-navy hover:bg-azab-soft">
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" onClick={onOpenChat} className="h-10 min-w-0 justify-between rounded-lg border-azab-line px-2 text-xs text-azab-navy hover:bg-azab-soft">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-azab-amber">
                  <img src="/astro-bot.gif" alt="" className="h-5 w-5 object-contain" />
                </span>
                <span className="truncate">عزبوت</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onOpenChat} aria-label="فتح نافذة المحادثة" className="h-10 w-10 rounded-lg border-azab-line text-azab-navy hover:bg-azab-soft">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={onExpand} aria-label="توسيع عزبوت" aria-expanded={false} className="azab-launcher-breathe h-16 w-[92px] gap-1 rounded-2xl border-azab-line bg-azab-surface p-2 text-azab-navy shadow-azab-launcher hover:bg-azab-surface">
          <img src="/astro-bot.gif" alt="عزبوت" className="h-11 w-11 object-contain" draggable={false} />
          <span className="flex h-8 w-6 items-center justify-center rounded-md bg-azab-navy text-azab-on-navy">
            <ChevronDown className="h-4 w-4 rotate-180" />
          </span>
        </Button>
      )}
    </div>
  );
}