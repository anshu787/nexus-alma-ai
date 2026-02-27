
-- Mentor availability slots (mentors add their schedule)
CREATE TABLE public.mentor_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Mentoring Session',
  description TEXT,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_bookings INTEGER NOT NULL DEFAULT 1,
  current_bookings INTEGER NOT NULL DEFAULT 0,
  meeting_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Mentoring session bookings (students book slots)
CREATE TABLE public.mentoring_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  availability_id UUID NOT NULL REFERENCES public.mentor_availability(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked',
  notes TEXT,
  student_message TEXT,
  mentor_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mentor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentoring_sessions ENABLE ROW LEVEL SECURITY;

-- RLS for mentor_availability
CREATE POLICY "Anyone authenticated can view active availability"
  ON public.mentor_availability FOR SELECT
  USING (true);

CREATE POLICY "Mentors can insert their own availability"
  ON public.mentor_availability FOR INSERT
  WITH CHECK (auth.uid() = mentor_id);

CREATE POLICY "Mentors can update their own availability"
  ON public.mentor_availability FOR UPDATE
  USING (auth.uid() = mentor_id);

CREATE POLICY "Mentors can delete their own availability"
  ON public.mentor_availability FOR DELETE
  USING (auth.uid() = mentor_id);

-- RLS for mentoring_sessions
CREATE POLICY "Students and mentors can view their sessions"
  ON public.mentoring_sessions FOR SELECT
  USING (auth.uid() = student_id OR auth.uid() = mentor_id);

CREATE POLICY "Students can book sessions"
  ON public.mentoring_sessions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Mentors can update session status"
  ON public.mentoring_sessions FOR UPDATE
  USING (auth.uid() = mentor_id OR auth.uid() = student_id);

CREATE POLICY "Admins can view all sessions"
  ON public.mentoring_sessions FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'institution_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_mentor_availability_updated_at
  BEFORE UPDATE ON public.mentor_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mentoring_sessions_updated_at
  BEFORE UPDATE ON public.mentoring_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to increment booking count
CREATE OR REPLACE FUNCTION public.increment_booking_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE mentor_availability
  SET current_bookings = current_bookings + 1
  WHERE id = NEW.availability_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_session_booked
  AFTER INSERT ON public.mentoring_sessions
  FOR EACH ROW EXECUTE FUNCTION public.increment_booking_count();

-- Function to decrement on cancel
CREATE OR REPLACE FUNCTION public.decrement_booking_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE mentor_availability
    SET current_bookings = GREATEST(current_bookings - 1, 0)
    WHERE id = NEW.availability_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_session_cancelled
  AFTER UPDATE ON public.mentoring_sessions
  FOR EACH ROW EXECUTE FUNCTION public.decrement_booking_count();
