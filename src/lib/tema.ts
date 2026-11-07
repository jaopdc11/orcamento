// Tema claro/escuro por CLASSE (.dark no <html>), pra o toggle mandar.
// O ESCURO é o padrão (identidade do app); claro só se o usuário escolher.
// O script inline do index.html aplica a mesma regra antes do render pra não piscar.

const CHAVE = 'orcamento:tema'
export type Tema = 'claro' | 'escuro'

// mesmas cores do --fundo de cada tema (barra de status do celular combina)
const COR_BARRA: Record<Tema, string> = { escuro: '#060910', claro: '#f4f6f9' }

export function temaAtual(): Tema {
  try {
    if (localStorage.getItem(CHAVE) === 'claro') return 'claro'
  } catch {
    /* storage bloqueado: fica no padrão */
  }
  return 'escuro'
}

export function aplicarTema(t: Tema): void {
  document.documentElement.classList.toggle('dark', t === 'escuro')
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute('content', COR_BARRA[t]))
}

export function alternarTema(): Tema {
  const novo: Tema = temaAtual() === 'escuro' ? 'claro' : 'escuro'
  try {
    localStorage.setItem(CHAVE, novo)
  } catch {
    /* segue só na sessão */
  }
  aplicarTema(novo)
  return novo
}
