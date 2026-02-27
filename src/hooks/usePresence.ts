import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePresence(userId: string | undefined) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const ch = supabase.channel("global-presence", {
      config: { presence: { key: userId } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      setOnlineUsers(new Set(Object.keys(state)));
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });

    channelRef.current = ch;

    return () => {
      ch.untrack();
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [userId]);

  const isOnline = (uid: string) => onlineUsers.has(uid);

  return { onlineUsers, isOnline };
}
