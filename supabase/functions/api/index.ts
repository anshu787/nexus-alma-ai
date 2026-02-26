import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabase(authHeader: string | null) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Authenticated client (uses user's JWT for RLS)
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader || "" } },
  });

  // Admin client (bypasses RLS — use carefully)
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

  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const resource = pathParts[0] || "";
  const resourceId = pathParts[1] || "";
  const subResource = pathParts[2] || "";
  const method = req.method;
  const authHeader = req.headers.get("Authorization");
  const { userClient, adminClient } = getSupabase(authHeader);

  try {
    // ── Profiles ──
    if (resource === "profiles") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const search = url.searchParams.get("search") || "";
        let q = userClient.from("profiles").select("*").range(offset, offset + limit - 1).order("full_name");
        if (search) q = q.ilike("full_name", `%${search}%`);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "GET" && resourceId) {
        const { data, error } = await userClient.from("profiles").select("*").eq("user_id", resourceId).single();
        if (error) return json({ error: error.message }, 404);
        return json(data);
      }
      if (method === "PUT" && resourceId) {
        const body = await req.json();
        const { data, error } = await userClient.from("profiles").update(body).eq("user_id", resourceId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
    }

    // ── Posts (Social Feed) ──
    if (resource === "posts") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const { data, error } = await userClient.from("posts").select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "POST" && !resourceId) {
        const body = await req.json();
        const user = await getUser(userClient);
        if (!user) return json({ error: "Unauthorized" }, 401);
        const { data, error } = await userClient.from("posts").insert({ ...body, user_id: user.id }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
      if (method === "DELETE" && resourceId) {
        const { error } = await userClient.from("posts").delete().eq("id", resourceId);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }
      // Likes sub-resource
      if (resourceId && subResource === "likes") {
        if (method === "POST") {
          const user = await getUser(userClient);
          if (!user) return json({ error: "Unauthorized" }, 401);
          const { data, error } = await userClient.from("post_likes").insert({ post_id: resourceId, user_id: user.id }).select().single();
          if (error) return json({ error: error.message }, 400);
          return json(data, 201);
        }
        if (method === "DELETE") {
          const user = await getUser(userClient);
          if (!user) return json({ error: "Unauthorized" }, 401);
          const { error } = await userClient.from("post_likes").delete().eq("post_id", resourceId).eq("user_id", user.id);
          if (error) return json({ error: error.message }, 400);
          return json({ success: true });
        }
      }
      // Comments sub-resource
      if (resourceId && subResource === "comments") {
        if (method === "GET") {
          const { data, error } = await userClient.from("comments").select("*").eq("post_id", resourceId).order("created_at");
          if (error) return json({ error: error.message }, 400);
          return json(data);
        }
        if (method === "POST") {
          const user = await getUser(userClient);
          if (!user) return json({ error: "Unauthorized" }, 401);
          const body = await req.json();
          const { data, error } = await userClient.from("comments").insert({ ...body, post_id: resourceId, user_id: user.id }).select().single();
          if (error) return json({ error: error.message }, 400);
          return json(data, 201);
        }
      }
    }

    // ── Events ──
    if (resource === "events") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const { data, error } = await userClient.from("events").select("*").order("start_date", { ascending: true }).limit(limit);
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "GET" && resourceId) {
        const { data, error } = await userClient.from("events").select("*").eq("id", resourceId).single();
        if (error) return json({ error: error.message }, 404);
        return json(data);
      }
      if (method === "POST" && !resourceId) {
        const user = await getUser(userClient);
        if (!user) return json({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await userClient.from("events").insert({ ...body, created_by: user.id }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
      // RSVP
      if (resourceId && subResource === "rsvp") {
        if (method === "POST") {
          const user = await getUser(userClient);
          if (!user) return json({ error: "Unauthorized" }, 401);
          const body = await req.json();
          const { data, error } = await userClient.from("event_rsvps").insert({ event_id: resourceId, user_id: user.id, status: body.status || "going" }).select().single();
          if (error) return json({ error: error.message }, 400);
          return json(data, 201);
        }
        if (method === "DELETE") {
          const user = await getUser(userClient);
          if (!user) return json({ error: "Unauthorized" }, 401);
          const { error } = await userClient.from("event_rsvps").delete().eq("event_id", resourceId).eq("user_id", user.id);
          if (error) return json({ error: error.message }, 400);
          return json({ success: true });
        }
      }
    }

    // ── Messages ──
    if (resource === "messages") {
      if (method === "GET") {
        const user = await getUser(userClient);
        if (!user) return json({ error: "Unauthorized" }, 401);
        const partner = url.searchParams.get("partner_id");
        let q = userClient.from("messages").select("*").order("created_at", { ascending: true });
        if (partner) {
          q = q.or(`and(sender_id.eq.${user.id},receiver_id.eq.${partner}),and(sender_id.eq.${partner},receiver_id.eq.${user.id})`);
        }
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "POST") {
        const user = await getUser(userClient);
        if (!user) return json({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await userClient.from("messages").insert({ ...body, sender_id: user.id }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const { data, error } = await userClient.from("messages").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", resourceId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
    }

    // ── Notifications ──
    if (resource === "notifications") {
      if (method === "GET") {
        const user = await getUser(userClient);
        if (!user) return json({ error: "Unauthorized" }, 401);
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const unreadOnly = url.searchParams.get("unread") === "true";
        let q = userClient.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);
        if (unreadOnly) q = q.eq("is_read", false);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "PUT" && resourceId) {
        const { data, error } = await userClient.from("notifications").update({ is_read: true }).eq("id", resourceId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
    }

    // ── Opportunities ──
    if (resource === "opportunities") {
      if (method === "GET" && !resourceId) {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const type = url.searchParams.get("type");
        let q = userClient.from("opportunities").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(limit);
        if (type) q = q.eq("type", type);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "POST") {
        const user = await getUser(userClient);
        if (!user) return json({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await userClient.from("opportunities").insert({ ...body, posted_by: user.id }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
    }

    // ── Institutions ──
    if (resource === "institutions") {
      if (method === "GET" && !resourceId) {
        const { data, error } = await userClient.from("institutions").select("*").order("name");
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "GET" && resourceId) {
        const { data, error } = await userClient.from("institutions").select("*").eq("id", resourceId).single();
        if (error) return json({ error: error.message }, 404);
        return json(data);
      }
    }

    // ── Stories ──
    if (resource === "stories") {
      if (method === "GET") {
        const { data, error } = await userClient.from("stories").select("*").order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "POST") {
        const user = await getUser(userClient);
        if (!user) return json({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await userClient.from("stories").insert({ ...body, user_id: user.id }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
    }

    // ── Referrals ──
    if (resource === "referrals") {
      if (method === "GET") {
        const user = await getUser(userClient);
        if (!user) return json({ error: "Unauthorized" }, 401);
        const { data, error } = await userClient.from("referral_requests").select("*").order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (method === "POST") {
        const user = await getUser(userClient);
        if (!user) return json({ error: "Unauthorized" }, 401);
        const body = await req.json();
        const { data, error } = await userClient.from("referral_requests").insert({ ...body, requester_id: user.id }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
      if (method === "PUT" && resourceId) {
        const body = await req.json();
        const { data, error } = await userClient.from("referral_requests").update({ status: body.status }).eq("id", resourceId).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
    }

    // ── Auth (me) ──
    if (resource === "me") {
      const user = await getUser(userClient);
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: profile } = await userClient.from("profiles").select("*").eq("user_id", user.id).single();
      const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
      return json({ user: { id: user.id, email: user.email }, profile, roles: (roles || []).map((r) => r.role) });
    }

    return json({ error: "Not Found", endpoints: [
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
    ] }, 404);
  } catch (e) {
    return json({ error: e.message || "Internal Server Error" }, 500);
  }
});
