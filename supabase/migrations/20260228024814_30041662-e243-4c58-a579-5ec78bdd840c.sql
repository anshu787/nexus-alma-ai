
-- Moderators can delete any post
CREATE POLICY "Moderators can delete any post"
ON public.posts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'moderator'::app_role));

-- Moderators can delete any comment
CREATE POLICY "Moderators can delete any comment"
ON public.comments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'moderator'::app_role));

-- Moderators can delete any forum post
CREATE POLICY "Moderators can delete any forum post"
ON public.forum_posts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'moderator'::app_role));

-- Moderators can delete any forum reply
CREATE POLICY "Moderators can delete any forum reply"
ON public.forum_replies
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'moderator'::app_role));
