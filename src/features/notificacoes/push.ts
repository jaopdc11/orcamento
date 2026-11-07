// F8 — inscrição Web Push. O SW gerado já importa public/push-sw.js, que
// mostra a notificação; aqui só se pede permissão e se registra no servidor.
import { api } from '@/lib/api'
import type { ChavePublica } from '@/lib/tipos'

export type EstadoPush = 'sem-suporte' | 'desligado-servidor' | 'bloqueado' | 'inativo' | 'ativo'

export function suportaPush(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** A chave VAPID vem em base64url; o pushManager quer bytes. */
function bytesDaChave(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function registro(): Promise<ServiceWorkerRegistration | null> {
  // Em dev (sem SW) o ready nunca resolve: corta pra não pendurar o botão.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((ok) => setTimeout(() => ok(null), 3000)),
  ])
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!suportaPush()) return 'sem-suporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  const { chave } = await api.get<ChavePublica>('/push/chave-publica')
  if (!chave) return 'desligado-servidor'
  const reg = await registro()
  if (!reg) return 'sem-suporte'
  return (await reg.pushManager.getSubscription()) ? 'ativo' : 'inativo'
}

/** Pede permissão, inscreve no navegador e registra no servidor. */
export async function ativarPush(): Promise<EstadoPush> {
  if (!suportaPush()) return 'sem-suporte'
  const { chave } = await api.get<ChavePublica>('/push/chave-publica')
  if (!chave) return 'desligado-servidor'
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return permissao === 'denied' ? 'bloqueado' : 'inativo'
  const reg = await registro()
  if (!reg) return 'sem-suporte'
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDaChave(chave) }))
  const json = sub.toJSON()
  await api.post('/push/inscricoes', { endpoint: json.endpoint, keys: json.keys })
  return 'ativo'
}

export async function desativarPush(): Promise<EstadoPush> {
  if (!suportaPush()) return 'sem-suporte'
  const reg = await registro()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    // servidor primeiro: se cair a rede, o navegador continua inscrito e dá pra tentar de novo
    await api.post('/push/inscricoes/remover', { endpoint: sub.endpoint })
    await sub.unsubscribe()
  }
  return 'inativo'
}
