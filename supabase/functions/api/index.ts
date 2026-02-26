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

  const authHeader = req.headers.get("Authorization");
  const apiKey = req.headers.get("x-api-key");
  const hasJwt = authHeader?.startsWith("Bearer ");
  const hasApiKey = apiKey && validateApiKey(apiKey);

  if (!hasJwt && !hasApiKey) {
    return json({ error: "Unauthorized", message: "Provide a Bearer token or x-api-key header" }, 401);
  }

  const rateLimitKey = apiKey || authHeader?.slice(0, 40) || "anon";
  const rl = checkRateLimit(rateLimitKey);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded", retry_after_seconds: rl.resetIn }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.resetIn), "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(rl.resetIn) },
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

  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const resource = pathParts[0] || "";
  const resourceId = pathParts[1] || "";
  const subResource = pathParts[2] || "";
  const method = req.method;

  const effectiveAuth = hasJwt ? authHeader : null;
  const { userClient, adminClient } = getSupabase(effectiveAuth);
  const readClient = hasJwt ? userClient : adminClient;
  const writeClient = userClient;

  try {
    // ── Health ──
    if (resource === "health") {
      return rj({ status: "ok", timestamp: new Date().toISOString(), version: "2.0.0" });
    }

    // ── Me ──
    if (resource === "me") {
      if (!hasJwt) return rj({ error: "/me requires Bearer JWT auth" }, 403);
      const user = await getUser(writeClient);
      if (!user) return rj({ error: "Unauthorized" }, 401);
      const { data: profile } = await writeClient.from("profiles").select("*").eq("user_id", user.id).single();
      const { data: roles } = await writeClient.from("user_roles").select("role").eq("user_id", user.id);
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
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const body = await req.json();
        const { data, error } = await writeClient.from("profiles").update(body).eq("user_id", resourceId).select().single();
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
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const body = await req.json();
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const { data, error } = await writeClient.from("posts").insert({ ...body, user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "DELETE" && resourceId && !subResource) {
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
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await writeClient.from("opportunities").insert({ ...body, posted_by: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const body = await req.json();
        const { data, error } = await writeClient.from("opportunities").update(body).eq("id", resourceId).select().single();
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
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await writeClient.from("campaigns").insert({ ...body, created_by: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const body = await req.json();
        const { data, error } = await writeClient.from("campaigns").update(body).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      // Sub-resource: donations for a campaign
      if (resourceId && subResource === "donations") {
        if (method === "GET") {
          const { data, error } = await readClient.from("donations").select("*").eq("campaign_id", resourceId).order("created_at", { ascending: false });
          if (error) return rj({ error: error.message }, 400);
          return rj(data);
        }
        if (method === "POST") {
          if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
          const user = await getUser(writeClient);
          if (!user) return rj({ error: "Unauthorized" }, 401);
          const body = await req.json();
          const { data, error } = await writeClient.from("donations").insert({ ...body, campaign_id: resourceId, user_id: user.id }).select().single();
          if (error) return rj({ error: error.message }, 400);
          return rj(data, 201);
        }
      }
    }

    // ── Donations ──
    if (resource === "donations") {
      if (!hasJwt) return rj({ error: "Donations require Bearer JWT auth" }, 403);
      if (method === "GET") {
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const { data, error } = await writeClient.from("donations").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── Connections ──
    if (resource === "connections") {
      if (!hasJwt) return rj({ error: "Connections require Bearer JWT auth" }, 403);
      const user = await getUser(writeClient);
      if (!user) return rj({ error: "Unauthorized" }, 401);
      if (method === "GET") {
        const status = url.searchParams.get("status");
        let q = writeClient.from("connections").select("*").or(`source_user_id.eq.${user.id},target_user_id.eq.${user.id}`).order("created_at", { ascending: false });
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await writeClient.from("connections").insert({ ...body, source_user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const body = await req.json();
        const { data, error } = await writeClient.from("connections").update({ status: body.status }).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "DELETE" && resourceId) {
        const { error } = await writeClient.from("connections").delete().eq("id", resourceId);
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
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await writeClient.from("forum_posts").insert({ ...body, user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId && !subResource) {
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const body = await req.json();
        const { data, error } = await writeClient.from("forum_posts").update(body).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "DELETE" && resourceId && !subResource) {
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const { error } = await writeClient.from("forum_posts").delete().eq("id", resourceId);
        if (error) return rj({ error: error.message }, 400);
        return rj({ success: true });
      }
      // Forum replies
      if (resourceId && subResource === "replies") {
        if (method === "GET") {
          const { data, error } = await readClient.from("forum_replies").select("*").eq("post_id", resourceId).order("created_at");
          if (error) return rj({ error: error.message }, 400);
          return rj(data);
        }
        if (method === "POST") {
          if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
          const user = await getUser(writeClient);
          if (!user) return rj({ error: "Unauthorized" }, 401);
          const body = await req.json();
          const { data, error } = await writeClient.from("forum_replies").insert({ content: body.content, post_id: resourceId, user_id: user.id }).select().single();
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
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await writeClient.from("success_stories").insert({ ...body, user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const body = await req.json();
        const { data, error } = await writeClient.from("success_stories").update(body).eq("id", resourceId).select().single();
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
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const user = await getUser(writeClient);
        if (!user) return rj({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await writeClient.from("stories").insert({ ...body, user_id: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "DELETE" && resourceId) {
        if (!hasJwt) return rj({ error: "Write operations require Bearer JWT auth" }, 403);
        const { error } = await writeClient.from("stories").delete().eq("id", resourceId);
        if (error) return rj({ error: error.message }, 400);
        return rj({ success: true });
      }
    }

    // ── Referrals ──
    if (resource === "referrals") {
      if (!hasJwt) return rj({ error: "Referrals require Bearer JWT auth" }, 403);
      const user = await getUser(writeClient);
      if (!user) return rj({ error: "Unauthorized" }, 401);
      if (method === "GET") {
        const { data, error } = await writeClient.from("referral_requests").select("*").order("created_at", { ascending: false });
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
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

    // ── Verification Requests ──
    if (resource === "verification") {
      if (!hasJwt) return rj({ error: "Verification requires Bearer JWT auth" }, 403);
      const user = await getUser(writeClient);
      if (!user) return rj({ error: "Unauthorized" }, 401);
      if (method === "GET") {
        const { data, error } = await writeClient.from("verification_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await writeClient.from("verification_requests").insert({ ...body, user_id: user.id }).select().single();
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
      if (!hasJwt) return rj({ error: "Mailing campaigns require Bearer JWT auth" }, 403);
      const user = await getUser(writeClient);
      if (!user) return rj({ error: "Unauthorized" }, 401);
      if (method === "GET") {
        const { data, error } = await writeClient.from("mailing_campaigns").select("*").order("created_at", { ascending: false });
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
      if (method === "POST") {
        const body = await req.json();
        const { data, error } = await writeClient.from("mailing_campaigns").insert({ ...body, created_by: user.id }).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const body = await req.json();
        const { data, error } = await writeClient.from("mailing_campaigns").update(body).eq("id", resourceId).select().single();
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── User Roles (admin read) ──
    if (resource === "roles") {
      if (!hasJwt) return rj({ error: "Roles require Bearer JWT auth" }, 403);
      if (method === "GET" && resourceId) {
        const { data, error } = await writeClient.from("user_roles").select("*").eq("user_id", resourceId);
        if (error) return rj({ error: error.message }, 400);
        return rj(data);
      }
    }

    // ── 404 ──
    return rj({
      error: "Not Found",
      docs: "/api-docs",
      endpoints: [
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
    }, 404);
  } catch (e) {
    return rj({ error: e.message || "Internal Server Error" }, 500);
  }
});
