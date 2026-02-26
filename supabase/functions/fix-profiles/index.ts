import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const companies = ["Google","Microsoft","Amazon","Flipkart","Razorpay","Infosys","TCS","PhonePe","Zomato","Adobe","Oracle","Goldman Sachs","Deloitte","Freshworks","Zoho","Uber","Meta","Apple","Netflix","Stripe"];
const desig = ["Software Engineer","Sr. Software Engineer","Tech Lead","Product Manager","Data Scientist","ML Engineer","DevOps Engineer","Full Stack Developer","Cloud Architect","Eng. Manager","VP Engineering","Staff Engineer","Principal Engineer"];
const stuDesig = ["B.Tech Student","M.Tech Student","Research Scholar","Intern","Final Year"];
const mentorDesig = ["Senior Mentor","Career Coach","Technical Advisor","Industry Expert","Startup Advisor"];
const depts = ["Computer Science","Electrical Eng.","Mechanical Eng.","Electronics","IT","Civil Eng.","Chemical Eng.","Mathematics","Physics","Biotech"];
const locs = ["Bangalore","Hyderabad","Mumbai","Delhi","Pune","Chennai","Gurugram","Noida","San Francisco","London","Singapore","New York","Seattle"];
const sk = ["React","TypeScript","Python","Java","Node.js","AWS","Docker","SQL","MongoDB","Go","ML","C++","Flutter","Kubernetes","GraphQL","Rust","TensorFlow"];
const interests = ["AI/ML","Startups","Cloud","Open Source","Cybersecurity","EdTech","FinTech","Gaming","Mentorship","Blockchain","IoT","Data Science","Leadership"];

function pick<T>(a:T[]):T{return a[Math.floor(Math.random()*a.length)]}
function pickN<T>(a:T[],n:number):T[]{return[...a].sort(()=>Math.random()-0.5).slice(0,n)}
function ri(a:number,b:number){return Math.floor(Math.random()*(b-a+1))+a}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { page = 0 } = await req.json().catch(() => ({ page: 0 }));
    const pageSize = 15;

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth:{autoRefreshToken:false,persistSession:false}});

    const { data: allUsers, error: listErr } = await sb.auth.admin.listUsers({ page: page + 1, perPage: pageSize });
    if (listErr) throw listErr;

    const users = allUsers?.users || [];
    let fixed = 0; const errs: string[] = [];

    for (const u of users) {
      // Check if profile exists
      const { data: existing } = await sb.from("profiles").select("id").eq("user_id", u.id).maybeSingle();
      if (existing) continue; // already has profile

      const email = u.email || "";
      const fullName = u.user_metadata?.full_name || email.split("@")[0];
      
      // Determine role from email pattern
      let roleLabel = "alumni";
      if (email.includes("i4") || email.includes("i5") || email.includes("i6") || email.includes("i7")) roleLabel = "institution_admin";
      else if (email.includes("s8") || email.includes("s9") || email.includes("s10") || email.includes("s11")) roleLabel = "student";
      else if (email.includes("m12") || email.includes("m13") || email.includes("m14") || email.includes("m15")) roleLabel = "mentor";

      const isStu = roleLabel === "student";
      const isMentor = roleLabel === "mentor";

      // Insert profile
      const { error: profErr } = await sb.from("profiles").insert({
        user_id: u.id,
        full_name: fullName,
        company: isStu ? null : pick(companies),
        designation: isMentor ? pick(mentorDesig) : isStu ? pick(stuDesig) : pick(desig),
        department: pick(depts),
        batch: isStu ? `${ri(2024,2027)}` : `${ri(2010,2023)}`,
        passing_year: isStu ? ri(2025,2028) : ri(2010,2023),
        location: pick(locs),
        skills: pickN(sk, ri(3,7)),
        interests: pickN(interests, ri(2,5)),
        is_verified: !isStu && Math.random() > 0.2,
        is_mentor: isMentor ? true : (!isStu && Math.random() > 0.7),
        is_hiring: !isStu && Math.random() > 0.7,
        engagement_score: ri(20,900),
        profile_completion: ri(50,100),
        experience_years: isStu ? 0 : ri(1,20),
        institution_id: Math.random() > 0.4 ? "a1b2c3d4-e5f6-7890-abcd-ef1234567890" : "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        bio: isMentor ? `${pick(mentorDesig)} | ${pick(companies)} | Passionate about ${pick(interests)}`
            : isStu ? `${pick(depts)} student | Class of ${ri(2025,2028)}`
            : `${pick(desig)} at ${pick(companies)} | ${ri(1,15)}+ years exp`,
        industry: isStu ? "Education" : pick(["Technology","Finance","Consulting","Healthcare","E-commerce","SaaS","Gaming","Media"]),
      });

      if (profErr) { if (errs.length < 3) errs.push(profErr.message); continue; }

      // Insert role
      const dbRole = (roleLabel === "mentor") ? "alumni" : roleLabel;
      const { error: roleErr } = await sb.from("user_roles").insert({ user_id: u.id, role: dbRole });
      if (roleErr && !roleErr.message.includes("duplicate") && errs.length < 3) errs.push(roleErr.message);

      fixed++;
    }

    return new Response(JSON.stringify({ success: true, page, usersInPage: users.length, fixed, errors: errs }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
