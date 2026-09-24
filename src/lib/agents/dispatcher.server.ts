// src/lib/agents/dispatcher.server.ts
// منطق تصنيف النوايا وتبديل الوكلاء وتنفيذ الطلبات على السيرفر
import { createClient } from "@supabase/supabase-js";
import { executeMaintenanceTool } from "../maintenance.server";

export interface AgentRecord {
  id: string;
  name: string;
  role_slug: string;
  description?: string;
  deployment_name: string;
  system_prompt: string;
  allowed_tools: string[];
  keywords: string[];
  is_default: boolean;
}

export interface DispatchRequest {
  message: string;
  conversationId?: string;
  threadId?: string;
  forcedAgentId?: string;
  previousMessages?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface DispatchResult {
  reply: string;
  conversationId: string;
  activeAgent: {
    id: string;
    name: string;
    roleSlug: string;
  };
  agentSwitched: boolean;
  switchReason?: string;
  toolExecuted?: {
    name: string;
    success: boolean;
    data?: any;
  };
}

// 1. استخراج عميل Supabase بصلاحيات السيرفر
function getAdminSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase credentials missing on server");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// 2. جلب جميع الوكلاء المفعلين من قاعدة البيانات مع كاش محلي
let cachedAgents: { data: AgentRecord[]; expiresAt: number } | null = null;

export async function getAvailableAgents(): Promise<AgentRecord[]> {
  const now = Date.now();
  if (cachedAgents && cachedAgents.expiresAt > now) {
    return cachedAgents.data;
  }

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("bot_agents")
    .select("*")
    .eq("is_active", true)
    .order("is_default", { ascending: false });

  if (error || !data || data.length === 0) {
    // خطة بديلة (Fallback) في حال عدم توفر جدول الوكلاء
    const fallback: AgentRecord[] = [
      {
        id: "default-general",
        name: "عزبوت المساعد العام",
        role_slug: "general",
        description: "الإجابة على الاستفسارات العامة والمساعدة الأولية",
        deployment_name: "gpt-4o-mini",
        system_prompt: "أنت عزبوت، المساعد الذكي المعتمد. أجب بدقة واحترافية باللغة العربية.",
        allowed_tools: [],
        keywords: ["مرحبا", "سلام", "خدمات", "مساعدة", "معلومات"],
        is_default: true,
      },
      {
        id: "default-maintenance",
        name: "وكيل الصيانة والبلاغات",
        role_slug: "maintenance",
        description: "تسجيل بلاغات الصيانة ومتابعة حالتها وحجز الفنيين",
        deployment_name: "gpt-4o-mini",
        system_prompt: "أنت وكيل الصيانة في عزبوت. وظيفتك استقبال بلاغات الأعطال واستخراج (الاسم، الجوال، المشكلة، الموقع) ثم استدعاء أدوات بوابة الصيانة.",
        allowed_tools: ["create_maintenance_request", "get_request_status", "cancel_request"],
        keywords: ["صيانة", "عطل", "سباكة", "كهرباء", "تكييف", "مكيف", "تسريب", "بلاغ", "فني", "تتبع", "رقم الطلب"],
        is_default: false,
      },
    ];
    return fallback;
  }

  const mapped: AgentRecord[] = data.map((row) => ({
    id: row.id,
    name: row.name,
    role_slug: row.role_slug || "general",
    description: row.description,
    deployment_name: row.deployment_name || "gpt-4o-mini",
    system_prompt: row.system_prompt || "",
    allowed_tools: Array.isArray(row.allowed_tools) ? row.allowed_tools : [],
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    is_default: Boolean(row.is_default),
  }));

  cachedAgents = { data: mapped, expiresAt: now + 60_000 }; // كاش لمدة دقيقة
  return mapped;
}

// 3. مصنّف النوايا الخفيف لاختيار الوكيل تلقائياً (Edge Intent Classifier)
export function classifyIntent(
  message: string,
  agents: AgentRecord[],
  currentAgentId?: string
): { selectedAgent: AgentRecord; switched: boolean; reason?: string } {
  const normalized = message.toLowerCase();

  // إذا تم اختيار وكيل حالي، فحص هل الرسالة تتطلب تحويلاً قاطعاً
  const maintenanceKeywords = ["عطل", "صيانة", "خربان", "ينقط", "تكييف", "سباك", "كهربائي", "تسريب", "بلاغ", "طلب رقم", "استعلام"];
  const isMaintenanceIntent = maintenanceKeywords.some((kw) => normalized.includes(kw));

  const maintenanceAgent = agents.find((a) => a.role_slug === "maintenance");
  const defaultAgent = agents.find((a) => a.is_default) || agents[0];
  const currentAgent = agents.find((a) => a.id === currentAgentId) || defaultAgent;

  if (isMaintenanceIntent && currentAgent.role_slug !== "maintenance" && maintenanceAgent) {
    return {
      selectedAgent: maintenanceAgent,
      switched: true,
      reason: "تم اكتشاف طلب صيانة أو عطل فني في رسالتك.",
    };
  }

  // فحص بقية الكلمات الدلالية لكل وكيل
  for (const agent of agents) {
    if (agent.keywords && agent.keywords.some((kw) => normalized.includes(kw.toLowerCase()))) {
      if (currentAgent.id !== agent.id) {
        return {
          selectedAgent: agent,
          switched: true,
          reason: `تحويل تلقائي بناءً على موضوع الرسالة (${agent.name}).`,
        };
      }
      return { selectedAgent: agent, switched: false };
    }
  }

  return { selectedAgent: currentAgent, switched: false };
}

// 4. تنفيذ المحادثة مع Azure AI Foundry للوكيل المحدد
export async function executeAgentChat(
  agent: AgentRecord,
  userMessage: string,
  conversationId?: string,
  previousMessages: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<{ text: string; conversationId: string; toolResult?: any }> {
  const endpoint = process.env.AZURE_AI_FOUNDRY_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_AI_FOUNDRY_API_KEY || process.env.AZURE_OPENAI_API_KEY;

  if (!endpoint || !apiKey) {
    return {
      text: "عذراً، محرك الذكاء الاصطناعي غير متصل حالياً بالسيرفر. يرجى التحقق من مفاتيح الربط.",
      conversationId: conversationId || `conv_${Date.now()}`,
    };
  }

  const cleanEndpoint = endpoint.replace(/\/+$/, "");
  const targetUrl = `${cleanEndpoint}/openai/deployments/${agent.deployment_name}/chat/completions?api-version=2024-08-01-preview`;

  // بناء سجل المحادثة مع دمج سياق الوكيل
  const messagesPayload = [
    { role: "system", content: agent.system_prompt },
    ...previousMessages.slice(-6), // الاحتفاظ بآخر 6 رسائل للسياق
    { role: "user", content: userMessage },
  ];

  // إذا كان الوكيل يدعم أدوات الصيانة، نمرر له تعريف الأدوات (Tools Definition)
  const hasMaintenanceTools = agent.allowed_tools.includes("create_maintenance_request");
  const tools = hasMaintenanceTools
    ? [
        {
          type: "function",
          function: {
            name: "create_maintenance_request",
            description: "إنشاء طلب صيانة جديد في بوابة UberFix عند اكتمال بيانات العميل",
            parameters: {
              type: "object",
              properties: {
                customer_name: { type: "string", description: "اسم العميل الكامل" },
                phone: { type: "string", description: "رقم هاتف العميل" },
                service_type: { type: "string", description: "نوع الصيانة: تكييف، سباكة، كهرباء، نظافة..." },
                description: { type: "string", description: "وصف مفصل للعطل أو المشكلة" },
                address: { type: "string", description: "عنوان العميل أو المدينة" },
              },
              required: ["customer_name", "phone", "service_type", "description"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_request_status",
            description: "الاستعلام عن حالة طلب صيانة سابق برقم الطلب",
            parameters: {
              type: "object",
              properties: {
                request_number: { type: "string", description: "رقم الطلب (مثال: AZ-UF-26-09-001090)" },
              },
              required: ["request_number"],
            },
          },
        },
      ]
    : undefined;

  const res = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages: messagesPayload,
      tools: tools && tools.length > 0 ? tools : undefined,
      tool_choice: tools && tools.length > 0 ? "auto" : undefined,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Azure Chat Failure:", res.status, errText);
    return {
      text: "تعذر معالجة الرسالة مع وكيل الخدمة حالياً، يرجى المحاولة لاحقاً.",
      conversationId: conversationId || `conv_${Date.now()}`,
    };
  }

  const json = await res.json();
  const choice = json.choices?.[0];
  const responseMessage = choice?.message;

  // إذا استدعى النموذج أداة صيانة برمجياً (Function Calling)
  if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
    const toolCall = responseMessage.tool_calls[0];
    const fnName = toolCall.function.name;
    const fnArgs = JSON.parse(toolCall.function.arguments || "{}");

    // تنفيذ أداة الصيانة مباشرة عبر السيرفر
    const toolExecResult = await executeMaintenanceTool(fnName, fnArgs);

    let followupText = "";
    if (toolExecResult.success && fnName === "create_maintenance_request") {
      followupText = `تم تسجيل طلب الصيانة بنجاح!\n\nرقم الطلب: **${toolExecResult.data?.request_number || "قيد الإصدار"}**\nرابط المتابعة: ${toolExecResult.data?.track_url || "سيصلك في رسالة نصية"}\n\nسيتواصل معك الفني المختص في أقرب وقت.`;
    } else if (toolExecResult.success && fnName === "get_request_status") {
      followupText = `حالة الطلب (${fnArgs.request_number}): **${toolExecResult.data?.status || "تحت المعالجة"}**\nالمرحلة: ${toolExecResult.data?.workflow_stage || "جاري التعيين"}\nملاحظات: ${toolExecResult.data?.latest_note || "لا توجد ملاحظات جديدة"}`;
    } else {
      followupText = toolExecResult.error || "تمت محاولة معالجة الطلب، يرجى تزويدنا بمزيد من التفاصيل.";
    }

    return {
      text: followupText,
      conversationId: json.id || conversationId || `conv_${Date.now()}`,
      toolResult: { name: fnName, ...toolExecResult },
    };
  }

  return {
    text: responseMessage?.content || "تم استلام رسالتك بنجاح.",
    conversationId: json.id || conversationId || `conv_${Date.now()}`,
  };
}
