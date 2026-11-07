import { useEffect, useRef, useState } from 'react'
import { prefereParado } from './util'

export type PropsContador = {
  valor: number
  /** número corrente → texto (ex: centavos → formatar) */
  formatar?: (n: number) => string
  duracaoMs?: number
  className?: string
}

/**
 * Número que corre do valor anterior (ou zero) até o novo. Só no valor HERÓI da
 * tela — em lista inteira vira circo. Em reduced-motion vai direto.
 */
export function Contador({ valor, formatar, duracaoMs = 800, className }: PropsContador) {
  const parado = prefereParado()
  const [atual, setAtual] = useState(() => (parado ? valor : 0))
  const anterior = useRef(parado ? valor : 0)

  useEffect(() => {
    if (prefereParado()) {
      setAtual(valor)
      anterior.current = valor
      return
    }
    const de = anterior.current
    const ate = valor
    if (de === ate) return
    const inicio = performance.now()
    let frame = 0
    const passo = (agora: number) => {
      // clamp nos dois lados: timestamp de outra origem daria progresso negativo
      const t = Math.min(1, Math.max(0, (agora - inicio) / duracaoMs))
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t) // easeOutExpo: corre e assenta
      setAtual(de + (ate - de) * e)
      if (t < 1) frame = requestAnimationFrame(passo)
      else anterior.current = ate
    }
    frame = requestAnimationFrame(passo)
    return () => {
      cancelAnimationFrame(frame)
      anterior.current = valor
    }
  }, [valor, duracaoMs])

  // arredonda: centavo fracionário no meio da animação não existe pra quem lê
  const n = Math.round(atual)
  return <span className={className}>{formatar ? formatar(n) : n}</span>
}
