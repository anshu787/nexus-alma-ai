import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, Users, Loader2, Send, CheckCircle2, Video, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Slot {
  id: string;
  mentor_id: string;
  title: string;
  description: string | null;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_bookings: number;
  current_bookings: number;
  meeting_link: string | null;
  is_active: boolean;
  mentor_name: string;
  mentor_designation: string | null;
  mentor_company: string | null;
  mentor_skills: string[] | null;
}

interface MySession {
  id: string;
  availability_id: string;
  status: string;
  student_message: string | null;
  mentor_feedback: string | null;
  created_at: string;
  mentor_name: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  title: string;
}

export default function StudentBookingView() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [mySessions, setMySessions] = useState<MySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingSlot, setBookingSlot] = useState<Slot | null>(null);
  const [message, setMessage] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookedSlotIds, setBookedSlotIds] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    if (!user) return;

    // Fetch available slots (future, active, not full)
    const today = new Date().toISOString().split("T")[0];
    const { data: slotsData } = await supabase
      .from("mentor_availability")
      .select("*")
      .eq("is_active", true)
      .gte("slot_date", today)
      .order("slot_date", { ascending: true });

    const availSlots = (slotsData || []).filter(s => s.current_bookings < s.max_bookings);

    // Get mentor profiles
    const mentorIds = [...new Set(availSlots.map(s => s.mentor_id))];
    let profiles: any[] = [];
    if (mentorIds.length > 0) {
      const { data } = await supabase.from("profiles").select("user_id, full_name, designation, company, skills").in("user_id", mentorIds);
      profiles = data || [];
    }

    const enriched = availSlots.map(s => {
      const p = profiles.find(pr => pr.user_id === s.mentor_id);
      return {
        ...s,
        mentor_name: p?.full_name || "Mentor",
        mentor_designation: p?.designation || null,
        mentor_company: p?.company || null,
        mentor_skills: p?.skills || null,
      };
    }) as Slot[];

    setSlots(enriched);

    // Fetch my sessions
    const { data: sessData } = await supabase
      .from("mentoring_sessions")
      .select("*")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });

    if (sessData && sessData.length > 0) {
      const sIds = [...new Set(sessData.map(s => s.availability_id))];
      const mIds = [...new Set(sessData.map(s => s.mentor_id))];
      const [{ data: avails }, { data: mProfs }] = await Promise.all([
        supabase.from("mentor_availability").select("id, slot_date, start_time, end_time, title").in("id", sIds),
        supabase.from("profiles").select("user_id, full_name").in("user_id", mIds),
      ]);

      const mapped = sessData.map(s => {
        const a = avails?.find(av => av.id === s.availability_id);
        const mp = mProfs?.find(pr => pr.user_id === s.mentor_id);
        return {
          ...s,
          mentor_name: mp?.full_name || "Mentor",
          slot_date: a?.slot_date || "",
          start_time: a?.start_time || "",
          end_time: a?.end_time || "",
          title: a?.title || "Session",
        };
      });
      setMySessions(mapped);
      setBookedSlotIds(new Set(sessData.map(s => s.availability_id)));
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const bookSession = async () => {
    if (!user || !bookingSlot) return;
    setBooking(true);
    try {
      const { error } = await supabase.from("mentoring_sessions").insert({
        availability_id: bookingSlot.id,
        mentor_id: bookingSlot.mentor_id,
        student_id: user.id,
        student_message: message || null,
      });
      if (error) throw error;

      // Notify mentor
      await supabase.from("notifications").insert({
        user_id: bookingSlot.mentor_id,
        type: "mentorship",
        title: "New Session Booking 📅",
        message: `A student has booked your ${bookingSlot.title} on ${format(new Date(bookingSlot.slot_date + "T00:00:00"), "MMM d")}.`,
        link: "/dashboard/mentor-dashboard",
      });

      toast.success("Session booked successfully!");
      setBookingSlot(null);
      setMessage("");
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Failed to book session");
    } finally {
      setBooking(false);
    }
  };

  const cancelSession = async (sessionId: string) => {
    const { error } = await supabase.from("mentoring_sessions").update({ status: "cancelled" }).eq("id", sessionId);
    if (error) { toast.error("Failed to cancel"); return; }
    toast.success("Session cancelled");
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-6">
      {/* My Sessions */}
      {mySessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" /> My Booked Sessions
          </h3>
          {mySessions.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-card border border-border rounded-lg p-4 shadow-card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-sm text-card-foreground">{s.title} with {s.mentor_name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.slot_date && format(new Date(s.slot_date + "T00:00:00"), "MMM d, yyyy")} • {s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}
                </p>
                {s.mentor_feedback && <p className="text-xs text-foreground mt-2 bg-secondary p-2 rounded italic">Feedback: "{s.mentor_feedback}"</p>}
              </div>
              <Badge className={
                s.status === "confirmed" ? "bg-success/10 text-success border-success/20 text-xs" :
                s.status === "booked" ? "bg-warning/10 text-warning border-warning/20 text-xs" :
                s.status === "completed" ? "bg-info/10 text-info border-info/20 text-xs" :
                "bg-destructive/10 text-destructive border-destructive/20 text-xs"
              }>{s.status}</Badge>
              {(s.status === "booked" || s.status === "confirmed") && (
                <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => cancelSession(s.id)}>Cancel</Button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Available Slots */}
      <div className="space-y-3">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Calendar className="h-5 w-5 text-accent" /> Available Mentoring Sessions
        </h3>
        {slots.length === 0 && <p className="text-sm text-muted-foreground py-4">No available sessions right now. Check back later!</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {slots.map((slot, i) => {
            const alreadyBooked = bookedSlotIds.has(slot.id);
            const initials = slot.mentor_name.split(" ").map(n => n[0]).join("").slice(0, 2);
            return (
              <motion.div key={slot.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-xl p-5 shadow-card hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="font-heading font-bold text-accent text-sm">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-sm text-card-foreground">{slot.mentor_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {slot.mentor_designation || "Mentor"}{slot.mentor_company ? ` at ${slot.mentor_company}` : ""}
                    </p>
                  </div>
                </div>
                <p className="font-medium text-sm text-foreground mb-1">{slot.title}</p>
                {slot.description && <p className="text-xs text-muted-foreground mb-2">{slot.description}</p>}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(slot.slot_date + "T00:00:00"), "MMM d, yyyy")}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{slot.start_time.slice(0,5)} - {slot.end_time.slice(0,5)}</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{slot.max_bookings - slot.current_bookings} spots left</span>
                  {slot.meeting_link && <Badge variant="outline" className="text-[10px]"><Video className="h-3 w-3 mr-0.5" />Virtual</Badge>}
                </div>
                {slot.mentor_skills && slot.mentor_skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {slot.mentor_skills.slice(0, 4).map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                  </div>
                )}
                <Button variant={alreadyBooked ? "outline" : "hero"} size="sm" className="w-full"
                  disabled={alreadyBooked}
                  onClick={() => { setBookingSlot(slot); setMessage(""); }}>
                  {alreadyBooked ? <><CheckCircle2 className="h-4 w-4" /> Already Booked</> : <><Send className="h-4 w-4" /> Book Session</>}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Booking Dialog */}
      <Dialog open={!!bookingSlot} onOpenChange={o => !o && setBookingSlot(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Book Mentoring Session</DialogTitle></DialogHeader>
          {bookingSlot && (
            <div className="space-y-4">
              <div className="bg-secondary rounded-lg p-3">
                <p className="font-heading font-semibold text-sm">{bookingSlot.title}</p>
                <p className="text-xs text-muted-foreground">{bookingSlot.mentor_name} • {format(new Date(bookingSlot.slot_date + "T00:00:00"), "MMM d, yyyy")} • {bookingSlot.start_time.slice(0,5)} - {bookingSlot.end_time.slice(0,5)}</p>
              </div>
              <Textarea placeholder="Introduce yourself and describe what you'd like to discuss..." value={message} onChange={e => setMessage(e.target.value)} rows={4} />
              <Button variant="hero" className="w-full" onClick={bookSession} disabled={booking}>
                {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Confirm Booking
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
