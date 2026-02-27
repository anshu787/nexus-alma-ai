-- Fix: Allow authenticated users to insert notifications for ANY user (needed for cross-user notifications like booking confirmations)
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);