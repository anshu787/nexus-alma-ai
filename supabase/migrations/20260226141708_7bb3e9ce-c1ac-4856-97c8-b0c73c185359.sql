
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  mentorship boolean NOT NULL DEFAULT true,
  referral boolean NOT NULL DEFAULT true,
  event boolean NOT NULL DEFAULT true,
  ai boolean NOT NULL DEFAULT true,
  message boolean NOT NULL DEFAULT true,
  campaign boolean NOT NULL DEFAULT true,
  opportunity boolean NOT NULL DEFAULT true,
  reengagement boolean NOT NULL DEFAULT false,
  general boolean NOT NULL DEFAULT true,
  desktop_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-create preferences for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_preferences
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_preferences();
