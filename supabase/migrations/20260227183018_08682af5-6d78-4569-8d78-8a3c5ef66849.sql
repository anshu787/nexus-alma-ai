
-- Access codes for voice authentication (maps spoken codes to user JWTs)
CREATE TABLE public.voice_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  access_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.voice_access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own access codes"
  ON public.voice_access_codes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all access codes"
  ON public.voice_access_codes FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Call sessions tracking
CREATE TABLE public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  twilio_call_sid text,
  status text NOT NULL DEFAULT 'initiated',
  call_type text NOT NULL DEFAULT 'inbound',
  intent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  recording_url text,
  transcript text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own call sessions"
  ON public.call_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all call sessions"
  ON public.call_sessions FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'institution_admin'::app_role));

CREATE POLICY "System can insert call sessions"
  ON public.call_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update call sessions"
  ON public.call_sessions FOR UPDATE
  USING (true);

-- Call action logs (API calls made during voice sessions)
CREATE TABLE public.call_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  action text NOT NULL,
  endpoint text,
  request_body jsonb,
  response_status integer,
  response_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view call action logs"
  ON public.call_action_logs FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'institution_admin'::app_role));

CREATE POLICY "System can insert action logs"
  ON public.call_action_logs FOR INSERT
  WITH CHECK (true);

-- Scheduled reminder calls
CREATE TABLE public.scheduled_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  call_type text NOT NULL DEFAULT 'reminder',
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  twilio_call_sid text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own scheduled calls"
  ON public.scheduled_calls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage scheduled calls"
  ON public.scheduled_calls FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "System can insert scheduled calls"
  ON public.scheduled_calls FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update scheduled calls"
  ON public.scheduled_calls FOR UPDATE
  USING (true);

-- Index for quick lookups
CREATE INDEX idx_voice_access_codes_code ON public.voice_access_codes(access_code);
CREATE INDEX idx_call_sessions_user ON public.call_sessions(user_id);
CREATE INDEX idx_call_sessions_status ON public.call_sessions(status);
CREATE INDEX idx_scheduled_calls_scheduled ON public.scheduled_calls(scheduled_at, status);
