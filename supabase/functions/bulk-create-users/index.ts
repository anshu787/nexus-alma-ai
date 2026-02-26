import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const firstNames = ["Aarav","Aditi","Aditya","Akash","Amit","Amrita","Ananya","Anil","Anjali","Arjun","Aryan","Bhavya","Chetan","Deepa","Dev","Diya","Gaurav","Geeta","Harsh","Isha","Jaya","Kabir","Kavya","Kiran","Krishna","Lakshmi","Manish","Meera","Naveen","Neha","Nikhil","Pallavi","Priya","Rahul","Ravi","Rohit","Sakshi","Sanjay","Shreya","Suresh","Tanvi","Varun","Vidya","Vikram","Yash"];
const lastNames = ["Sharma","Patel","Singh","Kumar","Gupta","Verma","Reddy","Nair","Joshi","Mehta","Iyer","Chauhan","Bansal","Mishra","Agarwal","Pandey","Rao","Das","Bose","Tiwari","Saxena","Kapoor","Malhotra","Chopra","Khanna"];
const companies = ["Google","Microsoft","Amazon","Flipkart","Razorpay","Infosys","TCS","PhonePe","Zomato","Adobe","Oracle","Goldman Sachs","Deloitte","Freshworks","Zoho","Uber","Meta","Apple","Netflix","Stripe"];
const desig = ["Software Engineer","Sr. Software Engineer","Tech Lead","Product Manager","Data Scientist","ML Engineer","DevOps Engineer","Full Stack Developer","Cloud Architect","Eng. Manager","VP Engineering","CTO","Staff Engineer","Principal Engineer","Director"];
const stuDesig = ["B.Tech Student","M.Tech Student","Research Scholar","Intern","Final Year","PhD Scholar"];
const mentorDesig = ["Senior Mentor","Career Coach","Technical Advisor","Industry Expert","Startup Advisor","Leadership Coach"];
const depts = ["Computer Science","Electrical Eng.","Mechanical Eng.","Electronics","IT","Civil Eng.","Chemical Eng.","Mathematics","Physics","Biotech"];
const locs = ["Bangalore","Hyderabad","Mumbai","Delhi","Pune","Chennai","Gurugram","Noida","San Francisco","London","Singapore","New York","Seattle","Tokyo","Berlin"];
const sk = ["React","TypeScript","Python","Java","Node.js","AWS","Docker","SQL","MongoDB","Go","ML","C++","Flutter","Kubernetes","GraphQL","Rust","Swift","TensorFlow","PyTorch","Redis"];
const interests = ["AI/ML","Startups","Cloud","Open Source","Cybersecurity","EdTech","FinTech","Gaming","Mentorship","Travel","Blockchain","IoT","AR/VR","Data Science","Leadership"];

function pick<T>(a:T[]):T{return a[Math.floor(Math.random()*a.length)]}
function pickN<T>(a:T[],n:number):T[]{return[...a].sort(()=>Math.random()-0.5).slice(0,n)}
function ri(a:number,b:number){return Math.floor(Math.random()*(b-a+1))+a}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { batch = 0 } = await req.json().catch(() => ({ batch: 0 }));
    // 16 batches of 25 = 400 users
    // 0-3 = alumni, 4-7 = institution_admin, 8-11 = student, 12-15 = mentor(alumni+is_mentor)
    const roleIdx = Math.floor(batch / 4);
    const roleLabels = ["alumni","institution_admin","student","mentor"];
    const roleLabel = roleLabels[roleIdx] || "alumni";
    const offset = (batch % 4) * 25;

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth:{autoRefreshToken:false,persistSession:false}});
    let ok = 0; const errs: string[] = [];

    for (let i = 0; i < 25; i++) {
      const idx = offset + i;
      const fn = firstNames[idx % firstNames.length];
      const ln = lastNames[(idx * 7 + batch * 3) % lastNames.length];
      const email = `${fn.toLowerCase()}${ln.toLowerCase()}${roleLabel[0]}${batch}${i}@test.alumniapp.com`;
      
      const {data,error} = await sb.auth.admin.createUser({email,password:"TestUser@2026",email_confirm:true,user_metadata:{full_name:`${fn} ${ln}`}});
      if (error||!data.user) { if(errs.length<3)errs.push(error?.message||"no user"); continue; }
      
      const uid = data.user.id; ok++;
      const isStu = roleLabel==="student";
      const isMentor = roleLabel==="mentor";
      const isAdmin = roleLabel==="institution_admin";
      
      await sb.from("profiles").update({
        full_name:`${fn} ${ln}`, company:isStu?null:pick(companies),
        designation:isMentor?pick(mentorDesig):isStu?pick(stuDesig):pick(desig),
        department:pick(depts),
        batch:isStu?`${ri(2024,2027)}`:`${ri(2010,2023)}`,
        passing_year:isStu?ri(2025,2028):ri(2010,2023),
        location:pick(locs), skills:pickN(sk,ri(3,7)), interests:pickN(interests,ri(2,5)),
        is_verified:!isStu&&Math.random()>0.2,
        is_mentor:isMentor?true:(!isStu&&Math.random()>0.7),
        is_hiring:!isStu&&Math.random()>0.7,
        engagement_score:ri(20,900), profile_completion:ri(50,100),
        experience_years:isStu?0:ri(1,20),
        institution_id:Math.random()>0.4?"a1b2c3d4-e5f6-7890-abcd-ef1234567890":"b2c3d4e5-f6a7-8901-bcde-f12345678901",
        bio:isMentor?`${pick(mentorDesig)} | ${pick(companies)} | Passionate about ${pick(interests)}`
           :isStu?`${pick(depts)} student | Class of ${ri(2025,2028)}`
           :`${pick(desig)} at ${pick(companies)} | ${ri(1,15)}+ years exp`,
        industry:isStu?"Education":pick(["Technology","Finance","Consulting","Healthcare","E-commerce","SaaS","Gaming","Media"]),
      }).eq("user_id",uid);

      // Set role: mentors are alumni role with is_mentor=true
      if(isAdmin) await sb.from("user_roles").update({role:"institution_admin"}).eq("user_id",uid);
      else if(isStu) await sb.from("user_roles").update({role:"student"}).eq("user_id",uid);
      // alumni and mentor both keep default "alumni" role
    }

    return new Response(JSON.stringify({success:true,batch,role:roleLabel,created:ok,errors:errs}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  } catch(e) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});
