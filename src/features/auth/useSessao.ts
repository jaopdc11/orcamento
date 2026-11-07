import { useEffect, useState } from 'react'
import { api, aoMudarSessao, ErroApi, type Usuario } from '@/lib/api'

// O cookie de sessão é HttpOnly: o JS não sabe se está logado sem perguntar à API.
// Mas o caso principal do app é lançar DENTRO do mercado, sem sinal — então a
// última identidade conhecida fica em cache e o app abre offline. Ela não dá
// acesso a nada: quem decide é o cookie, quando a rede voltar.
const CACHE = 'orcamento:usuario'

function lerCache(): Usuario | null {
  try {
    const cru = localStorage.getItem(CACHE)
    return cru ? (JSON.parse(cru) as Usuario) : null
  } catch {
    return null
  }
}

function gravarCache(u: Usuario | null): void {
  try {
    if (u) localStorage.setItem(CACHE, JSON.stringify(u))
    else localStorage.removeItem(CACHE)
  } catch {
    /* sem storage: só não abre offline */
  }
}

export function useSessao() {
  const [sessao, setSessao] = useState<Usuario | null>(lerCache)
  const [carregando, setCarregando] = useState(() => lerCache() === null)

  useEffect(() => {
    let vivo = true
    const definir = (u: Usuario | null) => {
      gravarCache(u)
      if (vivo) setSessao(u)
    }

    api
      .get<Usuario>('/auth/eu')
      .then(definir)
      .catch((e) => {
        // Só 401 é "sem sessão". Sem rede, fica o cache.
        if (e instanceof ErroApi && e.status === 401) definir(null)
      })
      .finally(() => vivo && setCarregando(false))

    const parar = aoMudarSessao(definir)
    return () => {
      vivo = false
      parar()
    }
  }, [])

  return { sessao, carregando, usuarioId: sessao?.usuarioId ?? null }
}
