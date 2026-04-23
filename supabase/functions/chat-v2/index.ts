/**
 * AzaBot — Chat API v2
 * Supabase Edge Function (Deno)
 * POST /functions/v1/chat-v2
 * Body: { messages: [{role, content}], siteId?: string, origin?: string }
 */

interface SiteConfig {
  id: string;
  name: string;
  domains: string[];
  botPersona: string;
  allowedOrigins: string[];
  systemPrompt: string;
}

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };
type RequestBody = { messages?: unknown; siteId?: string; origin?: string };

const SITE_CONFIGS: Record<string, SiteConfig> = {
  "luxury-finishing": {
    id: "luxury-finishing",
    name: "الأعزب للتشطيبات الفاخرة",
    domains: ["luxury-finishing.alazab.com"],
    botPersona: "عزبوت التشطيبات",
    allowedOrigins: ["https://luxury-finishing.alazab.com"],
    systemPrompt: `أنت "عزبوت"، المساعد الذكي لشركة الأعزب للتشطيبات الفاخرة في مصر.
تخصصك الكامل: التشطيبات السكنية والتجارية الفاخرة، الديكور الداخلي، الرخام، الجرانيت، الأسقف المستعارة، دهانات ديكور.
ردودك بالعربية الفصحى السهلة. كن مختصراً ومحترفاً.`,
  },

  "brand-identity": {
    id: "brand-identity",
    name: "الأعزب للهوية البصرية",
    domains: ["brand-identity.alazab.com"],
    botPersona: "عزبوت الهوية",
    allowedOrigins: ["https://brand-identity.alazab.com"],
    systemPrompt: `أنت "عزبوت"، المساعد الذكي لشركة الأعزب للهوية البصرية والتصميم الإبداعي.
خدماتنا: تصميم الشعارات، الهوية البصرية الكاملة، المطبوعات، تصميم المواقع، التسويق الرقمي، التغليف.
ردودك بالعربية افتراضياً، وبالإنجليزية إذا كتب المستخدم بها.`,
  },

  uberfix: {
    id: "uberfix",
    name: "UberFix للصيانة",
    domains: ["uberfix.alazab.com"],
    botPersona: "UberBot",
    allowedOrigins: ["https://uberfix.alazab.com"],
    systemPrompt: `You are "UberBot", the smart assistant for UberFix — professional maintenance services in Egypt.
Services: Plumbing, Electrical, AC repair/installation, Carpentry, Painting, General home fixes.
Respond in Arabic by default. English if user writes in English.`,
  },

  "laban-alasfour": {
    id: "laban-alasfour",
    name: "لبن العصفور",
    domains: ["laban-alasfour.alazab.com"],
    botPersona: "مساعد لبن العصفور",
    allowedOrigins: ["https://laban-alasfour.alazab.com"],
    systemPrompt: `أنت "مساعد لبن العصفور"، المساعد الذكي لمتجر لبن العصفور — متجر متخصص في المنتجات المعمارية.
المتجر يعمل على تصميم وعرض الوحدات باستخدام تقنيات الواقع الافتراضي (VR) لتمكين العميل من تجربة المنتج قبل التنفيذ.

الخدمات:
- عرض المنتجات المعمارية ثلاثي الأبعاد
- تجربة الواقع الافتراضي (VR)
- تخصيص المنتجات حسب المساحة والاحتياج
- توريد المنتجات للمشاريع السكنية والتجارية

مهمتك:
- مساعدة العميل في اختيار المنتج المناسب
- شرح تجربة الـ VR بشكل مبسط
- توجيه العميل للمنتج أو القسم المناسب
- جمع احتياجات العميل (المساحة، الاستخدام، النمط)

قواعد مهمة:
- لا تذكر أي منتجات غذائية نهائيًا
- لا تخترع أسعارًا أو تفاصيل غير مؤكدة
- كن مختصرًا وواضحًا واحترافيًا
- استخدم العربية بشكل أساسي

إذا طلب العميل تصميمًا:
اطلب منه صورًا أو وصفًا للمكان، وابدأ توجيهه نحو تجربة VR.`,
  },

  alazab: {
    id: "alazab",
    name: "مجموعة الأعزب",
    domains: ["alazab.com", "www.alazab.com", "chat.alazab.com"],
    botPersona: "عزبوت",
    allowedOrigins: [
      "https://alazab.com",
      "https://www.alazab.com",
      "https://chat.alazab.com",
    ],
    systemPrompt: `أنت "عزبوت"، المساعد الذكي لمجموعة الأعزب — مجموعة شركات متنوعة.
شركاتنا:
1. الأعزب للتشطيبات الفاخرة
2. الأعزب للهوية البصرية
3. UberFix للصيانة
4. لبن العصفور للمنتجات المعمارية وتجربة VR

مهمتك توجيه العملاء للقسم المناسب وتقديم معلومات عامة عن المجموعة.
ردودك بالعربية الفصحى السهلة. كن مرحبًا واحترافيًا.`,
  },
};

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://172.27.48.1:8080",
];

const ALL_ALLOWED_ORIGINS = [
  ...new Set([
    ...Object.values(SITE_CONFIGS).flatMap((s) => s.allowedOrigins),
    ...DEV_ORIGINS,
  ]),
];

const rlMap = new Map<string, { count: number; resetAt: number }>();

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, X-Site-ID, x-client-info",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && ALL_ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function json(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function errorResponse(
  message: string,
  status: number,
  cors: Record<string, string>,
  code = "UNKNOWN_ERROR",
  details?: unknown,
): Response {
  return json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    status,
    cors,
  );
}

function normalizeOrigin(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

function extractDomainFromOrigin(value?: string | null): string | null {
  const normalized = normalizeOrigin(value);
  if (!normalized) return null;

  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function resolveSite(siteId?: string, origin?: string): SiteConfig {
  if (siteId && SITE_CONFIGS[siteId]) return SITE_CONFIGS[siteId];

  const domain = extractDomainFromOrigin(origin);
  if (domain) {
    for (const cfg of Object.values(SITE_CONFIGS)) {
      if (cfg.domains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
        return cfg;
      }
    }
  }

  return SITE_CONFIGS.alazab;
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

function checkRateLimit(key: string, limit = 40, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rlMap.get(key);

  if (!entry || now > entry.resetAt) {
    rlMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}

function isValidMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;

  const obj = value as Record<string, unknown>;
  return (
    (obj.role === "user" || obj.role === "assistant") &&
    typeof obj.content === "string" &&
    obj.content.trim().length > 0
  );
}

function sanitizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(isValidMessage)
    .map((m) => ({
      role: m.role,
      content: m.content.trim(),
    }))
    .slice(-20);
}

async function parseRequestBody(req: Request): Promise<
  { ok: true; body: RequestBody } | { ok: false; response: Response }
> {
  try {
    const body = await req.json();
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: errorResponse("Invalid JSON body", 400, {}, "INVALID_JSON"),
    };
  }
}

function buildRequestContext(req: Request, body: RequestBody) {
  const headerOrigin = normalizeOrigin(req.headers.get("origin"));
  const bodyOrigin = normalizeOrigin(body.origin);
  const forwardedHost = req.headers.get("x-forwarded-host")?.trim().toLowerCase();
  const derivedOrigin = forwardedHost ? `https://${forwardedHost}` : null;
  const effectiveOrigin = headerOrigin || bodyOrigin || derivedOrigin;

  const siteIdHeader = req.headers.get("x-site-id")?.trim();
  const effectiveSiteId = body.siteId?.trim() || siteIdHeader || undefined;
  const site = resolveSite(effectiveSiteId, effectiveOrigin || undefined);

  return {
    effectiveOrigin,
    site,
  };
}

function ensureOriginAllowed(
  origin: string | null,
  cors: Record<string, string>,
): Response | null {
  if (!origin) {
    return errorResponse(
      "Origin header is missing or invalid.",
      400,
      cors,
      "MISSING_ORIGIN",
    );
  }

  if (!cors["Access-Control-Allow-Origin"]) {
    return errorResponse(
      "Origin is not allowed.",
      403,
      cors,
      "ORIGIN_NOT_ALLOWED",
      { origin },
    );
  }

  return null;
}

function logServerError(
  scope: string,
  error: unknown,
  meta?: Record<string, unknown>,
) {
  console.error(`[chat-v2] ${scope}`, {
    error: error instanceof Error
      ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
      : String(error),
    ...(meta ?? {}),
  });
}

function getDialogflowConfig() {
  const projectId = Deno.env.get("GCP_PROJECT_ID")?.trim();
  const agentId = Deno.env.get("DIALOGFLOW_AGENT_ID")?.trim();
  const location = Deno.env.get("GCP_LOCATION")?.trim() || "global";
  const accessToken = Deno.env.get("GCP_ACCESS_TOKEN")?.trim();

  if (!projectId || !agentId || !accessToken) return null;

  return { projectId, agentId, location, accessToken };
}

function buildDialogflowSessionPath(
  projectId: string,
  location: string,
  agentId: string,
  sessionId: string,
) {
  const base =
    location === "global"
      ? "https://global-dialogflow.googleapis.com"
      : `https://${location}-dialogflow.googleapis.com`;

  return `${base}/v3/projects/${projectId}/locations/${location}/agents/${agentId}/sessions/${sessionId}:detectIntent`;
}

function extractLastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i].content;
    }
  }
  return "";
}

async function callDialogflow(
  site: SiteConfig,
  messages: ChatMessage[],
): Promise<string> {
  const cfg = getDialogflowConfig();
  if (!cfg) {
    throw new Error("DIALOGFLOW_CONFIG_MISSING");
  }

  const lastUserMessage = extractLastUserMessage(messages);
  if (!lastUserMessage) {
    throw new Error("LAST_USER_MESSAGE_MISSING");
  }

  const sessionId = crypto.randomUUID();
  const url = buildDialogflowSessionPath(
    cfg.projectId,
    cfg.location,
    cfg.agentId,
    sessionId,
  );

  const payload = {
    queryInput: {
      text: {
        text: `${site.systemPrompt}\n\nرسالة العميل:\n${lastUserMessage}`,
      },
      languageCode: "ar",
    },
    queryParams: {
      parameters: {
        siteId: site.id,
        siteName: site.name,
        botPersona: site.botPersona,
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();

  let data: Record<string, unknown> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!res.ok) {
    throw new Error(`DIALOGFLOW_HTTP_${res.status}: ${raw}`);
  }

  const queryResult = data.queryResult as Record<string, unknown> | undefined;
  const responseMessages = queryResult?.responseMessages as unknown[] | undefined;

  if (Array.isArray(responseMessages)) {
    for (const item of responseMessages) {
      const textBlock = (item as Record<string, unknown>)?.text as
        | Record<string, unknown>
        | undefined;
      const texts = textBlock?.text as unknown[] | undefined;
      if (Array.isArray(texts) && typeof texts[0] === "string" && texts[0].trim()) {
        return texts[0].trim();
      }
    }
  }

  const match = queryResult?.match as Record<string, unknown> | undefined;
  const intent = match?.intent as Record<string, unknown> | undefined;
  const displayName = intent?.displayName;
  if (typeof displayName === "string" && displayName.trim()) {
    return displayName.trim();
  }

  throw new Error("DIALOGFLOW_EMPTY_RESPONSE");
}

Deno.serve(async (req: Request) => {
  const headerOrigin = normalizeOrigin(req.headers.get("origin"));
  const preflightCors = getCorsHeaders(headerOrigin);

  if (req.method === "OPTIONS") {
    const originCheck = ensureOriginAllowed(headerOrigin, preflightCors);
    if (originCheck) return originCheck;

    return new Response(null, {
      status: 204,
      headers: preflightCors,
    });
  }

  if (req.method !== "POST") {
    return errorResponse(
      "Method not allowed",
      405,
      preflightCors,
      "METHOD_NOT_ALLOWED",
    );
  }

  const parsed = await parseRequestBody(req);
  if (!parsed.ok) {
    const response = parsed.response;
    const mergedHeaders = {
      ...getCorsHeaders(headerOrigin),
      ...Object.fromEntries(response.headers.entries()),
    };

    return new Response(await response.text(), {
      status: response.status,
      headers: mergedHeaders,
    });
  }

  const { body } = parsed;
  const ctx = buildRequestContext(req, body);
  const cors = getCorsHeaders(ctx.effectiveOrigin);

  const originCheck = ensureOriginAllowed(ctx.effectiveOrigin, cors);
  if (originCheck) return originCheck;

  const validMessages = sanitizeMessages(body.messages);
  if (validMessages.length === 0) {
    return errorResponse(
      "messages must be a non-empty array of valid chat messages",
      400,
      cors,
      "INVALID_MESSAGES",
    );
  }

  const clientIP = getClientIp(req);
  const rlKey = `${ctx.site.id}:${clientIP}`;

  if (!checkRateLimit(rlKey, 40)) {
    return errorResponse(
      "تم تجاوز حد الطلبات. حاول بعد دقيقة.",
      429,
      cors,
      "RATE_LIMITED",
    );
  }

  if (!getDialogflowConfig()) {
    return errorResponse(
      "إعدادات Dialogflow غير مكتملة.",
      500,
      cors,
      "DIALOGFLOW_CONFIG_MISSING",
    );
  }

  let reply = "";
  try {
    reply = await callDialogflow(ctx.site, validMessages);
  } catch (error) {
    logServerError("Dialogflow call failed", error, {
      siteId: ctx.site.id,
      origin: ctx.effectiveOrigin,
    });

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("401") || message.includes("403")) {
      return errorResponse(
        "فشل التحقق مع Dialogflow. راجع GCP_ACCESS_TOKEN.",
        502,
        cors,
        "DIALOGFLOW_AUTH_FAILED",
      );
    }

    if (message.includes("429")) {
      return errorResponse(
        "تم تجاوز حد طلبات Dialogflow. حاول لاحقًا.",
        429,
        cors,
        "DIALOGFLOW_RATE_LIMITED",
      );
    }

    return errorResponse(
      "فشل الاتصال بـ Dialogflow أو لم يرجع ردًا صالحًا.",
      502,
      cors,
      "DIALOGFLOW_FAILED",
      { reason: message.slice(0, 1500) },
    );
  }

  return json(
    {
      reply,
      siteId: ctx.site.id,
      botName: ctx.site.botPersona,
    },
    200,
    cors,
  );
});