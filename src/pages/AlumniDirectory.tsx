import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, Building2, GraduationCap, CheckCircle2, Briefcase, Heart, Loader2, Mail, Calendar, Star, Award, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  bio: string | null;
  industry: string | null;
  experience_years: number | null;
  interests: string[];
  social_links: any;
  passing_year: number | null;
  engagement_score: number | null;
  avatar_url: string | null;
}

const filters = ["All", "Hiring", "Mentors", "Verified"];

export default function AlumniDirectory() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlumni, setSelectedAlumni] = useState<Alumni | null>(null);

  useEffect(() => {
    const fetchAlumni = async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, batch, department, company, designation, location, skills, is_verified, is_hiring, is_mentor, bio, industry, experience_years, interests, social_links, passing_year, engagement_score, avatar_url").order("full_name");
      setAlumni((data || []).map(d => ({ ...d, skills: d.skills || [], interests: d.interests || [] })));
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
              className="bg-card border border-border rounded-xl p-5 shadow-card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedAlumni(a)}>
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  {a.avatar_url ? <img src={a.avatar_url} alt={a.full_name} className="h-12 w-12 rounded-full object-cover" /> : <span className="font-heading font-bold text-accent">{initials}</span>}
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

      {/* Alumni Profile Detail Modal */}
      <Dialog open={!!selectedAlumni} onOpenChange={(open) => !open && setSelectedAlumni(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedAlumni && (() => {
            const a = selectedAlumni;
            const initials = a.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      {a.avatar_url ? <img src={a.avatar_url} alt={a.full_name} className="h-16 w-16 rounded-full object-cover" /> : <span className="font-heading font-bold text-accent text-xl">{initials}</span>}
                    </div>
                    <div>
                      <DialogTitle className="flex items-center gap-2">
                        {a.full_name}
                        {a.is_verified && <CheckCircle2 className="h-4 w-4 text-info" />}
                      </DialogTitle>
                      <p className="text-sm text-muted-foreground">{a.designation || "—"} {a.company ? `at ${a.company}` : ""}</p>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {a.is_hiring && <Badge className="bg-success/10 text-success border-success/20"><Briefcase className="h-3 w-3 mr-1" />Hiring</Badge>}
                    {a.is_mentor && <Badge className="bg-info/10 text-info border-info/20"><Heart className="h-3 w-3 mr-1" />Mentor</Badge>}
                    {a.is_verified && <Badge className="bg-primary/10 text-primary border-primary/20"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>}
                  </div>

                  {/* Bio */}
                  {a.bio && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">About</h4>
                      <p className="text-sm text-foreground">{a.bio}</p>
                    </div>
                  )}

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {a.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">{a.location}</span>
                      </div>
                    )}
                    {a.company && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">{a.company}</span>
                      </div>
                    )}
                    {a.batch && (
                      <div className="flex items-center gap-2 text-sm">
                        <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">Batch {a.batch}</span>
                      </div>
                    )}
                    {a.department && (
                      <div className="flex items-center gap-2 text-sm">
                        <Award className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">{a.department}</span>
                      </div>
                    )}
                    {a.industry && (
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">{a.industry}</span>
                      </div>
                    )}
                    {a.experience_years != null && a.experience_years > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">{a.experience_years} yrs exp</span>
                      </div>
                    )}
                    {a.passing_year && (
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">Passed {a.passing_year}</span>
                      </div>
                    )}
                    {a.engagement_score != null && a.engagement_score > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">{a.engagement_score} pts</span>
                      </div>
                    )}
                  </div>

                  {/* Skills */}
                  {a.skills.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Skills</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {a.skills.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                      </div>
                    </div>
                  )}

                  {/* Interests */}
                  {a.interests.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Interests</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {a.interests.map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                      </div>
                    </div>
                  )}

                  {/* Social Links */}
                  {a.social_links && typeof a.social_links === "object" && Object.keys(a.social_links).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Social Links</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(a.social_links as Record<string, string>).filter(([, v]) => v).map(([k, v]) => (
                          <a key={k} href={v} target="_blank" rel="noopener noreferrer">
                            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent/10"><ExternalLink className="h-3 w-3 mr-1" />{k}</Badge>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
