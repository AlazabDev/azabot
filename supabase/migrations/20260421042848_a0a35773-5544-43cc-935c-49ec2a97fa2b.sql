
DROP VIEW IF EXISTS public.bot_settings_public;

CREATE VIEW public.bot_settings_public
WITH (security_invoker = true) AS
SELECT id, bot_name, primary_color, welcome_message, quick_replies,
       voice_enabled, voice_name, auto_speak,
       business_hours_enabled, business_hours, offline_message, position
FROM public.bot_settings WHERE id = 1;

GRANT SELECT ON public.bot_settings_public TO anon, authenticated;

-- Allow public to read the safe row through the view
CREATE POLICY "Public can read bot settings via view"
  ON public.bot_settings FOR SELECT
  TO anon, authenticated
  USING (id = 1);
