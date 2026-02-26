import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, Building2, GraduationCap, CheckCircle2, Briefcase, Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Alumni {
  user_id: string;
  full_name: string;
  batch: string | null;
  department: string | null;
  company: string | null;
  designation: string | null;
  location: string | null;
  skills: string[];
  is_verified: boolean | null;
  is_hiring: boolean | null;
  is_mentor: boolean | null;
}

const filters = ["All", "Hiring", "Mentors", "Verified"];

export default function AlumniDirectory() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlumni = async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, batch, department, company, designation, location, skills, is_verified, is_hiring, is_mentor").order("full_name");
      setAlumni((data || []).map(d => ({ ...d, skills: d.skills || [] })));
      setLoading(false);
    };
    fetchAlumni();
  }, []);

  const filtered = alumni.filter((a) => {
    const matchSearch = !search || a.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (a.company || "").toLowerCase().includes(search.toLowerCase()) ||
      a.skills.some(s => s.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = activeFilter === "All" ||
      (activeFilter === "Hiring" && a.is_hiring) ||
      (activeFilter === "Mentors" && a.is_mentor) ||
      (activeFilter === "Verified" && a.is_verified);
    return matchSearch && matchFilter;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Alumni Directory</h1>
        <p className="text-muted-foreground text-sm">Discover and connect with {alumni.length.toLocaleString()} alumni</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2.5 shadow-card">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, company, or skill..." className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full" />
        </div>
        <div className="flex gap-2">
          {filters.map((f) => (
            <Button key={f} variant={activeFilter === f ? "default" : "outline"} size="sm" onClick={() => setActiveFilter(f)} className="text-xs">{f}</Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a, i) => {
          const initials = a.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
          return (
            <motion.div key={a.user_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-card border border-border rounded-xl p-5 shadow-card hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="font-heading font-bold text-accent">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-heading font-semibold text-card-foreground text-sm truncate">{a.full_name}</h3>
                    {a.is_verified && <CheckCircle2 className="h-3.5 w-3.5 text-info shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{a.designation || "—"} {a.company ? `at ${a.company}` : ""}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    {a.location && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{a.location}</span>}
                    {a.batch && <span className="flex items-center gap-0.5"><GraduationCap className="h-3 w-3" />Batch {a.batch}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {a.is_hiring && <Badge className="bg-success/10 text-success border-success/20 text-[10px]"><Briefcase className="h-2.5 w-2.5 mr-0.5" />Hiring</Badge>}
                {a.is_mentor && <Badge className="bg-info/10 text-info border-info/20 text-[10px]"><Heart className="h-2.5 w-2.5 mr-0.5" />Mentor</Badge>}
                {a.skills.slice(0, 3).map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
              </div>
            </motion.div>
          );
        })}
      </div>
      {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No alumni found matching your criteria.</div>}
    </div>
  );
}
