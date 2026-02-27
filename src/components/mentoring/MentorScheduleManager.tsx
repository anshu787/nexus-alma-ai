import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Calendar, Clock, Trash2, Loader2, Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface AvailabilitySlot {
  id: string;
  title: string;
  description: string | null;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_bookings: number;
  current_bookings: number;
  meeting_link: string | null;
  is_active: boolean;
}

export default function MentorScheduleManager() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "Mentoring Session",
    description: "",
    slot_date: "",
    start_time: "10:00",
    end_time: "11:00",
    max_bookings: 1,
    meeting_link: "",
  });

  const fetchSlots = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("mentor_availability")
      .select("*")
      .eq("mentor_id", user.id)
      .order("slot_date", { ascending: true });
    setSlots((data as AvailabilitySlot[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSlots(); }, [user]);

  const addSlot = async () => {
    if (!user || !form.slot_date || !form.start_time || !form.end_time) {
      toast.error("Please fill date and time fields");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("mentor_availability").insert({
        mentor_id: user.id,
        title: form.title,
        description: form.description || null,
        slot_date: form.slot_date,
        start_time: form.start_time,
        end_time: form.end_time,
        max_bookings: form.max_bookings,
        meeting_link: form.meeting_link || null,
      });
      if (error) throw error;
      toast.success("Availability slot added!");
      setDialogOpen(false);
      setForm({ title: "Mentoring Session", description: "", slot_date: "", start_time: "10:00", end_time: "11:00", max_bookings: 1, meeting_link: "" });
      fetchSlots();
    } catch (e: any) {
      toast.error(e.message || "Failed to add slot");
    } finally {
      setSaving(false);
    }
  };

  const deleteSlot = async (id: string) => {
    const { error } = await supabase.from("mentor_availability").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Slot removed");
    fetchSlots();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("mentor_availability").update({ is_active: !current }).eq("id", id);
    fetchSlots();
  };

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;

  const upcoming = slots.filter(s => s.slot_date >= new Date().toISOString().split("T")[0]);
  const past = slots.filter(s => s.slot_date < new Date().toISOString().split("T")[0]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Calendar className="h-5 w-5 text-accent" /> My Availability Schedule
        </h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm"><Plus className="h-4 w-4" /> Add Slot</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">Add Availability Slot</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Session title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <Textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Date</label>
                  <Input type="date" value={form.slot_date} onChange={e => setForm(f => ({ ...f, slot_date: e.target.value }))} min={new Date().toISOString().split("T")[0]} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Start</label>
                  <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">End</label>
                  <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Max Bookings</label>
                  <Input type="number" min={1} max={10} value={form.max_bookings} onChange={e => setForm(f => ({ ...f, max_bookings: parseInt(e.target.value) || 1 }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Meeting Link</label>
                  <Input placeholder="https://meet.google.com/..." value={form.meeting_link} onChange={e => setForm(f => ({ ...f, meeting_link: e.target.value }))} />
                </div>
              </div>
              <Button variant="hero" className="w-full" onClick={addSlot} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Slot
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {upcoming.length === 0 && past.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No availability slots yet. Add your first slot to start accepting mentoring sessions.
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upcoming ({upcoming.length})</p>
          {upcoming.map((slot, i) => (
            <motion.div key={slot.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-card border border-border rounded-lg p-4 shadow-card flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-sm text-card-foreground">{slot.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(slot.slot_date + "T00:00:00"), "MMM d, yyyy")}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{slot.start_time.slice(0,5)} - {slot.end_time.slice(0,5)}</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{slot.current_bookings}/{slot.max_bookings} booked</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {slot.meeting_link && <Badge variant="outline" className="text-[10px]"><Video className="h-3 w-3 mr-0.5" />Link</Badge>}
                <Badge className={slot.is_active ? "bg-success/10 text-success border-success/20 text-[10px]" : "bg-muted text-muted-foreground border-border text-[10px]"}
                  onClick={() => toggleActive(slot.id, slot.is_active)} style={{ cursor: "pointer" }}>
                  {slot.is_active ? "Active" : "Paused"}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteSlot(slot.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Past ({past.length})</p>
          {past.map(slot => (
            <div key={slot.id} className="bg-card border border-border rounded-lg p-3 shadow-card flex items-center gap-3 opacity-60">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{slot.title} — {format(new Date(slot.slot_date + "T00:00:00"), "MMM d")}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{slot.current_bookings} booked</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
