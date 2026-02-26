import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Briefcase, TrendingUp, Brain, Sparkles, Globe, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-network.jpg";

const stats = [
  { value: "50K+", label: "Alumni Connected" },
  { value: "200+", label: "Institutions" },
  { value: "12K+", label: "Mentorships" },
  { value: "95%", label: "Engagement Rate" },
];

const features = [
  {
    icon: Brain,
    title: "AI Intelligence",
    description: "Smart matching connects students with mentors, recommends opportunities, and predicts career paths.",
  },
  {
    icon: Users,
    title: "Social Community",
    description: "LinkedIn-grade networking with posts, stories, messaging, and real-time activity feeds.",
  },
  {
    icon: Briefcase,
    title: "Career Engine",
    description: "Job postings, internships, referral systems, and hiring alumni discovery — all automated.",
  },
  {
    icon: TrendingUp,
    title: "Impact Analytics",
    description: "Measure mentorship conversions, placement rates, and institutional ROI in real time.",
  },
  {
    icon: Globe,
    title: "Multi-Tenant",
    description: "Each institution gets isolated data, branding, analytics, and engagement metrics.",
  },
  {
    icon: Shield,
    title: "Trust & Verification",
    description: "Alumni verification, company email validation, and authenticity badges build trust.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

export default function LandingPage() {
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
            <Link to="/auth">
              <Button variant="hero" size="sm">Launch Dashboard <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-hero" />
        <div className="absolute inset-0" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15 }} />
        <div className="relative container mx-auto px-6 py-28 md:py-40">
          <motion.div
            initial="hidden"
            animate="visible"
            className="max-w-3xl"
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium text-accent">AI-Powered Alumni Intelligence</span>
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold text-primary-foreground leading-[1.1] mb-6">
              Where Alumni
              <br />
              <span className="text-gradient-primary">Networks Thrive</span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-primary-foreground/70 max-w-xl mb-10 font-body">
              The multi-tenant intelligence platform that transforms alumni databases into living, engaged communities driving real institutional outcomes.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-4">
              <Link to="/auth">
                <Button variant="hero" size="xl">
                  Get Started <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Button variant="hero-outline" size="xl">
                Watch Demo
              </Button>
            </motion.div>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            id="stats"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {stats.map((s) => (
              <div key={s.label} className="bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 rounded-xl p-6 text-center">
                <div className="text-3xl md:text-4xl font-heading font-bold text-accent mb-1">{s.value}</div>
                <div className="text-sm text-primary-foreground/60">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
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

      {/* CTA */}
      <section className="py-24 bg-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: 'cover' }} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative container mx-auto px-6 text-center"
        >
          <h2 className="text-3xl md:text-5xl font-heading font-bold text-primary-foreground mb-6">
            Ready to Transform Your Alumni Network?
          </h2>
          <p className="text-primary-foreground/70 max-w-xl mx-auto mb-10 text-lg">
            Join institutions already achieving measurable outcomes through AI-driven alumni engagement.
          </p>
          <Link to="/auth">
            <Button variant="hero" size="xl">
              Launch Your Platform <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
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
