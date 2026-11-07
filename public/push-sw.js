// F8 — importado pelo service worker gerado (vite.config.ts → workbox.importScripts).
// Payload do servidor: { title, body, data: { ledgerId, mes } }.

self.addEventListener('push', (evento) => {
  let msg = {}
  try {
    msg = evento.data ? evento.data.json() : {}
  } catch {
    msg = { body: evento.data ? evento.data.text() : '' }
  }
  evento.waitUntil(
    self.registration.showNotification(msg.title || 'Orçamento', {
      body: msg.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: msg.data || {},
      // mesma tag por categoria/mês: o aviso de 100% substitui o de 80% na bandeja
      tag: msg.title ? `meta:${msg.title}:${(msg.data && msg.data.mes) || ''}` : undefined,
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  evento.waitUntil(
    (async () => {
      const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // reaproveita a aba do app em vez de abrir outra a cada aviso
      for (const c of abertas) {
        if ('focus' in c) return c.focus()
      }
      return self.clients.openWindow('/')
    })(),
  )
})
