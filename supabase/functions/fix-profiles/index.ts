import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const companies = ["Google","Microsoft","Amazon","Flipkart","Razorpay","Infosys","TCS","PhonePe","Zomato","Adobe","Oracle","Goldman Sachs","Deloitte","Freshworks","Zoho","Uber","Meta","Apple","Netflix","Stripe"];
const desig = ["Software Engineer","Sr. Software Engineer","Tech Lead","Product Manager","Data Scientist","ML Engineer","DevOps Engineer","Full Stack Developer","Cloud Architect","Eng. Manager","VP Engineering","CTO","Staff Engineer","Principal Engineer","Director of Engineering"];
const stuDesig = ["B.Tech Student","M.Tech Student","Research Scholar","Intern","Final Year Student","PhD Scholar"];
const mentorDesig = ["Senior Mentor","Career Coach","Technical Advisor","Industry Expert","Startup Advisor","Leadership Coach"];
const modDesig = ["Community Manager","Content Moderator","Trust & Safety Lead","Forum Admin","Quality Analyst"];
const adminDesig = ["Dean of Alumni Relations","Associate Director","Program Coordinator","Alumni Relations Manager","Registrar"];
const depts = ["Computer Science","Electrical Eng.","Mechanical Eng.","Electronics","Information Technology","Civil Eng.","Chemical Eng.","Mathematics","Physics","Biotechnology"];
const locs = ["Bangalore","Hyderabad","Mumbai","Delhi","Pune","Chennai","Gurugram","Noida","San Francisco","London","Singapore","New York","Seattle","Tokyo","Berlin"];
const sk = ["React","TypeScript","Python","Java","Node.js","AWS","Docker","SQL","MongoDB","Go","ML","C++","Flutter","Kubernetes","GraphQL","Rust","Swift","TensorFlow","PyTorch","Redis"];
const interestsList = ["AI/ML","Startups","Cloud Computing","Open Source","Cybersecurity","EdTech","FinTech","Gaming","Mentorship","Travel","Blockchain","IoT","AR/VR","Data Science","Leadership"];
const industries = ["Technology","Finance","Consulting","Healthcare","E-commerce","SaaS","Gaming","Media","Telecom","Automotive"];

function pick<T>(a:T[]):T{return a[Math.floor(Math.random()*a.length)]}
function pickN<T>(a:T[],n:number):T[]{return[...a].sort(()=>Math.random()-0.5).slice(0,n)}
function ri(a:number,b:number){return Math.floor(Math.random()*(b-a+1))+a}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { offset = 0, limit = 50 } = await req.json().catch(() => ({ offset: 0, limit: 50 }));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth:{autoRefreshToken:false,persistSession:false}});
    
    // Get profiles that need updating (empty designation)
    const { data: profiles, error: fetchErr } = await sb
      .from("profiles")
      .select("user_id, full_name")
      .or("designation.is.null,designation.eq.")
      .order("user_id")
      .range(offset, offset + limit - 1);
    
    if (fetchErr) throw fetchErr;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({success:true, updated:0, remaining:0, message:"All profiles populated!"}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
    }

    // Get all user IDs and their roles in one query
    const userIds = profiles.map(p => p.user_id);
    const { data: roles } = await sb.from("user_roles").select("user_id, role").in("user_id", userIds);
    const roleMap: Record<string, string> = {};
    for (const r of (roles || [])) roleMap[r.user_id] = r.role;

    let updated = 0;
    for (const profile of profiles) {
      const role = roleMap[profile.user_id] || "alumni";
      const isStu = role === "student";
      const isAdmin = role === "institution_admin";
      const isMod = role === "moderator";
      const isMentor = !isStu && !isAdmin && !isMod && Math.random() > 0.65;
      const isHiring = !isStu && Math.random() > 0.6;
      const batchYear = isStu ? `${ri(2024,2027)}` : `${ri(2010,2023)}`;
      const passingYear = isStu ? ri(2025,2028) : ri(2010,2023);
      const company = isStu ? null : pick(companies);
      const designation = isAdmin ? pick(adminDesig) : isMod ? pick(modDesig) : isStu ? pick(stuDesig) : isMentor ? pick(mentorDesig) : pick(desig);
      const dept = pick(depts);
      const loc = pick(locs);
      const expYears = isStu ? 0 : ri(1, 20);
      const userSkills = pickN(sk, ri(3, 6));
      const userInterests = pickN(interestsList, ri(2, 4));
      const industry = isStu ? "Education" : pick(industries);
      const engScore = ri(20, 900);
      
      let bio = "";
      if (isAdmin) bio = `${designation} | Managing alumni relations and institutional partnerships`;
      else if (isMod) bio = `${designation} | Keeping the community safe and engaged | ${pick(interestsList)} enthusiast`;
      else if (isStu) bio = `${dept} student | Class of ${passingYear} | Passionate about ${pick(interestsList)}`;
      else if (isMentor) bio = `${designation} | ${company} | ${expYears}+ years mentoring in ${pick(interestsList)}`;
      else bio = `${designation} at ${company} | ${expYears}+ years exp | ${pick(interestsList)} enthusiast`;

      const { error: updateErr } = await sb.from("profiles").update({
        company, designation, department: dept, batch: batchYear,
        passing_year: passingYear, location: loc, skills: userSkills,
        interests: userInterests,
        is_verified: !isStu && Math.random() > 0.2,
        is_mentor: isMentor,
        is_hiring: isHiring,
        engagement_score: engScore,
        profile_completion: ri(60, 100),
        experience_years: expYears,
        industry, bio,
        institution_id: Math.random() > 0.4 ? "a1b2c3d4-e5f6-7890-abcd-ef1234567890" : "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        social_links: {
          linkedin: `https://linkedin.com/in/${profile.full_name.toLowerCase().replace(/\s/g,'-')}`,
          github: Math.random() > 0.5 ? `https://github.com/${profile.full_name.toLowerCase().replace(/\s/g,'')}` : null,
        },
      }).eq("user_id", profile.user_id);
      
      if (!updateErr) updated++;
    }

    // Check remaining
    const { count } = await sb.from("profiles").select("user_id", { count: "exact", head: true }).or("designation.is.null,designation.eq.");

    return new Response(JSON.stringify({success:true, updated, remaining: count || 0, offset}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  } catch(e) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});
