
-- Fix overly permissive notification insert policy
DROP POLICY "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
