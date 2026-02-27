import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  PhoneOutgoing, Search, Loader2, Calendar, Users, Clock,
  Send, Plus, Trash2, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AlumniResult {
  user_id: string;
  full_name: string;
  company: string | null;
  designation: string | null;
  batch: string | null;
}

interface ScheduledCall {
  id: string;
  user_id: string;
  scheduled_at: string;
  call_type: string;
  status: string;
  event_id: string | null;
  user_name?: string;
}

interface EventOption {
  id: string;
  title: string;
  start_date: string;
}

export default function OutboundScheduler() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AlumniResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedAlumni, setSelectedAlumni] = useState<AlumniResult[]>([]);
  const [callType, setCallType] = useState<string>("reminder");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [customMessage, setCustomMessage] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
    fetchScheduledCalls();
  }, []);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from("events")
      .select("id, title, start_date")
      .gte("start_date", new Date().toISOString())
      .order("start_date")
      .limit(20);
    if (data) setEvents(data);
  };

  const fetchScheduledCalls = async () => {
    setLoadingCalls(true);
    const { data } = await supabase
      .from("scheduled_calls")
      .select("*")
      .order("scheduled_at", { ascending: false })
      .limit(50);

    if (data) {
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : { data: [] };
      const nameMap: Record<string, string> = {};
      profiles?.forEach(p => { nameMap[p.user_id] = p.full_name; });
      setScheduledCalls(data.map(c => ({ ...c, user_name: nameMap[c.user_id] || "Unknown" })));
    }
    setLoadingCalls(false);
  };

  const searchAlumni = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, company, designation, batch")
      .ilike("full_name", `%${searchQuery}%`)
      .limit(10);
    if (data) setSearchResults(data);
    setSearching(false);
  };

  const addAlumni = (alumni: AlumniResult) => {
    if (!selectedAlumni.find(a => a.user_id === alumni.user_id)) {
      setSelectedAlumni([...selectedAlumni, alumni]);
    }
    setSearchResults([]);
    setSearchQuery("");
  };

  const removeAlumni = (userId: string) => {
    setSelectedAlumni(selectedAlumni.filter(a => a.user_id !== userId));
  };

  const scheduleCallsForSelected = async () => {
    if (selectedAlumni.length === 0) {
      toast.error("Select at least one alumni");
      return;
    }
    if (callType === "reminder" && !selectedEvent) {
      toast.error("Select an event for reminder calls");
      return;
    }

    const scheduledAt = new Date(Date.now() + 60000).toISOString(); // schedule 1 min from now

    const rows = selectedAlumni.map(a => ({
      user_id: a.user_id,
      scheduled_at: scheduledAt,
      call_type: callType,
      event_id: callType === "reminder" ? selectedEvent : null,
      status: "pending",
    }));

    const { error } = await supabase.from("scheduled_calls").insert(rows);
    if (error) {
      toast.error("Failed to schedule calls");
    } else {
      toast.success(`${rows.length} call(s) scheduled!`);
      setSelectedAlumni([]);
      fetchScheduledCalls();
    }
  };

  const triggerCall = async (call: ScheduledCall) => {
    if (!phoneNumber.trim()) {
      toast.error("Enter the alumni's phone number to trigger the call");
      return;
    }
    setTriggering(call.id);

    const { data, error } = await supabase.functions.invoke("voice-outbound", {
      body: {
        action: "reminder",
        user_id: call.user_id,
        event_id: call.event_id,
        phone_number: phoneNumber,
        message: customMessage || undefined,
      },
    });

    if (error) {
      toast.error("Failed to trigger call");
    } else {
      toast.success("Call triggered successfully!");
      fetchScheduledCalls();
    }
    setTriggering(null);
  };

  const statusColors: Record<string, string> = {
    pending: "bg-warning/10 text-warning border-warning/20",
    called: "bg-success/10 text-success border-success/20",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
    cancelled: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-6">
      {/* Schedule New Calls */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
        <h3 className="font-heading font-semibold text-card-foreground flex items-center gap-2">
          <Plus className="h-4 w-4 text-accent" /> Schedule Outbound Calls
        </h3>

        {/* Call Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Call Type</Label>
            <Select value={callType} onValueChange={setCallType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reminder">Event Reminder</SelectItem>
                <SelectItem value="outbound">General Outbound</SelectItem>
                <SelectItem value="bridge">Session Bridge</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {callType === "reminder" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Event</Label>
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                <SelectContent>
                  {events.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title} — {new Date(e.start_date).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Alumni Search */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Search Alumni</Label>
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
              onKeyDown={e => e.key === "Enter" && searchAlumni()}
            />
            <Button variant="outline" size="sm" onClick={searchAlumni} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="bg-secondary rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
              {searchResults.map(r => (
                <div
                  key={r.user_id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-background cursor-pointer transition-colors"
                  onClick={() => addAlumni(r)}
                >
                  <div>
                    <span className="text-sm font-medium text-foreground">{r.full_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {[r.designation, r.company, r.batch].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-accent" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Alumni */}
        {selectedAlumni.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Selected ({selectedAlumni.length})
            </Label>
            <div className="flex flex-wrap gap-2">
              {selectedAlumni.map(a => (
                <Badge
                  key={a.user_id}
                  className="bg-accent/10 text-accent border-accent/20 cursor-pointer gap-1"
                  onClick={() => removeAlumni(a.user_id)}
                >
                  {a.full_name} <Trash2 className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Button
          variant="hero"
          size="sm"
          onClick={scheduleCallsForSelected}
          disabled={selectedAlumni.length === 0}
          className="w-full sm:w-auto"
        >
          <Calendar className="h-4 w-4" /> Schedule {selectedAlumni.length} Call(s)
        </Button>
      </div>

      {/* Scheduled Calls List */}
      <div className="space-y-3">
        <h3 className="font-heading font-semibold text-card-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" /> Scheduled Calls
        </h3>

        {loadingCalls ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : scheduledCalls.length === 0 ? (
          <div className="text-center py-8">
            <PhoneOutgoing className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No scheduled calls yet</p>
          </div>
        ) : (
          scheduledCalls.map((call, i) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="bg-card border border-border rounded-xl p-4 shadow-card"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <PhoneOutgoing className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-card-foreground">{call.user_name}</span>
                    <Badge variant="outline" className={`text-[10px] ${statusColors[call.status] || ""}`}>
                      {call.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {call.call_type}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Scheduled: {new Date(call.scheduled_at).toLocaleString()}
                  </p>
                </div>
                {call.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="+1234567890"
                      className="w-36 h-8 text-xs"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                    />
                    <Button
                      variant="hero"
                      size="sm"
                      onClick={() => triggerCall(call)}
                      disabled={triggering === call.id}
                    >
                      {triggering === call.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Call
                    </Button>
                  </div>
                )}
                {call.status === "called" && (
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
