import { motion, useMotionValue, useTransform, animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Briefcase, TrendingUp, Brain, Sparkles, Globe, Shield, Play, Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-network.jpg";

/* ─── Animated Counter ─── */
function AnimatedStat({ value, suffix = "", label }: { value: number; suffix?: string; label: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(count, value, { duration: 2, ease: [0.25, 0.46, 0.45, 0.94] });
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return () => { controls.stop(); unsub(); };
  }, [isInView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
      className="bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 rounded-xl p-6 text-center hover:bg-primary-foreground/10 transition-colors"
    >
      <div className="text-3xl md:text-5xl font-heading font-bold text-accent mb-1">
        {display}{suffix}
      </div>
      <div className="text-sm text-primary-foreground/60">{label}</div>
    </motion.div>
  );
}

const stats = [
  { value: 50000, suffix: "+", label: "Alumni Connected" },
  { value: 200, suffix: "+", label: "Institutions" },
  { value: 12000, suffix: "+", label: "Mentorships" },
  { value: 95, suffix: "%", label: "Engagement Rate" },
];

const features = [
  { icon: Brain, title: "AI Intelligence", description: "Smart matching connects students with mentors, recommends opportunities, and predicts career paths." },
  { icon: Users, title: "Social Community", description: "LinkedIn-grade networking with posts, stories, messaging, and real-time activity feeds." },
  { icon: Briefcase, title: "Career Engine", description: "Job postings, internships, referral systems, and hiring alumni discovery — all automated." },
  { icon: TrendingUp, title: "Impact Analytics", description: "Measure mentorship conversions, placement rates, and institutional ROI in real time." },
  { icon: Globe, title: "Multi-Tenant", description: "Each institution gets isolated data, branding, analytics, and engagement metrics." },
  { icon: Shield, title: "Trust & Verification", description: "Alumni verification, company email validation, and authenticity badges build trust." },
];

const testimonials = [
  {
    name: "Dr. Priya Sharma",
    role: "Dean, IIT Delhi Alumni Cell",
    quote: "AlumniOS transformed our alumni engagement from a spreadsheet to a thriving community. Mentorship connections increased 4x in the first quarter.",
    rating: 5,
  },
  {
    name: "Rajesh Nair",
    role: "Alumni, Batch of 2018 — Google",
    quote: "I found my first mentee through AlumniOS. The AI matching is remarkably accurate — it paired me with a student whose career goals perfectly aligned with my journey.",
    rating: 5,
  },
  {
    name: "Ananya Iyer",
    role: "Student, Final Year CS",
    quote: "The skill gap analyzer showed me exactly what I needed to learn. Within 3 months, I landed an internship at a top startup through an alumni referral on the platform.",
    rating: 5,
  },
  {
    name: "Prof. Vikram Mehta",
    role: "Director, NIT Warangal",
    quote: "The impact dashboard gave us concrete data to present to our board. Alumni donation pledges increased 60% after we showed them the engagement metrics.",
    rating: 5,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

export default function LandingPage() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((p) => (p + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-glass backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-16 px-6">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-accent" />
            <span className="font-heading font-bold text-lg text-foreground">AlumniOS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#stats" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Impact</a>
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
            <Link to="/auth">
              <Button variant="hero" size="sm">Launch Dashboard <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-hero" />
        <div className="absolute inset-0" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.15 }} />
        <div className="relative container mx-auto px-6 py-28 md:py-40">
          <motion.div initial="hidden" animate="visible" className="max-w-3xl">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium text-accent">AI-Powered Alumni Intelligence</span>
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold text-primary-foreground leading-[1.1] mb-6">
              Where Alumni<br />
              <span className="text-gradient-primary">Networks Thrive</span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-primary-foreground/70 max-w-xl mb-10 font-body">
              The multi-tenant intelligence platform that transforms alumni databases into living, engaged communities driving real institutional outcomes.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-4">
              <Link to="/auth">
                <Button variant="hero" size="xl">Get Started <ArrowRight className="h-5 w-5" /></Button>
              </Link>
              <Button variant="hero-outline" size="xl" onClick={() => setShowVideo(true)}>
                <Play className="h-5 w-5" /> Watch Demo
              </Button>
            </motion.div>
          </motion.div>

          {/* Animated Stats */}
          <div id="stats" className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s) => (
              <AnimatedStat key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
            ))}
          </div>
        </div>
      </section>

      {/* Demo Video Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">
              See AlumniOS in <span className="text-gradient-primary">Action</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Watch how institutions are driving real alumni engagement</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-lg border border-border group cursor-pointer"
            onClick={() => setShowVideo(true)}
          >
            <div className="aspect-video bg-hero relative">
              <div className="absolute inset-0" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.3 }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="h-20 w-20 rounded-full bg-accent flex items-center justify-center shadow-accent-glow"
                >
                  <Play className="h-8 w-8 text-accent-foreground ml-1" />
                </motion.div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white font-heading font-semibold">AlumniOS Platform Demo</p>
                <p className="text-white/60 text-sm">3 min overview • AI Matching • Impact Analytics</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Video Modal */}
      {showVideo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setShowVideo(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="relative w-full max-w-4xl aspect-video bg-card rounded-2xl overflow-hidden border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Play className="h-16 w-16 text-accent mx-auto mb-4" />
                <p className="text-foreground font-heading font-semibold text-lg">Demo Video Coming Soon</p>
                <p className="text-muted-foreground text-sm mt-2">Platform walkthrough will be available here</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowVideo(false)}>Close</Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Features */}
      <section id="features" className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-heading font-bold text-foreground mb-4">
              Built for <span className="text-gradient-primary">Intelligent</span> Engagement
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Every feature is designed to turn passive alumni records into active, measurable institutional value.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                className="group p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-md transition-all duration-300 hover:-translate-y-1"
              >
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <f.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-lg font-heading font-semibold text-card-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: "cover" }} />
        <div className="relative container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-heading font-bold text-primary-foreground mb-4">
              Trusted by <span className="text-gradient-primary">Institutions</span> & Alumni
            </h2>
            <p className="text-primary-foreground/60 max-w-lg mx-auto">Real stories from our community</p>
          </motion.div>

          <div className="max-w-3xl mx-auto relative">
            <motion.div
              key={currentTestimonial}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
              className="bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 rounded-2xl p-8 md:p-10"
            >
              <Quote className="h-10 w-10 text-accent/30 mb-4" />
              <p className="text-lg md:text-xl text-primary-foreground/90 font-body leading-relaxed mb-6 italic">
                "{testimonials[currentTestimonial].quote}"
              </p>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="font-heading font-bold text-accent">
                    {testimonials[currentTestimonial].name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="font-heading font-semibold text-primary-foreground">{testimonials[currentTestimonial].name}</p>
                  <p className="text-sm text-primary-foreground/50">{testimonials[currentTestimonial].role}</p>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {Array.from({ length: testimonials[currentTestimonial].rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-accent fill-accent" />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setCurrentTestimonial((p) => (p - 1 + testimonials.length) % testimonials.length)}
                className="h-10 w-10 rounded-full border border-primary-foreground/20 flex items-center justify-center text-primary-foreground/60 hover:text-primary-foreground hover:border-primary-foreground/40 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex gap-2">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentTestimonial(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${i === currentTestimonial ? "w-8 bg-accent" : "w-2 bg-primary-foreground/20"}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setCurrentTestimonial((p) => (p + 1) % testimonials.length)}
                className="h-10 w-10 rounded-full border border-primary-foreground/20 flex items-center justify-center text-primary-foreground/60 hover:text-primary-foreground hover:border-primary-foreground/40 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="container mx-auto px-6"
        >
          <div className="bg-hero rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: "cover" }} />
            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-heading font-bold text-primary-foreground mb-6">
                Ready to Transform Your Alumni Network?
              </h2>
              <p className="text-primary-foreground/70 max-w-xl mx-auto mb-10 text-lg">
                Join institutions already achieving measurable outcomes through AI-driven alumni engagement.
              </p>
              <Link to="/auth">
                <Button variant="hero" size="xl">Launch Your Platform <ArrowRight className="h-5 w-5" /></Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-primary py-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <span className="font-heading font-semibold text-primary-foreground">AlumniOS</span>
          </div>
          <p className="text-sm text-primary-foreground/50">© 2026 AlumniOS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
