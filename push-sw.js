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
      // aviso de meta: mesma tag por categoria/mês, o de 100% substitui o de 80% na bandeja.
      // Lançamento e recorrente não têm tag: cada um fica.
      tag: msg.data && msg.data.tela === 'metas' ? `meta:${msg.title}:${msg.data.mes || ''}` : undefined,
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  evento.waitUntil(
    (async () => {
      const d = evento.notification.data || {}
      const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // reaproveita a aba do app em vez de abrir outra a cada aviso; ela abre Metas no mês do aviso
      for (const c of abertas) {
        if ('focus' in c) {
          if (d.ledgerId && d.mes) c.postMessage({ tipo: 'abrir', ledgerId: d.ledgerId, mes: d.mes, tela: d.tela, lancamentoId: d.lancamentoId })
          return c.focus()
        }
      }
      const q = d.ledgerId && d.mes ? `/?orcamento=${encodeURIComponent(d.ledgerId)}&mes=${encodeURIComponent(d.mes)}&tela=${d.tela === 'inicio' ? 'inicio' : 'metas'}${d.lancamentoId ? `&lancamento=${encodeURIComponent(d.lancamentoId)}` : ''}` : '/'
      return self.clients.openWindow(q)
    })(),
  )
})
