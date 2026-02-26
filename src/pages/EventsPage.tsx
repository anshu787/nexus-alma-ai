import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, Clock, Video, Plus, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const mockEvents = [
  {
    id: "1", title: "AI/ML Alumni Meetup", description: "Join fellow alumni working in AI and ML for an evening of talks and networking.", event_type: "meetup",
    start_date: "2026-03-05T18:00:00Z", end_date: "2026-03-05T21:00:00Z", location: "Tech Hub, Bangalore", is_virtual: false, max_attendees: 150, attendees: 89, rsvped: false,
  },
  {
    id: "2", title: "Annual Alumni Reunion 2026", description: "The biggest event of the year! Reconnect with batchmates and celebrate our institution's legacy.", event_type: "reunion",
    start_date: "2026-04-12T10:00:00Z", end_date: "2026-04-12T22:00:00Z", location: "Main Campus Auditorium", is_virtual: false, max_attendees: 500, attendees: 320, rsvped: true,
  },
  {
    id: "3", title: "Startup Pitch Night", description: "Alumni founders pitch their startups to a panel of investors and mentors.", event_type: "workshop",
    start_date: "2026-03-18T19:00:00Z", end_date: "2026-03-18T21:30:00Z", location: "", is_virtual: true, max_attendees: 200, attendees: 67, rsvped: false,
  },
  {
    id: "4", title: "Career Mentorship Workshop", description: "One-on-one and group mentorship sessions for current students and recent graduates.", event_type: "mentorship",
    start_date: "2026-03-25T14:00:00Z", end_date: "2026-03-25T17:00:00Z", location: "Virtual via Zoom", is_virtual: true, max_attendees: 80, attendees: 42, rsvped: false,
  },
];

const typeColors: Record<string, string> = {
  meetup: "bg-info/10 text-info border-info/20",
  reunion: "bg-accent/10 text-accent border-accent/20",
  workshop: "bg-success/10 text-success border-success/20",
  mentorship: "bg-primary/10 text-primary border-primary/20",
};

export default function EventsPage() {
  const [events, setEvents] = useState(mockEvents);
  const [createOpen, setCreateOpen] = useState(false);

  const toggleRsvp = (id: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, rsvped: !e.rsvped, attendees: e.rsvped ? e.attendees - 1 : e.attendees + 1 }
          : e
      )
    );
    const event = events.find((e) => e.id === id);
    toast.success(event?.rsvped ? "RSVP cancelled" : "RSVP confirmed!");
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground text-sm">Reunions, workshops, webinars, and mentorship sessions</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm"><Plus className="h-4 w-4" /> Create Event</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle className="font-heading">Create New Event</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); toast.success("Event created!"); setCreateOpen(false); }} className="space-y-4">
              <div className="space-y-2"><Label>Title</Label><Input placeholder="Event title" required /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea placeholder="What's this event about?" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Start Date</Label><Input type="datetime-local" required /></div>
                <div className="space-y-2"><Label>End Date</Label><Input type="datetime-local" /></div>
              </div>
              <div className="space-y-2"><Label>Location</Label><Input placeholder="Venue or virtual link" /></div>
              <div className="space-y-2"><Label>Max Attendees</Label><Input type="number" placeholder="100" /></div>
              <Button variant="hero" className="w-full" type="submit">Create Event</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {events.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card border border-border rounded-xl overflow-hidden shadow-card hover:shadow-md transition-all"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <Badge className={typeColors[event.event_type] || typeColors.meetup}>
                  {event.event_type}
                </Badge>
                {event.rsvped && (
                  <Badge className="bg-success/10 text-success border-success/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Going
                  </Badge>
                )}
              </div>

              <h3 className="font-heading font-semibold text-lg text-card-foreground mb-2">{event.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{event.description}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  {formatDate(event.start_date)} • {formatTime(event.start_date)}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {event.is_virtual ? <Video className="h-4 w-4 shrink-0" /> : <MapPin className="h-4 w-4 shrink-0" />}
                  {event.is_virtual ? "Virtual Event" : event.location}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0" />
                  {event.attendees}{event.max_attendees ? ` / ${event.max_attendees}` : ""} attending
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={event.rsvped ? "outline" : "hero"}
                  size="sm"
                  className="flex-1"
                  onClick={() => toggleRsvp(event.id)}
                >
                  {event.rsvped ? <><X className="h-4 w-4" /> Cancel RSVP</> : <><CheckCircle2 className="h-4 w-4" /> RSVP</>}
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
