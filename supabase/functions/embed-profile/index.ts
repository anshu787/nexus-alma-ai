import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Simple hash for change detection
function hashProfile(p: any): string {
  const str = JSON.stringify({
    skills: p.skills || [],
    industry: p.industry || "",
    designation: p.designation || "",
    company: p.company || "",
    experience_years: p.experience_years || 0,
    interests: p.interests || [],
    department: p.department || "",
    is_mentor: p.is_mentor || false,
    is_hiring: p.is_hiring || false,
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

// Generate embedding using Lovable AI (text → structured vector via tool calling)
async function generateEmbedding(profileText: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `You are a profile embedding generator. Given a professional profile, generate a 64-dimensional normalized vector that captures the semantic meaning of the person's skills, industry, role, and experience. Each dimension should be a float between -1 and 1.`,
        },
        { role: "user", content: profileText },
      ],
      tools: [{
        type: "function",
        function: {
          name: "store_embedding",
          description: "Store the generated 64-dimensional embedding vector",
          parameters: {
            type: "object",
            properties: {
              vector: {
                type: "array",
                items: { type: "number" },
                description: "64-dimensional embedding vector with values between -1 and 1"
              }
            },
            required: ["vector"],
            additionalProperties: false
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "store_embedding" } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("AI embedding error:", response.status, text);
    throw new Error(`AI error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No embedding returned");
  
  const args = JSON.parse(toolCall.function.arguments);
  const vector = args.vector;
  if (!Array.isArray(vector) || vector.length === 0) throw new Error("Invalid embedding");
  
  // Normalize
  const magnitude = Math.sqrt(vector.reduce((sum: number, v: number) => sum + v * v, 0));
  return magnitude > 0 ? vector.map((v: number) => v / magnitude) : vector;
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

  const authHeader = req.headers.get("Authorization");
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader || "" } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  try {
    const { action, user_id, target_role } = await req.json();

    // ACTION: embed — generate/update embedding for a user
    if (action === "embed") {
      const uid = user_id;
      if (!uid) return json({ error: "user_id required" }, 400);

      const { data: profile, error } = await adminClient
        .from("profiles")
        .select("*")
        .eq("user_id", uid)
        .single();
      if (error || !profile) return json({ error: "Profile not found" }, 404);

      const newHash = hashProfile(profile);

      // Check if embedding already exists with same hash
      const { data: existing } = await adminClient
        .from("user_embeddings")
        .select("profile_hash")
        .eq("user_id", uid)
        .single();

      if (existing?.profile_hash === newHash) {
        return json({ message: "Embedding already up to date", hash: newHash });
      }

      const profileText = [
        `Skills: ${(profile.skills || []).join(", ")}`,
        `Industry: ${profile.industry || "unknown"}`,
        `Role: ${profile.designation || "unknown"}`,
        `Company: ${profile.company || "unknown"}`,
        `Experience: ${profile.experience_years || 0} years`,
        `Department: ${profile.department || "unknown"}`,
        `Interests: ${(profile.interests || []).join(", ")}`,
        `Mentor: ${profile.is_mentor ? "yes" : "no"}`,
        `Hiring: ${profile.is_hiring ? "yes" : "no"}`,
        `Location: ${profile.location || "unknown"}`,
      ].join(" | ");

      const vector = await generateEmbedding(profileText, LOVABLE_API_KEY);

      // Upsert embedding
      const { error: upsertError } = await adminClient
        .from("user_embeddings")
        .upsert({
          user_id: uid,
          embedding: vector,
          profile_hash: newHash,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) return json({ error: upsertError.message }, 400);
      return json({ message: "Embedding generated", dimensions: vector.length, hash: newHash });
    }

    // ACTION: match — find top matches for a user
    if (action === "match") {
      const uid = user_id;
      if (!uid) return json({ error: "user_id required" }, 400);

      const { data: userEmb } = await adminClient
        .from("user_embeddings")
        .select("embedding")
        .eq("user_id", uid)
        .single();

      if (!userEmb) return json({ error: "No embedding found. Generate one first." }, 404);

      const userVector = userEmb.embedding as number[];

      // Get all other embeddings
      const { data: allEmbs } = await adminClient
        .from("user_embeddings")
        .select("user_id, embedding")
        .neq("user_id", uid);

      if (!allEmbs || allEmbs.length === 0) return json({ matches: [] });

      // Calculate similarities
      const similarities = allEmbs.map((e) => ({
        user_id: e.user_id,
        similarity: cosineSimilarity(userVector, e.embedding as number[]),
      }));

      // Sort and get top matches
      similarities.sort((a, b) => b.similarity - a.similarity);
      const topMatches = similarities.slice(0, 10);

      // Get profiles for matches
      const matchIds = topMatches.map((m) => m.user_id);
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, full_name, company, designation, industry, skills, location, is_mentor, is_hiring, avatar_url")
        .in("user_id", matchIds);

      const results = topMatches.map((m) => {
        const profile = profiles?.find((p) => p.user_id === m.user_id);
        return { ...m, profile };
      }).filter((m) => m.profile);

      // Filter by target_role if provided (mentor matching)
      let filtered = results;
      if (target_role === "mentor") {
        filtered = results.filter((m) => m.profile?.is_mentor);
      }

      return json({ matches: filtered });
    }

    // ACTION: career_path — predict career progression
    if (action === "career_path") {
      const uid = user_id;
      if (!uid) return json({ error: "user_id required" }, 400);

      const { data: profile } = await adminClient
        .from("profiles")
        .select("*")
        .eq("user_id", uid)
        .single();
      if (!profile) return json({ error: "Profile not found" }, 404);

      // Get similar alumni with more experience for career path prediction
      const { data: seniorAlumni } = await adminClient
        .from("profiles")
        .select("full_name, designation, company, industry, experience_years, skills")
        .gt("experience_years", (profile.experience_years || 0) + 2)
        .order("experience_years", { ascending: true })
        .limit(20);

      const alumniContext = seniorAlumni?.map(a =>
        `${a.full_name} | ${a.designation} at ${a.company} | ${a.industry} | ${a.experience_years}yr | Skills: ${(a.skills || []).join(", ")}`
      ).join("\n") || "No senior alumni data";

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a career path predictor. Based on alumni career progressions, predict the next career steps for this person. Return JSON with tool call.`,
            },
            {
              role: "user",
              content: `Current: ${profile.designation || "Unknown"} at ${profile.company || "Unknown"}, ${profile.experience_years || 0}yr experience, Skills: ${(profile.skills || []).join(", ")}, Industry: ${profile.industry || "Unknown"}\n\nSenior Alumni Paths:\n${alumniContext}`,
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "predict_career",
              description: "Return predicted career path",
              parameters: {
                type: "object",
                properties: {
                  current_role: { type: "string" },
                  next_role: { type: "string" },
                  timeline: { type: "string" },
                  skills_needed: { type: "array", items: { type: "string" } },
                  suggested_mentors: { type: "array", items: { type: "string" } },
                  career_trajectory: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        role: { type: "string" },
                        years: { type: "string" },
                        company_type: { type: "string" },
                      },
                      required: ["role", "years"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["current_role", "next_role", "timeline", "skills_needed", "career_trajectory"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "predict_career" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return json({ error: "Rate limited" }, 429);
        if (response.status === 402) return json({ error: "AI credits exhausted" }, 402);
        return json({ error: "AI service error" }, 500);
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) return json({ error: "No prediction returned" }, 500);

      const prediction = JSON.parse(toolCall.function.arguments);
      return json({ prediction });
    }

    return json({ error: "Invalid action. Use: embed, match, career_path" }, 400);
  } catch (e) {
    console.error("embed-profile error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
