import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pick<T>(a:T[]):T{return a[Math.floor(Math.random()*a.length)]}
function pickN<T>(a:T[],n:number):T[]{return[...a].sort(()=>Math.random()-0.5).slice(0,n)}
function ri(a:number,b:number){return Math.floor(Math.random()*(b-a+1))+a}
function pastDate(daysAgo:number){return new Date(Date.now()-daysAgo*86400000).toISOString()}
function futureDate(daysAhead:number){return new Date(Date.now()+daysAhead*86400000).toISOString()}

const postContents = [
  "Just got promoted to Senior Engineer at Google! Hard work pays off. Thanks to everyone who supported me through this journey 🚀",
  "Looking for alumni from the 2018 batch working in fintech. Let's connect and discuss opportunities!",
  "Sharing my experience of transitioning from mechanical engineering to data science. It's never too late to pivot your career!",
  "Excited to announce that our startup just raised Series A funding! Special thanks to our college mentors 🎉",
  "Anyone attending the upcoming alumni meet in Bangalore? Would love to catch up with old friends.",
  "Pro tip: Always negotiate your salary. Here's what I learned from 10+ years in tech...",
  "Just completed my AWS Solutions Architect certification. Happy to help anyone preparing for it.",
  "Grateful for the mentorship program. My mentor helped me land my dream job at Microsoft!",
  "Hosting a webinar on 'Building Scalable Systems' this weekend. DM me for the link.",
  "Started a new role as VP Engineering. The journey from campus placement to this has been incredible.",
  "Looking to hire React developers for our team. Remote-friendly, competitive pay. Reach out!",
  "Participated in a hackathon last weekend and our team won first place! Innovation never stops 💡",
  "My advice to current students: Focus on building real projects, not just collecting certificates.",
  "Thrilled to be speaking at the upcoming tech conference. Topics: AI/ML in production systems.",
  "Just launched my open-source project on GitHub. Would love feedback from the community!",
  "Reflecting on 5 years since graduation. The network we build here is truly invaluable.",
  "Anyone interested in forming a study group for system design interviews?",
  "Congratulations to the 2025 batch! Welcome to the alumni network. Here's to new beginnings!",
  "Shared my resume tips that helped me crack interviews at FAANG companies. Check my blog post.",
  "The alumni mentorship session today was amazing. Learned so much about leadership from industry veterans.",
  "Working on an EdTech startup to make quality education accessible. Looking for co-founders!",
  "Just returned from Silicon Valley. The energy and innovation there is truly inspiring.",
  "Published my first research paper in machine learning. Grateful to my professors and peers.",
  "Organizing a alumni cricket tournament next month. Who's in? 🏏",
  "Three years at Amazon taught me: ownership, bias for action, and customer obsession. Key takeaways...",
  "Looking for internship opportunities in cloud computing. Any leads would be appreciated!",
  "Just finished reading 'Designing Data-Intensive Applications'. Highly recommend for all engineers.",
  "Our batch reunion was fantastic! So good to see everyone after 10 years.",
  "Tips for freshers: Build your LinkedIn profile early, contribute to open source, and never stop learning.",
  "Excited to mentor 5 students this semester through the alumni mentorship program!",
];

const commentContents = [
  "This is incredibly inspiring! Congratulations! 🎉",
  "Thanks for sharing this valuable insight.",
  "I'd love to connect and learn more about your experience.",
  "Great advice! Wish I had known this earlier.",
  "Congratulations on this achievement! Well deserved.",
  "Can you share more details about this opportunity?",
  "This resonates with my own experience. Thanks for putting it into words.",
  "Amazing work! Keep inspiring the community.",
  "I'm interested! How can I get involved?",
  "This is exactly the kind of content we need more of.",
  "Shared this with my team. Very helpful!",
  "Would love to discuss this further. DMing you!",
  "Brilliant! The alumni network is truly powerful.",
  "Thanks for mentoring! It makes a real difference.",
  "Count me in! Looking forward to it.",
];

const eventTitles = [
  "Annual Alumni Meet 2026","Tech Talk: AI in Healthcare","Campus Recruitment Drive",
  "Startup Pitch Night","Leadership Workshop","Career Counseling Session",
  "Hackathon: Build for Good","Alumni Cricket Tournament","Resume Building Workshop",
  "Industry Expert Panel","Networking Mixer","Mock Interview Sessions",
  "Entrepreneurship Bootcamp","Data Science Workshop","Alumni Homecoming",
  "Cloud Computing Masterclass","Product Management 101","Open Source Contribution Day",
  "Women in Tech Summit","Blockchain and Web3 Workshop",
];

const eventDescs = [
  "Join us for an exciting session bringing together alumni from all batches.",
  "An interactive workshop designed to help you build practical skills.",
  "Network with industry leaders and fellow alumni in this exclusive event.",
  "A hands-on session where you'll learn from experienced professionals.",
  "Come celebrate our community and reconnect with old friends.",
];

const eventLocs = ["Main Auditorium","Virtual (Zoom)","Conference Hall B","Innovation Lab","Campus Ground","Online (Google Meet)","Co-working Space, Bangalore","Tech Park, Hyderabad"];

const oppTitles = [
  "Senior React Developer","ML Engineer - NLP","Product Manager","Data Analyst","DevOps Engineer",
  "Full Stack Developer","Cloud Solutions Architect","Backend Engineer (Go)","iOS Developer","QA Lead",
  "Engineering Manager","Frontend Engineer","Data Scientist","Security Engineer","Staff Engineer",
  "Technical Writer","UX Designer","Blockchain Developer","AI Research Intern","Growth Analyst",
];

const oppDescs = [
  "We're looking for passionate engineers to join our growing team.",
  "Exciting opportunity to work on cutting-edge technology.",
  "Join a fast-paced startup solving real-world problems.",
  "Work with top talent and make an impact at scale.",
  "Remote-friendly position with competitive compensation.",
];

const forumCategories = ["career-advice","technical","campus-life","general","interview-prep","startup","mentorship"];
const forumTitles = [
  "How to prepare for system design interviews?","Best resources for learning Kubernetes?",
  "Career switch from service to product company","Tips for MBA after engineering",
  "How to negotiate a better salary?","Remote work best practices",
  "Should I join a startup or MNC?","How to build a strong GitHub portfolio?",
  "Advice on higher studies abroad","How to transition into data science?",
  "Best practices for code reviews","How to handle imposter syndrome?",
  "Tips for first-time managers","Freelancing vs Full-time employment",
  "How to prepare for Google interviews?",
];

const successStoryTitles = [
  "From Campus to Google: My Journey","Building a ₹100 Cr Startup","How Alumni Network Changed My Career",
  "From Intern to CTO in 5 Years","Cracking FAANG After 3 Rejections","My EdTech Startup Story",
  "Winning a National Hackathon","Landing a Job in Silicon Valley","From Engineer to Entrepreneur",
  "How Mentorship Shaped My Career",
];

const successStoryContent = [
  "When I graduated, I never imagined I'd end up where I am today. The journey was filled with challenges, but the support from our alumni network made all the difference. Here's my story of perseverance and growth...",
  "Starting a company right out of college seemed crazy to most people. But with the right mentors, a solid network, and relentless determination, we built something incredible. This is for everyone who dares to dream big...",
  "Three years ago, I was stuck in a job I didn't love. A chance conversation with a senior alumnus changed everything. They not only mentored me but connected me with opportunities that transformed my career path...",
];

const impactActions = ["referral","mentorship","donation","event_organized","opportunity_posted","workshop_conducted"];
const impactOutcomes = ["hired","completed","in_progress","successful",null];

const companies = ["Google","Microsoft","Amazon","Flipkart","Razorpay","Infosys","TCS","PhonePe","Zomato","Adobe","Oracle","Goldman Sachs","Deloitte","Freshworks","Zoho"];
const skills = ["React","TypeScript","Python","Java","Node.js","AWS","Docker","SQL","MongoDB","Go","ML","C++","Flutter","Kubernetes"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { type = "all" } = await req.json().catch(() => ({ type: "all" }));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth:{autoRefreshToken:false,persistSession:false}});
    
    // Get all user IDs
    const { data: profiles } = await sb.from("profiles").select("user_id, full_name, company, is_mentor").limit(500);
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({error:"No profiles found. Create users first."}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    const userIds = profiles.map(p => p.user_id);
    const results: Record<string, number> = {};

    // POSTS & COMMENTS
    if (type === "all" || type === "posts") {
      let postCount = 0;
      const postIds: string[] = [];
      for (let i = 0; i < 60; i++) {
        const uid = pick(userIds);
        const { data, error } = await sb.from("posts").insert({
          user_id: uid,
          content: pick(postContents),
          created_at: pastDate(ri(0, 90)),
          likes_count: ri(0, 50),
          comments_count: ri(0, 15),
        }).select("id").single();
        if (data) { postIds.push(data.id); postCount++; }
      }
      // Comments
      let commentCount = 0;
      for (const pid of postIds) {
        const numComments = ri(1, 5);
        for (let j = 0; j < numComments; j++) {
          const { error } = await sb.from("comments").insert({
            post_id: pid,
            user_id: pick(userIds),
            content: pick(commentContents),
            created_at: pastDate(ri(0, 60)),
          });
          if (!error) commentCount++;
        }
      }
      results.posts = postCount;
      results.comments = commentCount;
    }

    // EVENTS & RSVPs
    if (type === "all" || type === "events") {
      let eventCount = 0;
      for (let i = 0; i < 20; i++) {
        const isPast = Math.random() > 0.4;
        const startDate = isPast ? pastDate(ri(1, 60)) : futureDate(ri(1, 45));
        const { data, error } = await sb.from("events").insert({
          title: eventTitles[i % eventTitles.length],
          description: pick(eventDescs),
          event_type: pick(["meetup","workshop","webinar","reunion","hackathon","conference"]),
          start_date: startDate,
          end_date: new Date(new Date(startDate).getTime() + ri(2,8)*3600000).toISOString(),
          location: pick(eventLocs),
          is_virtual: Math.random() > 0.5,
          max_attendees: pick([50, 100, 200, 500, null]),
          created_by: pick(userIds),
          institution_id: pick(["a1b2c3d4-e5f6-7890-abcd-ef1234567890","b2c3d4e5-f6a7-8901-bcde-f12345678901"]),
        }).select("id").single();
        if (data) {
          eventCount++;
          // RSVPs
          const rsvpUsers = pickN(userIds, ri(5, 25));
          for (const uid of rsvpUsers) {
            await sb.from("event_rsvps").insert({ event_id: data.id, user_id: uid, status: pick(["going","interested","not_going"]) });
          }
        }
      }
      results.events = eventCount;
    }

    // OPPORTUNITIES
    if (type === "all" || type === "opportunities") {
      let oppCount = 0;
      for (let i = 0; i < 25; i++) {
        const { error } = await sb.from("opportunities").insert({
          title: oppTitles[i % oppTitles.length],
          company: pick(companies),
          description: pick(oppDescs),
          type: pick(["job","internship","freelance"]),
          employment_type: pick(["full-time","part-time","contract","internship"]),
          location: pick(["Bangalore","Remote","Hyderabad","Mumbai","San Francisco","London"]),
          salary_range: pick(["₹8-15 LPA","₹15-25 LPA","₹25-40 LPA","$80-120K","$120-180K"]),
          skills_required: pickN(skills, ri(2, 5)),
          posted_by: pick(userIds),
          is_active: Math.random() > 0.15,
          deadline: futureDate(ri(10, 60)),
          institution_id: pick(["a1b2c3d4-e5f6-7890-abcd-ef1234567890","b2c3d4e5-f6a7-8901-bcde-f12345678901"]),
        });
        if (!error) oppCount++;
      }
      results.opportunities = oppCount;
    }

    // FORUM POSTS & REPLIES
    if (type === "all" || type === "forum") {
      let forumCount = 0;
      for (let i = 0; i < 20; i++) {
        const { data, error } = await sb.from("forum_posts").insert({
          title: forumTitles[i % forumTitles.length],
          content: `${pick(postContents)}\n\nWhat are your thoughts on this? I'd love to hear from the community.`,
          category: pick(forumCategories),
          tags: pickN(["career","tech","interview","startup","mentoring","campus","coding","leadership"], ri(2,4)),
          user_id: pick(userIds),
          is_pinned: Math.random() > 0.85,
          likes_count: ri(0, 30),
          created_at: pastDate(ri(0, 60)),
        }).select("id").single();
        if (data) {
          forumCount++;
          const numReplies = ri(2, 8);
          for (let j = 0; j < numReplies; j++) {
            await sb.from("forum_replies").insert({
              post_id: data.id,
              user_id: pick(userIds),
              content: pick(commentContents),
              created_at: pastDate(ri(0, 50)),
            });
          }
        }
      }
      results.forum_posts = forumCount;
    }

    // CAMPAIGNS & DONATIONS
    if (type === "all" || type === "campaigns") {
      let campCount = 0;
      const campTitles = ["Annual Scholarship Fund","Lab Equipment Drive","Sports Complex Renovation","Library Modernization","Student Emergency Fund","Research Grant Pool","Campus Green Initiative","Tech Lab Upgrade"];
      for (let i = 0; i < 8; i++) {
        const goal = pick([50000, 100000, 250000, 500000, 1000000]);
        const raised = Math.floor(goal * (Math.random() * 0.9));
        const { data, error } = await sb.from("campaigns").insert({
          title: campTitles[i],
          description: `Help us achieve our goal for ${campTitles[i].toLowerCase()}. Every contribution makes a difference!`,
          goal_amount: goal,
          raised_amount: raised,
          created_by: pick(userIds),
          is_active: Math.random() > 0.2,
          start_date: pastDate(ri(10, 90)),
          end_date: futureDate(ri(30, 120)),
          institution_id: pick(["a1b2c3d4-e5f6-7890-abcd-ef1234567890","b2c3d4e5-f6a7-8901-bcde-f12345678901"]),
        }).select("id").single();
        if (data) {
          campCount++;
          // Donations
          const numDonations = ri(5, 20);
          for (let j = 0; j < numDonations; j++) {
            await sb.from("donations").insert({
              campaign_id: data.id,
              user_id: pick(userIds),
              amount: pick([500, 1000, 2500, 5000, 10000, 25000]),
              message: pick(["Happy to contribute!","For a great cause","Go team!","Proud alumnus","Keep up the good work!",null]),
              is_anonymous: Math.random() > 0.7,
            });
          }
        }
      }
      results.campaigns = campCount;
    }

    // SUCCESS STORIES
    if (type === "all" || type === "stories") {
      let storyCount = 0;
      for (let i = 0; i < 12; i++) {
        const { error } = await sb.from("success_stories").insert({
          title: successStoryTitles[i % successStoryTitles.length],
          content: pick(successStoryContent),
          user_id: pick(userIds),
          is_approved: Math.random() > 0.2,
          is_featured: Math.random() > 0.7,
          tags: pickN(["career","startup","tech","leadership","mentorship","innovation"], ri(2,4)),
          created_at: pastDate(ri(0, 120)),
        });
        if (!error) storyCount++;
      }
      results.success_stories = storyCount;
    }

    // REFERRAL REQUESTS
    if (type === "all" || type === "referrals") {
      let refCount = 0;
      for (let i = 0; i < 30; i++) {
        const requester = pick(userIds);
        let alumni = pick(userIds);
        while (alumni === requester) alumni = pick(userIds);
        const { error } = await sb.from("referral_requests").insert({
          requester_id: requester,
          alumni_id: alumni,
          company: pick(companies),
          position: pick(["Software Engineer","Product Manager","Data Scientist","DevOps Engineer","Frontend Developer"]),
          message: pick(["Would really appreciate a referral!","I have 3 years of experience in this domain.","Referred by a mutual connection.","Passionate about this role.",null]),
          status: pick(["pending","accepted","rejected","pending","pending"]),
          created_at: pastDate(ri(0, 60)),
        });
        if (!error) refCount++;
      }
      results.referrals = refCount;
    }

    // IMPACT EVENTS
    if (type === "all" || type === "impact") {
      let impCount = 0;
      for (let i = 0; i < 40; i++) {
        const source = pick(userIds);
        let target = pick(userIds);
        while (target === source) target = pick(userIds);
        const { error } = await sb.from("impact_events").insert({
          source_user_id: source,
          target_user_id: target,
          action: pick(impactActions),
          outcome: pick(impactOutcomes),
          metadata: { note: pick(["Great collaboration","Successful placement","Workshop completed","Funds raised"]) },
          created_at: pastDate(ri(0, 120)),
        });
        if (!error) impCount++;
      }
      results.impact_events = impCount;
    }

    // CONNECTIONS
    if (type === "all" || type === "connections") {
      let connCount = 0;
      for (let i = 0; i < 80; i++) {
        const source = pick(userIds);
        let target = pick(userIds);
        while (target === source) target = pick(userIds);
        const { error } = await sb.from("connections").insert({
          source_user_id: source,
          target_user_id: target,
          status: pick(["accepted","pending","accepted","accepted"]),
          relation_type: pick(["connection","mentorship","batchmate","colleague"]),
        });
        if (!error) connCount++;
      }
      results.connections = connCount;
    }

    // MESSAGES
    if (type === "all" || type === "messages") {
      let msgCount = 0;
      const msgContents = [
        "Hey! Great to connect with you.","Thanks for accepting my connection request!",
        "Would love to discuss career opportunities.","Are you attending the alumni meet?",
        "Can we schedule a mentorship call?","Thanks for the referral!",
        "Great talk at the webinar today!","Let's catch up sometime.",
      ];
      for (let i = 0; i < 50; i++) {
        const sender = pick(userIds);
        let receiver = pick(userIds);
        while (receiver === sender) receiver = pick(userIds);
        const { error } = await sb.from("messages").insert({
          sender_id: sender,
          receiver_id: receiver,
          content: pick(msgContents),
          is_read: Math.random() > 0.4,
          created_at: pastDate(ri(0, 30)),
        });
        if (!error) msgCount++;
      }
      results.messages = msgCount;
    }

    // ENGAGEMENT LOGS
    if (type === "all" || type === "engagement") {
      let engCount = 0;
      const actions = ["daily_login","post_created","event_rsvp","referral_given","opportunity_posted","profile_updated"];
      for (let i = 0; i < 100; i++) {
        const { error } = await sb.from("engagement_logs").insert({
          user_id: pick(userIds),
          action: pick(actions),
          points: pick([5, 10, 15, 25, 30, 50, 75]),
          metadata: {},
          created_at: pastDate(ri(0, 90)),
        });
        if (!error) engCount++;
      }
      results.engagement_logs = engCount;
    }

    // NOTIFICATIONS
    if (type === "all" || type === "notifications") {
      let notifCount = 0;
      const notifTypes = ["general","event","mentorship","referral","opportunity","message"];
      const notifTitles = [
        "New connection request","Event reminder: Alumni Meet","Referral status updated",
        "New opportunity matching your skills","Mentorship session scheduled","New message received",
        "Your post received 10 likes","Welcome to the community!","Profile completion reminder",
        "New forum reply on your post",
      ];
      for (let i = 0; i < 60; i++) {
        const { error } = await sb.from("notifications").insert({
          user_id: pick(userIds),
          title: pick(notifTitles),
          message: "Tap to view details and take action.",
          type: pick(notifTypes),
          is_read: Math.random() > 0.5,
          created_at: pastDate(ri(0, 30)),
        });
        if (!error) notifCount++;
      }
      results.notifications = notifCount;
    }

    return new Response(JSON.stringify({success:true, results}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  } catch(e) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});
