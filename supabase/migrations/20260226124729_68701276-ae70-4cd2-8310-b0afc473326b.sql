
-- Allow super admins to manage user roles (insert, update, delete)
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Allow super admins to view all profiles (already allowed by existing SELECT policy)
-- Allow super admins to view all user roles
CREATE POLICY "Super admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));
