import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── In-memory rate limiter (per-isolate, resets on cold start) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per key/IP

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetIn: number } {
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

// Clean stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) rateLimitMap.delete(k);
  }
}, 30_000);

// ── API Key validation ──
// Accepts either: Bearer JWT (user auth) or x-api-key header (mobile/server API key)
// The API_KEYS secret should be a comma-separated list of valid keys
function validateApiKey(apiKey: string): boolean {
  const validKeys = (Deno.env.get("API_KEYS") || "").split(",").map((k) => k.trim()).filter(Boolean);
  if (validKeys.length === 0) return true; // No API keys configured = skip check (dev mode)
  return validKeys.includes(apiKey);
}

function getSupabase(authHeader: string | null) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader || "" } },
  });

  const adminClient = createClient(url, serviceKey);

  return { userClient, adminClient };
}

async function getUser(userClient: ReturnType<typeof createClient>) {
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Authentication: require either Bearer JWT or x-api-key ──
  const authHeader = req.headers.get("Authorization");
  const apiKey = req.headers.get("x-api-key");
  const hasJwt = authHeader?.startsWith("Bearer ");
  const hasApiKey = apiKey && validateApiKey(apiKey);

  if (!hasJwt && !hasApiKey) {
    return json({
      error: "Unauthorized",
      message: "Provide a Bearer token in Authorization header or a valid x-api-key header",
    }, 401);
  }

  // ── Rate limiting (key by API key or JWT sub) ──
  const rateLimitKey = apiKey || authHeader?.slice(0, 40) || "anon";
  const rl = checkRateLimit(rateLimitKey);
  if (!rl.allowed) {
    return new Response(JSON.stringify({
      error: "Rate limit exceeded",
      retry_after_seconds: rl.resetIn,
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(rl.resetIn),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(rl.resetIn),
      },
    });
  }

  // Add rate limit headers to all responses
  const rateLimitHeaders = {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(rl.resetIn),
  };

  // Override json helper to include rate limit headers
  const rj = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" },
    });

  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const resource = pathParts[0] || "";
  const resourceId = pathParts[1] || "";
  const subResource = pathParts[2] || "";
  const method = req.method;

  // For API key auth without JWT, create a service-level client
  // For JWT auth, create a user-scoped client
  const effectiveAuth = hasJwt ? authHeader : null;
  const { userClient, adminClient } = getSupabase(effectiveAuth);

  // If using API key (no JWT), use admin client for reads, require JWT for writes
  const readClient = hasJwt ? userClient : adminClient;
  const writeClient = userClient; // Always needs JWT for write operations via RLS

  try {
    // ── Health check ──
    if (resource === "health") {
      return rj({ status: "ok", timestamp: new Date().toISOString(), version: "1.0.0" });
    }

    // ── Profiles ──
    if (resource === "profiles") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const search = url.searchParams.get("search") || "";
        let q = readClient.from("profiles").select("*").range(offset, offset + limit - 1).order("full_name");
        if (search) q = q.ilike("full_name", `%${search}%`);
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
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const body = await req.json();
        const { data, error } = await writeClient.from("profiles").update(body).eq("user_id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── Posts (Social Feed) ──
    if (resource === "posts") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const { data, error } = await readClient.from("posts").select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST" && !resourceId) {
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const body = await req.json();
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const { data, error } = await writeClient.from("posts").insert({ ...body, user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "DELETE" && resourceId) {
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const { error } = await writeClient.from("posts").delete().eq("id", resourceId);
        if (error) return rj({ error: error.message }, 400);
        return rj({ success: true });
      }
      if (resourceId && subResource === "likes") {
        if (method === "POST") {
          if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
          const user = await getUser(writeClient);
          if (!user) return rj({ error: "Unauthorized" }, 401);
          const { data, error } = await writeClient.from("post_likes").insert({ post_id: resourceId, user_id: user.id }).select().single();
          if (error) return rj({ error: error.message }, 400);
          return rj(data, 201);
        }
        if (method === "DELETE") {
          if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
          const user = await getUser(writeClient);
          if (!user) return rj({ error: "Unauthorized" }, 401);
          const { error } = await writeClient.from("post_likes").delete().eq("post_id", resourceId).eq("user_id", user.id);
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
          if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
          const user = await getUser(writeClient);
          if (!user) return rj({ error: "Unauthorized" }, 401);
          const body = await req.json();
          const { data, error } = await writeClient.from("comments").insert({ ...body, post_id: resourceId, user_id: user.id }).select().single();
          if (error) return rj({ error: error.message }, 400);
          return rj(data, 201);
        }
      }
    }

    // ── Events ──
    if (resource === "events") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const { data, error } = await readClient.from("events").select("*").order("start_date", { ascending: true }).limit(limit);
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "GET" && resourceId) {
        const { data, error } = await readClient.from("events").select("*").eq("id", resourceId).single();
        if (error) return rj({ error: error.message }, 404);
        return rj(data);
      }
      if (method === "POST" && !resourceId) {
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await writeClient.from("events").insert({ ...body, created_by: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (resourceId && subResource === "rsvp") {
        if (method === "POST") {
          if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
          const user = await getUser(writeClient);
          if (!user) return rj({ error: "Unauthorized" }, 401);
          const body = await req.json();
          const { data, error } = await writeClient.from("event_rsvps").insert({ event_id: resourceId, user_id: user.id, status: body.status || "going" }).select().single();
          if (error) return rj({ error: error.message }, 400);
          return rj(data, 201);
        }
        if (method === "DELETE") {
          if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
          const user = await getUser(writeClient);
          if (!user) return rj({ error: "Unauthorized" }, 401);
          const { error } = await writeClient.from("event_rsvps").delete().eq("event_id", resourceId).eq("user_id", user.id);
          if (error) return rj({ error: error.message }, 400);
          return rj({ success: true });
        }
      }
    }

    // ── Messages ──
    if (resource === "messages") {
      if (!hasJwt) return rj({ error: "Messages require Bearer JWT auth" }, 403);
      if (method === "GET") {
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const partner = url.searchParams.get("partner_id");
        let q = writeClient.from("messages").select("*").order("created_at", { ascending: true });
        if (partner) {
          q = q.or(`and(sender_id.eq.${user.id},receiver_id.eq.${partner}),and(sender_id.eq.${partner},receiver_id.eq.${user.id})`);
        }
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await writeClient.from("messages").insert({ ...body, sender_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const { data, error } = await writeClient.from("messages").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── Notifications ──
    if (resource === "notifications") {
      if (!hasJwt) return rj({ error: "Notifications require Bearer JWT auth" }, 403);
      if (method === "GET") {
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const unreadOnly = url.searchParams.get("unread") === "true";
        let q = writeClient.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);
        if (unreadOnly) q = q.eq("is_read", false);
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "PUT" && resourceId) {
        const { data, error } = await writeClient.from("notifications").update({ is_read: true }).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── Opportunities ──
    if (resource === "opportunities") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const type = url.searchParams.get("type");
        let q = readClient.from("opportunities").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(limit);
        if (type) q = q.eq("type", type);
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await writeClient.from("opportunities").insert({ ...body, posted_by: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
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

    // ── Stories ──
    if (resource === "stories") {
      if (method === "GET") {
        const { data, error } = await readClient.from("stories").select("*").order("created_at", { ascending: false });
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await writeClient.from("stories").insert({ ...body, user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
    }

    // ── Referrals ──
    if (resource === "referrals") {
      if (!hasJwt) return rj({ error: "Referrals require Bearer JWT auth" }, 403);
      if (method === "GET") {
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const { data, error } = await writeClient.from("referral_requests").select("*").order("created_at", { ascending: false });
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await writeClient.from("referral_requests").insert({ ...body, requester_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const body = await req.json();
        const { data, error } = await writeClient.from("referral_requests").update({ status: body.status }).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── Auth (me) ──
    if (resource === "me") {
      if (!hasJwt) return rj({ error: "/me requires Bearer JWT auth" }, 403);
      const user = await getUser(writeClient);
      if (!user) return rj({ error: "Unauthorized" }, 401);
      const { data: profile } = await writeClient.from("profiles").select("*").eq("user_id", user.id).single();
      const { data: roles } = await writeClient.from("user_roles").select("role").eq("user_id", user.id);
      return rj({ user: { id: user.id, email: user.email }, profile, roles: (roles || []).map((r) => r.role) });
    }

    return rj({
      error: "Not Found",
      docs: "/api-docs",
      endpoints: [
        "GET /health",
        "GET/POST /profiles", "GET/PUT /profiles/:userId",
        "GET/POST /posts", "DELETE /posts/:id", "POST/DELETE /posts/:id/likes", "GET/POST /posts/:id/comments",
        "GET/POST /events", "GET /events/:id", "POST/DELETE /events/:id/rsvp",
        "GET/POST /messages", "PUT /messages/:id",
        "GET /notifications", "PUT /notifications/:id",
        "GET/POST /opportunities",
        "GET /institutions", "GET /institutions/:id",
        "GET/POST /stories",
        "GET/POST /referrals", "PUT /referrals/:id",
        "GET /me",
      ],
    }, 404);
  } catch (e) {
    return rj({ error: e.message || "Internal Server Error" }, 500);
  }
});
