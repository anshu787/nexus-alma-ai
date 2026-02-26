// Service Worker for browser push notifications
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.link || "/dashboard/notifications";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.postMessage({ type: "NOTIFICATION_CLICK", url });
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    const { title, body, icon, tag, link } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: icon || "/favicon.ico",
      tag: tag || `notif-${Date.now()}`,
      data: { link },
      badge: "/favicon.ico",
      requireInteraction: false,
    });
  }
});
