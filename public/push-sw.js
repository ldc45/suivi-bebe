/* Réception des notifications (chargé par le service worker de l'appli, voir vite.config.ts). */
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "Suivi bébé", body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || "Suivi bébé", {
    body: d.body || "",
    // Une seule notification par sujet : la nouvelle remplace l'ancienne, avec une alerte discrète.
    tag: d.tag || "suivi-bebe",
    renotify: Boolean(d.tag),
    // La nuit, sans son ni vibration (sauf alertes importantes, décidé par le serveur).
    silent: Boolean(d.silent),
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    lang: "fr",
    data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) if ("focus" in w) { await w.focus(); if ("navigate" in w) await w.navigate(url).catch(() => {}); return; }
    await self.clients.openWindow(url);
  })());
});
