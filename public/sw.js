/*
 * DekkerTracker service worker.
 *
 * Bewust minimaal: pagina's en data komen altijd vers van het netwerk (je
 * portfolio moet actueel zijn en is persoonlijk, dus geen caching van API's).
 * Alleen als er geen verbinding is, tonen we een offlinepagina. Daarnaast
 * vangt hij pushmeldingen op.
 */

const CACHE = "dekkertracker-v1"
const OFFLINE_URL = "/offline.html"
const PRECACHE = [OFFLINE_URL, "/brand/logo-mark.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  // Alleen paginanavigaties; al het andere (API, assets) gaat ongemoeid naar het netwerk
  if (event.request.mode !== "navigate") return
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)))
})

self.addEventListener("push", (event) => {
  if (!event.data) return
  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: "DekkerTracker", body: event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "DekkerTracker", {
      body: data.body,
      icon: data.icon || "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      data: { url: data.url || "/notificaties" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/overzicht"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ("focus" in w) {
          w.navigate(url)
          return w.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
