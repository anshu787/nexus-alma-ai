
-- Function: log engagement and update profile score
CREATE OR REPLACE FUNCTION public.log_engagement(
  p_user_id uuid,
  p_action text,
  p_points integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO engagement_logs (user_id, action, points, metadata)
  VALUES (p_user_id, p_action, p_points, p_metadata);

  UPDATE profiles
  SET engagement_score = COALESCE(engagement_score, 0) + p_points
  WHERE user_id = p_user_id;
END;
$$;

-- Trigger: on new post (+10)
CREATE OR REPLACE FUNCTION public.on_post_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM log_engagement(NEW.user_id, 'post_created', 10, jsonb_build_object('post_id', NEW.id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_post_engagement
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.on_post_created();

-- Trigger: on event RSVP (+25)
CREATE OR REPLACE FUNCTION public.on_event_rsvp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM log_engagement(NEW.user_id, 'event_rsvp', 25, jsonb_build_object('event_id', NEW.event_id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rsvp_engagement
  AFTER INSERT ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.on_event_rsvp();

-- Trigger: on referral accepted (+75 for requester, +30 for alumni)
CREATE OR REPLACE FUNCTION public.on_referral_status_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    PERFORM log_engagement(NEW.requester_id, 'referral_accepted', 75, jsonb_build_object('referral_id', NEW.id, 'company', NEW.company));
    PERFORM log_engagement(NEW.alumni_id, 'referral_given', 30, jsonb_build_object('referral_id', NEW.id, 'company', NEW.company));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_referral_engagement
  AFTER UPDATE ON public.referral_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_referral_status_change();

-- Trigger: on opportunity posted (+15)
CREATE OR REPLACE FUNCTION public.on_opportunity_posted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.posted_by IS NOT NULL THEN
    PERFORM log_engagement(NEW.posted_by, 'opportunity_posted', 15, jsonb_build_object('opportunity_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opportunity_engagement
  AFTER INSERT ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.on_opportunity_posted();

-- RPC for login engagement (called from frontend)
CREATE OR REPLACE FUNCTION public.log_login_engagement() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_last_login timestamptz;
  v_today date := current_date;
  v_already_logged boolean;
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Check if already logged today
  SELECT EXISTS(
    SELECT 1 FROM engagement_logs
    WHERE user_id = v_user_id AND action = 'daily_login' AND created_at::date = v_today
  ) INTO v_already_logged;

  IF NOT v_already_logged THEN
    PERFORM log_engagement(v_user_id, 'daily_login', 5, '{}'::jsonb);
  END IF;

  -- Update last_login
  UPDATE profiles SET last_login = now() WHERE user_id = v_user_id;
END;
$$;
