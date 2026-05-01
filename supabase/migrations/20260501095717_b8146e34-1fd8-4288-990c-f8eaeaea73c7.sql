-- 1) Bot settings: engine + UI enhancements
ALTER TABLE public.bot_settings
  ADD COLUMN IF NOT EXISTS engine text NOT NULL DEFAULT 'lovable',
  ADD COLUMN IF NOT EXISTS rasa_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rasa_timeout_ms integer NOT NULL DEFAULT 15000,
  ADD COLUMN IF NOT EXISTS header_subtitle text NOT NULL DEFAULT 'متصل الآن',
  ADD COLUMN IF NOT EXISTS bubble_style text NOT NULL DEFAULT 'modern',
  ADD COLUMN IF NOT EXISTS show_branding boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_human_takeover boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS avatar_url text NOT NULL DEFAULT '';

-- Constrain engine values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bot_settings_engine_check'
  ) THEN
    ALTER TABLE public.bot_settings
      ADD CONSTRAINT bot_settings_engine_check
      CHECK (engine IN ('lovable','rasa'));
  END IF;
END$$;

-- 2) Conversations: human takeover + admin notes
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS human_takeover boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_admin text,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- 3) Recreate public view to include new safe fields (drop & recreate)
DROP VIEW IF EXISTS public.bot_settings_public;
CREATE VIEW public.bot_settings_public
WITH (security_invoker = true)
AS
SELECT
  id,
  bot_name,
  primary_color,
  welcome_message,
  quick_replies,
  position,
  voice_enabled,
  voice_name,
  auto_speak,
  business_hours_enabled,
  business_hours,
  offline_message,
  header_subtitle,
  bubble_style,
  show_branding,
  sound_enabled,
  avatar_url
FROM public.bot_settings
WHERE id = 1;

GRANT SELECT ON public.bot_settings_public TO anon, authenticated;

-- 4) Realtime for live admin dashboard
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END$$;