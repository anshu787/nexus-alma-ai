import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const firstNames = ["Aarav","Aditi","Aditya","Akash","Amit","Amrita","Ananya","Anil","Anjali","Arjun","Aryan","Bhavya","Chetan","Deepa","Dev","Diya","Gaurav","Geeta","Harsh","Isha","Jaya","Kabir","Kavya","Kiran","Krishna"];
const lastNames = ["Sharma","Patel","Singh","Kumar","Gupta","Verma","Reddy","Nair","Joshi","Mehta","Iyer","Chauhan","Bansal","Mishra","Agarwal","Pandey","Rao","Das","Bose","Tiwari"];
const companies = ["Google","Microsoft","Amazon","Flipkart","Razorpay","Infosys","TCS","PhonePe","Zomato","Adobe","Oracle","Goldman Sachs","Deloitte","Freshworks","Zoho"];
const desig = ["Software Engineer","Sr. Software Engineer","Tech Lead","Product Manager","Data Scientist","ML Engineer","DevOps Engineer","Full Stack Developer","Cloud Architect","Eng. Manager"];
const stuDesig = ["B.Tech Student","M.Tech Student","Research Scholar","Intern","Final Year"];
const depts = ["Computer Science","Electrical Eng.","Mechanical Eng.","Electronics","IT","Civil Eng.","Chemical Eng.","Mathematics","Physics","Biotech"];
const locs = ["Bangalore","Hyderabad","Mumbai","Delhi","Pune","Chennai","Gurugram","Noida","San Francisco","London","Singapore"];
const sk = ["React","TypeScript","Python","Java","Node.js","AWS","Docker","SQL","MongoDB","Go","ML","C++","Flutter","Kubernetes","GraphQL"];
const interests = ["AI/ML","Startups","Cloud","Open Source","Cybersecurity","EdTech","FinTech","Gaming","Mentorship","Travel"];

function pick<T>(a:T[]):T{return a[Math.floor(Math.random()*a.length)]}
function pickN<T>(a:T[],n:number):T[]{return[...a].sort(()=>Math.random()-0.5).slice(0,n)}
function ri(a:number,b:number){return Math.floor(Math.random()*(b-a+1))+a}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { batch = 0 } = await req.json().catch(() => ({ batch: 0 }));
    // 12 batches of 25 = 300 users
    // 0-3 = alumni, 4-7 = institution_admin, 8-11 = student
    const roleIdx = Math.floor(batch / 4);
    const roles = ["alumni","institution_admin","student"];
    const role = roles[roleIdx] || "alumni";
    const offset = (batch % 4) * 25;

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth:{autoRefreshToken:false,persistSession:false}});
    let ok = 0; const errs: string[] = [];

    for (let i = 0; i < 25; i++) {
      const idx = offset + i;
      const fn = firstNames[idx % firstNames.length];
      const ln = lastNames[Math.floor(idx*7/3) % lastNames.length];
      const email = `${fn.toLowerCase()}${ln.toLowerCase()}${role[0]}${batch}${i}@test.alumniapp.com`;
      
      const {data,error} = await sb.auth.admin.createUser({email,password:"TestUser@2026",email_confirm:true,user_metadata:{full_name:`${fn} ${ln}`}});
      if (error||!data.user) { if(errs.length<2)errs.push(error?.message||"no user"); continue; }
      
      const uid = data.user.id; ok++;
      const isStu = role==="student";
      
      await sb.from("profiles").update({
        full_name:`${fn} ${ln}`, company:isStu?null:pick(companies),
        designation:isStu?pick(stuDesig):pick(desig), department:pick(depts),
        batch:isStu?`${ri(2024,2027)}`:`${ri(2015,2023)}`, passing_year:isStu?ri(2025,2028):ri(2015,2023),
        location:pick(locs), skills:pickN(sk,ri(3,6)), interests:pickN(interests,ri(2,4)),
        is_verified:!isStu&&Math.random()>0.3, is_mentor:!isStu&&Math.random()>0.6,
        engagement_score:ri(10,800), profile_completion:ri(40,100),
        experience_years:isStu?0:ri(1,15),
        institution_id:Math.random()>0.3?"a1b2c3d4-e5f6-7890-abcd-ef1234567890":"b2c3d4e5-f6a7-8901-bcde-f12345678901",
        bio:isStu?`${pick(depts)} student`:`${pick(desig)} at ${pick(companies)}`,
        industry:isStu?"Education":pick(["Technology","Finance","Consulting","Healthcare","E-commerce"]),
      }).eq("user_id",uid);

      if(role!=="alumni") await sb.from("user_roles").update({role}).eq("user_id",uid);
    }

    return new Response(JSON.stringify({success:true,batch,role,created:ok,errors:errs}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  } catch(e) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});
