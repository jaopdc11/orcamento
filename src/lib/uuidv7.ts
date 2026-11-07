/**
 * UUIDv7: 48 bits de timestamp em milissegundos + aleatoriedade.
 *
 * Por que v7 e não v4, já que o id é gerado no cliente:
 *   - ordenável no tempo → o índice do Postgres não fragmenta a cada insert,
 *     e a lista tem ordem estável mesmo antes de sincronizar;
 *   - continua praticamente impossível de colidir.
 *
 * É este id que torna o reenvio da fila idempotente: reenviar a mesma linha
 * duas vezes vira `ON CONFLICT DO NOTHING`, não uma duplicata.
 */
export function uuidv7(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  const ms = Date.now()
  // 48 bits de timestamp, big-endian, nos bytes 0..5
  bytes[0] = (ms / 2 ** 40) & 0xff
  bytes[1] = (ms / 2 ** 32) & 0xff
  bytes[2] = (ms / 2 ** 24) & 0xff
  bytes[3] = (ms / 2 ** 16) & 0xff
  bytes[4] = (ms / 2 ** 8) & 0xff
  bytes[5] = ms & 0xff

  bytes[6] = (bytes[6] & 0x0f) | 0x70 // versão 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variante RFC 4122

  const hex: string[] = []
  for (const b of bytes) hex.push(b.toString(16).padStart(2, '0'))
  const s = hex.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}
