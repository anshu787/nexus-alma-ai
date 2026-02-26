import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NotifPrefs {
  desktop_enabled: boolean;
  [key: string]: boolean;
}

export function useBrowserNotifications() {
  const { user } = useAuth();
  const permissionRef = useRef<NotificationPermission>("default");
  const swRef = useRef<ServiceWorkerRegistration | null>(null);
  const prefsRef = useRef<NotifPrefs | null>(null);

  // Register service worker on mount
  useEffect(() => {
    if (!("Notification" in window)) return;
    permissionRef.current = Notification.permission;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw-notifications.js")
        .then((reg) => { swRef.current = reg; })
        .catch((err) => console.warn("SW registration failed:", err));

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "NOTIFICATION_CLICK" && event.data.url) {
          window.location.href = event.data.url;
        }
      });
    }
  }, []);

  // Load preferences
  useEffect(() => {
    if (!user) return;
    supabase.from("notification_preferences").select("*").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) prefsRef.current = data as unknown as NotifPrefs;
      });
  }, [user]);

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

          const prefs = prefsRef.current;
          if (prefs && !prefs.desktop_enabled) return;

          const n = payload.new as { title: string; message: string | null; type: string; link: string | null };

          // Check type-specific preference
          if (prefs && n.type in prefs && !prefs[n.type]) return;

          if (swRef.current?.active) {
            swRef.current.active.postMessage({
              type: "SHOW_NOTIFICATION",
              title: n.title,
              body: n.message || undefined,
              icon: "/favicon.ico",
              tag: `notif-${Date.now()}`,
              link: n.link,
            });
          } else {
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
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  return { requestPermission, supported: "Notification" in window };
}
