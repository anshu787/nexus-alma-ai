import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Slot {
  id: string;
  title: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  current_bookings: number;
  max_bookings: number;
  is_active: boolean;
}

interface Props {
  slots: Slot[];
  onSlotClick?: (slot: Slot) => void;
}

export default function MentorCalendarView({ slots, onSlotClick }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    for (const s of slots) {
      const key = s.slot_date;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [slots]);

  const prevMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {weekDays.map(d => (
          <div key={d} className="bg-muted px-2 py-1.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {d}
          </div>
        ))}
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const daySlots = slotsByDate[key] || [];
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);

          return (
            <div
              key={key}
              className={`bg-card min-h-[80px] p-1.5 ${!inMonth ? "opacity-30" : ""} ${today ? "ring-1 ring-inset ring-accent/40" : ""}`}
            >
              <span className={`text-xs font-medium block mb-1 ${today ? "text-accent font-bold" : "text-foreground"}`}>
                {format(day, "d")}
              </span>
              <div className="space-y-0.5">
                {daySlots.slice(0, 3).map(slot => (
                  <div
                    key={slot.id}
                    onClick={() => onSlotClick?.(slot)}
                    className={`text-[9px] leading-tight px-1 py-0.5 rounded cursor-pointer truncate ${
                      slot.is_active
                        ? slot.current_bookings >= slot.max_bookings
                          ? "bg-warning/15 text-warning"
                          : "bg-accent/15 text-accent"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {slot.start_time.slice(0, 5)} {slot.title.slice(0, 12)}
                  </div>
                ))}
                {daySlots.length > 3 && (
                  <span className="text-[9px] text-muted-foreground px-1">+{daySlots.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent/40" /> Available</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning/40" /> Fully booked</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted" /> Paused</span>
      </div>
    </div>
  );
}
