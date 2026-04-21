
-- =========================================
-- 1. BOT SETTINGS (single row)
-- =========================================
CREATE TABLE public.bot_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bot_name TEXT NOT NULL DEFAULT 'AzaBot',
  primary_color TEXT NOT NULL DEFAULT '#FFB800',
  welcome_message TEXT NOT NULL DEFAULT 'مرحباً! أنا AzaBot، كيف يمكنني مساعدتك اليوم؟',
  quick_replies JSONB NOT NULL DEFAULT '["ما هي خدماتكم؟","كيف أتواصل معكم؟","أريد عرض سعر"]'::jsonb,
  ai_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  system_prompt TEXT NOT NULL DEFAULT 'أنت AzaBot، مساعد ذكي ودود يتحدث بالعربية الفصحى السهلة افتراضياً (وبالإنجليزية إذا خاطبك المستخدم بها). كن مختصراً، واضحاً، ومحترفاً.',
  voice_enabled BOOLEAN NOT NULL DEFAULT true,
  voice_name TEXT NOT NULL DEFAULT 'ar-SA',
  auto_speak BOOLEAN NOT NULL DEFAULT false,
  business_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  business_hours JSONB NOT NULL DEFAULT '{"start":"09:00","end":"18:00","timezone":"Asia/Riyadh","days":[0,1,2,3,4]}'::jsonb,
  offline_message TEXT NOT NULL DEFAULT 'نحن خارج ساعات العمل حالياً. اترك رسالتك وسنرد عليك قريباً.',
  position TEXT NOT NULL DEFAULT 'right' CHECK (position IN ('left','right')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.bot_settings (id) VALUES (1);

ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;

-- Public read of safe fields only — handled via a view
CREATE OR REPLACE VIEW public.bot_settings_public AS
SELECT id, bot_name, primary_color, welcome_message, quick_replies,
       voice_enabled, voice_name, auto_speak,
       business_hours_enabled, business_hours, offline_message, position
FROM public.bot_settings WHERE id = 1;

GRANT SELECT ON public.bot_settings_public TO anon, authenticated;

-- No public policies on bot_settings table itself (service_role bypasses RLS)

-- =========================================
-- 2. CONVERSATIONS
-- =========================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','archived')),
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_session ON public.conversations(session_id);
CREATE INDEX idx_conversations_last_msg ON public.conversations(last_message_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role can access

-- =========================================
-- 3. MESSAGES
-- =========================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role

-- =========================================
-- 4. INTEGRATIONS
-- =========================================
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('webhook','telegram','whatsapp','twilio','slack','email')),
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  events JSONB NOT NULL DEFAULT '["message.created","conversation.started"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_integrations_type_enabled ON public.integrations(type, enabled);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
-- service_role only

-- =========================================
-- 5. WEBHOOK LOGS
-- =========================================
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  event TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','failed','pending')),
  status_code INTEGER,
  request_payload JSONB,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_logs_created ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_integration ON public.webhook_logs(integration_id);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 6. ADMIN AUTH (single row, hashed password)
-- =========================================
CREATE TABLE public.admin_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.admin_auth (id) VALUES (1);

ALTER TABLE public.admin_auth ENABLE ROW LEVEL SECURITY;
-- service_role only — never exposed to client

-- =========================================
-- 7. updated_at trigger
-- =========================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_bot_settings_updated BEFORE UPDATE ON public.bot_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_admin_auth_updated BEFORE UPDATE ON public.admin_auth
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- 8. Increment message_count trigger
-- =========================================
CREATE OR REPLACE FUNCTION public.bump_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
    SET message_count = message_count + 1,
        last_message_at = now()
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_messages_bump AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_on_message();
