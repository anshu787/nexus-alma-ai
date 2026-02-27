import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-email, x-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── In-memory rate limiter ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

function checkRateLimit(key: string) {
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(key, entry);
  }
  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  const resetIn = Math.ceil((entry.resetAt - now) / 1000);
  return { allowed: entry.count <= RATE_LIMIT_MAX, remaining, resetIn };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) rateLimitMap.delete(k);
  }
}, 30_000);

// ── API Key validation ──
function validateApiKey(apiKey: string): boolean {
  const validKeys = (Deno.env.get("API_KEYS") || "").split(",").map((k) => k.trim()).filter(Boolean);
  if (validKeys.length === 0) return true;
  return validKeys.includes(apiKey);
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Authenticate via email+password headers. Signs in with Supabase Auth,
 * returns the authenticated user and a client scoped to that user.
 */
async function authWithEmailPassword(email: string, password: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const tempClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await tempClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) return { user: null, userClient: null, session: null, error: error?.message || "Invalid credentials" };
  // Build a user-scoped client with the session token
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { user: data.user, userClient, session: data.session, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const resource = pathParts[0] || "";
  const resourceId = pathParts[1] || "";
  const subResource = pathParts[2] || "";
  const method = req.method;

  // ── Auth endpoints (no auth required) ──
  if (resource === "auth") {
    if (method === "POST" && resourceId === "login") {
      try {
        const body = await req.json();
        const { email, password } = body;
        if (!email || !password) return json({ error: "Email and password are required" }, 400);
        const { user, session, error } = await authWithEmailPassword(email, password);
        if (error || !user || !session) return json({ error: error || "Invalid credentials" }, 401);
        const adminClient = getAdminClient();
        const { data: profile } = await adminClient.from("profiles").select("*").eq("user_id", user.id).single();
        const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", user.id);
        return json({
          user: { id: user.id, email: user.email },
          profile,
          roles: (roles || []).map((r: any) => r.role),
          message: "Login successful. Use x-email and x-password headers for subsequent requests, or use this session info.",
        });
      } catch (e) {
        return json({ error: e.message }, 400);
      }
    }

    if (method === "POST" && resourceId === "signup") {
      try {
        const body = await req.json();
        const { email, password, full_name } = body;
        if (!email || !password || !full_name) return json({ error: "Email, password, and full_name are required" }, 400);
        if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const tempClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
        const { data, error } = await tempClient.auth.signUp({
          email,
          password,
          options: { data: { full_name } },
        });
        if (error) return json({ error: error.message }, 400);
        return json({
          success: true,
          user_id: data.user?.id,
          message: "Account created. Check your email to confirm, then use x-email and x-password headers to authenticate.",
        }, 201);
      } catch (e) {
        return json({ error: e.message }, 400);
      }
    }

    if (method === "POST" && resourceId === "forgot-password") {
      try {
        const body = await req.json();
        if (!body.email) return json({ error: "Email is required" }, 400);
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const tempClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
        const { error } = await tempClient.auth.resetPasswordForEmail(body.email);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true, message: "Password reset email sent" });
      } catch (e) {
        return json({ error: e.message }, 400);
      }
    }

    return json({ error: "Not Found", auth_endpoints: ["POST /auth/login", "POST /auth/signup", "POST /auth/forgot-password"] }, 404);
  }

  // ── Health (no auth) ──
  if (resource === "health") {
    return json({ status: "ok", timestamp: new Date().toISOString(), version: "3.0.0" });
  }

  // ── Authenticate: email+password headers OR x-api-key (read-only) ──
  const email = req.headers.get("x-email");
  const password = req.headers.get("x-password");
  const apiKey = req.headers.get("x-api-key");
  const hasApiKey = apiKey && validateApiKey(apiKey);
  const hasCredentials = email && password;

  if (!hasCredentials && !hasApiKey) {
    return json({
      error: "Unauthorized",
      message: "Provide x-email and x-password headers, or x-api-key header for read-only access",
    }, 401);
  }

  // Rate limit
  const rateLimitKey = email || apiKey || "anon";
  const rl = checkRateLimit(rateLimitKey);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded", retry_after_seconds: rl.resetIn }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.resetIn) },
    });
  }

  const rateLimitHeaders = {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(rl.resetIn),
  };

  const rj = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" },
    });

  // Sign in user if credentials provided
  let user: any = null;
  let userClient: any = null;
  const adminClient = getAdminClient();

  if (hasCredentials) {
    const authResult = await authWithEmailPassword(email!, password!);
    if (authResult.error || !authResult.user) {
      return rj({ error: authResult.error || "Invalid credentials" }, 401);
    }
    user = authResult.user;
    userClient = authResult.userClient;
  }

  // For API key read-only access, use admin client for reads
  const readClient = userClient || adminClient;
  const isReadOnly = !hasCredentials;

  function requireAuth() {
    if (isReadOnly) return rj({ error: "Write operations require x-email and x-password authentication" }, 403);
    if (!user) return rj({ error: "Unauthorized" }, 401);
    return null;
  }

  try {
    // ── Me ──
    if (resource === "me") {
      const denied = requireAuth();
      if (denied) return denied;
      const { data: profile } = await userClient.from("profiles").select("*").eq("user_id", user.id).single();
      const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
      return rj({ user: { id: user.id, email: user.email }, profile, roles: (roles || []).map((r: any) => r.role) });
    }

    // ── Profiles ──
    if (resource === "profiles") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const search = url.searchParams.get("search") || "";
        const department = url.searchParams.get("department") || "";
        const company = url.searchParams.get("company") || "";
        const is_mentor = url.searchParams.get("is_mentor");
        let q = readClient.from("profiles").select("*").range(offset, offset + limit - 1).order("full_name");
        if (search) q = q.ilike("full_name", `%${search}%`);
        if (department) q = q.ilike("department", `%${department}%`);
        if (company) q = q.ilike("company", `%${company}%`);
        if (is_mentor === "true") q = q.eq("is_mentor", true);
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "GET" && resourceId) {
        const { data, error } = await readClient.from("profiles").select("*").eq("user_id", resourceId).single();
        if (error) return rj({ error: error.message }, 404);
        return rj(data);
      }
      if (method === "PUT" && resourceId) {
        const denied = requireAuth();
        if (denied) return denied;
        const body = await req.json();
        const { data, error } = await userClient.from("profiles").update(body).eq("user_id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── Posts ──
    if (resource === "posts") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const { data, error } = await readClient.from("posts").select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "GET" && resourceId && !subResource) {
        const { data, error } = await readClient.from("posts").select("*").eq("id", resourceId).single();
        if (error) return rj({ error: error.message }, 404);
        return rj(data);
      }
      if (method === "POST" && !resourceId) {
        const denied = requireAuth();
        if (denied) return denied;
        const body = await req.json();
        const { data, error } = await userClient.from("posts").insert({ ...body, user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "DELETE" && resourceId && !subResource) {
        const denied = requireAuth();
        if (denied) return denied;
        const { error } = await userClient.from("posts").delete().eq("id", resourceId);
        if (error) return rj({ error: error.message }, 400);
        return rj({ success: true });
      }
      if (resourceId && subResource === "likes") {
        if (method === "POST") {
          const denied = requireAuth();
          if (denied) return denied;
          const { data, error } = await userClient.from("post_likes").insert({ post_id: resourceId, user_id: user.id }).select().single();
          if (error) return rj({ error: error.message }, 400);
          return rj(data, 201);
        }
        if (method === "DELETE") {
          const denied = requireAuth();
          if (denied) return denied;
          const { error } = await userClient.from("post_likes").delete().eq("post_id", resourceId).eq("user_id", user.id);
          if (error) return rj({ error: error.message }, 400);
          return rj({ success: true });
        }
      }
      if (resourceId && subResource === "comments") {
        if (method === "GET") {
          const { data, error } = await readClient.from("comments").select("*").eq("post_id", resourceId).order("created_at");
          if (error) return rj({ error: error.message }, 400);
          return rj(data);
        }
        if (method === "POST") {
          const denied = requireAuth();
          if (denied) return denied;
          const body = await req.json();
          const { data, error } = await userClient.from("comments").insert({ ...body, post_id: resourceId, user_id: user.id }).select().single();
          if (error) return rj({ error: error.message }, 400);
          return rj(data, 201);
        }
      }
    }

    // ── Events ──
    if (resource === "events") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const type = url.searchParams.get("type");
        let q = readClient.from("events").select("*").order("start_date", { ascending: true }).limit(limit);
        if (type) q = q.eq("event_type", type);
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "GET" && resourceId && !subResource) {
        const { data, error } = await readClient.from("events").select("*").eq("id", resourceId).single();
        if (error) return rj({ error: error.message }, 404);
        return rj(data);
      }
      if (method === "POST" && !resourceId) {
        const denied = requireAuth();
        if (denied) return denied;
        const body = await req.json();
        const { data, error } = await userClient.from("events").insert({ ...body, created_by: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (resourceId && subResource === "rsvp") {
        if (method === "POST") {
          const denied = requireAuth();
          if (denied) return denied;
          const body = await req.json();
          const { data, error } = await userClient.from("event_rsvps").insert({ event_id: resourceId, user_id: user.id, status: body.status || "going" }).select().single();
          if (error) return rj({ error: error.message }, 400);
          return rj(data, 201);
        }
        if (method === "DELETE") {
          const denied = requireAuth();
          if (denied) return denied;
          const { error } = await userClient.from("event_rsvps").delete().eq("event_id", resourceId).eq("user_id", user.id);
          if (error) return rj({ error: error.message }, 400);
          return rj({ success: true });
        }
      }
      if (resourceId && subResource === "attendees") {
        if (method === "GET") {
          const { data, error } = await readClient.from("event_rsvps").select("*").eq("event_id", resourceId);
          if (error) return rj({ error: error.message }, 400);
          return rj(data);
        }
      }
    }

    // ── Messages ──
    if (resource === "messages") {
      const denied = requireAuth();
      if (denied) return denied;
      if (method === "GET") {
        const partner = url.searchParams.get("partner_id");
        let q = userClient.from("messages").select("*").order("created_at", { ascending: true });
        if (partner) {
          q = q.or(`and(sender_id.eq.${user.id},receiver_id.eq.${partner}),and(sender_id.eq.${partner},receiver_id.eq.${user.id})`);
        }
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await userClient.from("messages").insert({ ...body, sender_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const { data, error } = await userClient.from("messages").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── Notifications ──
    if (resource === "notifications") {
      const denied = requireAuth();
      if (denied) return denied;
      if (method === "GET") {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const unreadOnly = url.searchParams.get("unread") === "true";
        let q = userClient.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);
        if (unreadOnly) q = q.eq("is_read", false);
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "PUT" && resourceId) {
        const { data, error } = await userClient.from("notifications").update({ is_read: true }).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── Opportunities ──
    if (resource === "opportunities") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const type = url.searchParams.get("type");
        const search = url.searchParams.get("search");
        let q = readClient.from("opportunities").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(limit);
        if (type) q = q.eq("type", type);
        if (search) q = q.ilike("title", `%${search}%`);
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "GET" && resourceId) {
        const { data, error } = await readClient.from("opportunities").select("*").eq("id", resourceId).single();
        if (error) return rj({ error: error.message }, 404);
        return rj(data);
      }
      if (method === "POST") {
        const denied = requireAuth();
        if (denied) return denied;
        const body = await req.json();
        const { data, error } = await userClient.from("opportunities").insert({ ...body, posted_by: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const denied = requireAuth();
        if (denied) return denied;
        const body = await req.json();
        const { data, error } = await userClient.from("opportunities").update(body).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── Campaigns (Fundraising) ──
    if (resource === "campaigns") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const active = url.searchParams.get("active");
        let q = readClient.from("campaigns").select("*").order("created_at", { ascending: false }).limit(limit);
        if (active === "true") q = q.eq("is_active", true);
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "GET" && resourceId && !subResource) {
        const { data, error } = await readClient.from("campaigns").select("*").eq("id", resourceId).single();
        if (error) return rj({ error: error.message }, 404);
        return rj(data);
      }
      if (method === "POST" && !resourceId) {
        const denied = requireAuth();
        if (denied) return denied;
        const body = await req.json();
        const { data, error } = await userClient.from("campaigns").insert({ ...body, created_by: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const denied = requireAuth();
        if (denied) return denied;
        const body = await req.json();
        const { data, error } = await userClient.from("campaigns").update(body).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (resourceId && subResource === "donations") {
        if (method === "GET") {
          const { data, error } = await readClient.from("donations").select("*").eq("campaign_id", resourceId).order("created_at", { ascending: false });
          if (error) return rj({ error: error.message }, 400);
          return rj(data);
        }
        if (method === "POST") {
          const denied = requireAuth();
          if (denied) return denied;
          const body = await req.json();
          const { data, error } = await userClient.from("donations").insert({ ...body, campaign_id: resourceId, user_id: user.id }).select().single();
          if (error) return rj({ error: error.message }, 400);
          return rj(data, 201);
        }
      }
    }

    // ── Donations ──
    if (resource === "donations") {
      const denied = requireAuth();
      if (denied) return denied;
      if (method === "GET") {
        const { data, error } = await userClient.from("donations").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── Connections ──
    if (resource === "connections") {
      const denied = requireAuth();
      if (denied) return denied;
      if (method === "GET") {
        const status = url.searchParams.get("status");
        let q = userClient.from("connections").select("*").or(`source_user_id.eq.${user.id},target_user_id.eq.${user.id}`).order("created_at", { ascending: false });
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await userClient.from("connections").insert({ ...body, source_user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const body = await req.json();
        const { data, error } = await userClient.from("connections").update({ status: body.status }).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "DELETE" && resourceId) {
        const { error } = await userClient.from("connections").delete().eq("id", resourceId);
        if (error) return rj({ error: error.message }, 400);
        return rj({ success: true });
      }
    }

    // ── Forum Posts ──
    if (resource === "forum") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const category = url.searchParams.get("category");
        let q = readClient.from("forum_posts").select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
        if (category) q = q.eq("category", category);
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "GET" && resourceId && !subResource) {
        const { data, error } = await readClient.from("forum_posts").select("*").eq("id", resourceId).single();
        if (error) return rj({ error: error.message }, 404);
        return rj(data);
      }
      if (method === "POST" && !resourceId) {
        const denied = requireAuth();
        if (denied) return denied;
        const body = await req.json();
        const { data, error } = await userClient.from("forum_posts").insert({ ...body, user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId && !subResource) {
        const denied = requireAuth();
        if (denied) return denied;
        const body = await req.json();
        const { data, error } = await userClient.from("forum_posts").update(body).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "DELETE" && resourceId && !subResource) {
        const denied = requireAuth();
        if (denied) return denied;
        const { error } = await userClient.from("forum_posts").delete().eq("id", resourceId);
        if (error) return rj({ error: error.message }, 400);
        return rj({ success: true });
      }
      if (resourceId && subResource === "replies") {
        if (method === "GET") {
          const { data, error } = await readClient.from("forum_replies").select("*").eq("post_id", resourceId).order("created_at");
          if (error) return rj({ error: error.message }, 400);
          return rj(data);
        }
        if (method === "POST") {
          const denied = requireAuth();
          if (denied) return denied;
          const body = await req.json();
          const { data, error } = await userClient.from("forum_replies").insert({ content: body.content, post_id: resourceId, user_id: user.id }).select().single();
          if (error) return rj({ error: error.message }, 400);
          return rj(data, 201);
        }
      }
    }

    // ── Success Stories ──
    if (resource === "success-stories") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const featured = url.searchParams.get("featured");
        let q = readClient.from("success_stories").select("*").order("created_at", { ascending: false }).limit(limit);
        if (featured === "true") q = q.eq("is_featured", true);
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "GET" && resourceId) {
        const { data, error } = await readClient.from("success_stories").select("*").eq("id", resourceId).single();
        if (error) return rj({ error: error.message }, 404);
        return rj(data);
      }
      if (method === "POST") {
        const denied = requireAuth();
        if (denied) return denied;
        const body = await req.json();
        const { data, error } = await userClient.from("success_stories").insert({ ...body, user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const denied = requireAuth();
        if (denied) return denied;
        const body = await req.json();
        const { data, error } = await userClient.from("success_stories").update(body).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── Institutions ──
    if (resource === "institutions") {
      if (method === "GET" && !resourceId) {
        const { data, error } = await readClient.from("institutions").select("*").order("name");
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "GET" && resourceId) {
        const { data, error } = await readClient.from("institutions").select("*").eq("id", resourceId).single();
        if (error) return rj({ error: error.message }, 404);
        return rj(data);
      }
    }

    // ── Stories (24h ephemeral) ──
    if (resource === "stories") {
      if (method === "GET") {
        const { data, error } = await readClient.from("stories").select("*").order("created_at", { ascending: false });
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        const denied = requireAuth();
        if (denied) return denied;
        const body = await req.json();
        const { data, error } = await userClient.from("stories").insert({ ...body, user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "DELETE" && resourceId) {
        const denied = requireAuth();
        if (denied) return denied;
        const { error } = await userClient.from("stories").delete().eq("id", resourceId);
        if (error) return rj({ error: error.message }, 400);
        return rj({ success: true });
      }
    }

    // ── Referrals ──
    if (resource === "referrals") {
      const denied = requireAuth();
      if (denied) return denied;
      if (method === "GET") {
        const { data, error } = await userClient.from("referral_requests").select("*").order("created_at", { ascending: false });
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await userClient.from("referral_requests").insert({ ...body, requester_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const body = await req.json();
        const { data, error } = await userClient.from("referral_requests").update({ status: body.status }).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── Verification Requests ──
    if (resource === "verification") {
      const denied = requireAuth();
      if (denied) return denied;
      if (method === "GET") {
        const { data, error } = await userClient.from("verification_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await userClient.from("verification_requests").insert({ ...body, user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
    }

    // ── Engagement / Leaderboard ──
    if (resource === "leaderboard") {
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const { data, error } = await readClient.from("profiles").select("user_id, full_name, avatar_url, company, designation, engagement_score").order("engagement_score", { ascending: false }).limit(limit);
      if (error) return rj({ error: error.message }, 400);
      return rj(data);
    }

    // ── Mailing Campaigns (admin only via RLS) ──
    if (resource === "mailing-campaigns") {
      const denied = requireAuth();
      if (denied) return denied;
      if (method === "GET") {
        const { data, error } = await userClient.from("mailing_campaigns").select("*").order("created_at", { ascending: false });
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await userClient.from("mailing_campaigns").insert({ ...body, created_by: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const body = await req.json();
        const { data, error } = await userClient.from("mailing_campaigns").update(body).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── User Roles ──
    if (resource === "roles") {
      const denied = requireAuth();
      if (denied) return denied;
      if (method === "GET" && resourceId) {
        const { data, error } = await userClient.from("user_roles").select("*").eq("user_id", resourceId);
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── 404 ──
    return rj({
      error: "Not Found",
      docs: "/api-docs",
      auth_info: "Use x-email and x-password headers for authentication, or x-api-key for read-only access",
      endpoints: {
        auth: ["POST /auth/login (body: {email, password})", "POST /auth/signup (body: {email, password, full_name})", "POST /auth/forgot-password (body: {email})"],
        resources: [
          "GET /health", "GET /me",
          "GET/POST /profiles", "GET/PUT /profiles/:id",
          "GET/POST /posts", "GET/DELETE /posts/:id", "POST/DELETE /posts/:id/likes", "GET/POST /posts/:id/comments",
          "GET/POST /events", "GET /events/:id", "POST/DELETE /events/:id/rsvp", "GET /events/:id/attendees",
          "GET/POST /messages", "PUT /messages/:id",
          "GET /notifications", "PUT /notifications/:id",
          "GET/POST /opportunities", "GET/PUT /opportunities/:id",
          "GET/POST /campaigns", "GET/PUT /campaigns/:id", "GET/POST /campaigns/:id/donations",
          "GET /donations",
          "GET/POST/PUT/DELETE /connections",
          "GET/POST /forum", "GET/PUT/DELETE /forum/:id", "GET/POST /forum/:id/replies",
          "GET/POST /success-stories", "GET/PUT /success-stories/:id",
          "GET /institutions", "GET /institutions/:id",
          "GET/POST/DELETE /stories",
          "GET/POST /referrals", "PUT /referrals/:id",
          "GET/POST /verification",
          "GET /leaderboard",
          "GET/POST/PUT /mailing-campaigns",
          "GET /roles/:userId",
        ],
      },
    }, 404);
  } catch (e) {
    return rj({ error: e.message || "Internal Server Error" }, 500);
  }
});
