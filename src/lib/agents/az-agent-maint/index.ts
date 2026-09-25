import { buildPrompt } from "../az-model-core/prompt";
import type { AgentDefinition } from "../az-model-core/types";

export const maintAgent: AgentDefinition = {
  slug: "maint",
  id: "az-agent-maint",
  name: "وكيل خدمات الصيانة",
  description: "تسجيل بلاغات الصيانة والاستعلام عن حالتها",
  keywords: ["صيانة", "عطل", "خربان", "تسريب", "ينقط", "سباكة", "سباك", "كهرباء", "كهربائي", "تكييف", "مكيف", "بلاغ", "فني", "رقم الطلب", "حالة الطلب"],
  prompt: buildPrompt(`أنت وكيل الصيانة. عند بلاغ عطل اجمع: اسم العميل، رقم الجوال، نوع الخدمة، وصف المشكلة، والعنوان إن أمكن، ثم استدعِ create_maintenance_request.
للاستعلام اطلب رقم الطلب ثم استدعِ get_request_status.
لا تقل إن الطلب سُجّل ما لم تنجح الأداة، واعرض رقم الطلب ورابط المتابعة حرفياً.`),
  tools: ["create_maintenance_request", "get_request_status", "add_request_note", "cancel_request"],
};
