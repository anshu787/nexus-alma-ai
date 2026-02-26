import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Create user
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: "guptadrishti37@gmail.com",
    password: "Alumni@2026secure",
    email_confirm: true,
  });

  if (userError) {
    return new Response(JSON.stringify({ error: userError.message }), { status: 400 });
  }

  const userId = userData.user.id;

  // Assign super_admin role
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id" });

  return new Response(JSON.stringify({ success: true, userId, roleError: roleError?.message }), {
    headers: { "Content-Type": "application/json" },
  });
});
