// Service worker de ColonTab: solo maneja los clics en las notificaciones.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/admin'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const target = new URL(url, self.location.origin)
      const same = all.find((c) => new URL(c.url).pathname === target.pathname) || all.find((c) => c.url.includes('/admin'))
      if (same) return same.focus()
      return self.clients.openWindow(target.href)
    })(),
  )
})
