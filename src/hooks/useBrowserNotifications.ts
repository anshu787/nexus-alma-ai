import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useBrowserNotifications() {
  const { user } = useAuth();
  const permissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if (!("Notification" in window)) return;
    permissionRef.current = Notification.permission;
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) return false;
    const perm = await Notification.requestPermission();
    permissionRef.current = perm;
    return perm === "granted";
  };

  useEffect(() => {
    if (!user) return;
    if (!("Notification" in window)) return;

    const ch = supabase
      .channel("browser-push-notifs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (document.visibilityState === "visible") return;
          if (permissionRef.current !== "granted") return;

          const n = payload.new as { title: string; message: string | null; type: string; link: string | null };
          const notif = new Notification(n.title, {
            body: n.message || undefined,
            icon: "/favicon.ico",
            tag: `notif-${Date.now()}`,
          });

          notif.onclick = () => {
            window.focus();
            if (n.link) window.location.href = n.link;
            notif.close();
          };
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  return { requestPermission, supported: "Notification" in window };
}
