import { config } from './config'

export type Enviador = (para: string, codigo: string) => Promise<void>

/** Resend por fetch puro: um POST não justifica um SDK. */
const viaResend: Enviador = async (para, codigo) => {
  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.emailRemetente,
      to: [para],
      subject: `Seu código: ${codigo}`,
      // Texto puro, sem link: o login é digitando o código DENTRO da PWA.
      text: `Seu código do Orçamento é ${codigo}.\n\nVale por 10 minutos. Se não foi você, ignore.`,
    }),
  })
  if (!resposta.ok) {
    throw new Error(`Resend respondeu ${resposta.status}: ${await resposta.text()}`)
  }
}

let enviador: Enviador = viaResend

export function enviarCodigo(para: string, codigo: string): Promise<void> {
  return enviador(para, codigo)
}

/** Só pros testes: troca o Resend por algo que guarda o código em memória. */
export function trocarEnviador(novo: Enviador): void {
  enviador = novo
}
