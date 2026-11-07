// Tema claro/escuro por CLASSE (igual o cashly: `.dark` no <html>), não por
// media-query — assim o toggle da sidebar manda. O padrão segue o sistema até o
// usuário escolher. Um script inline no index.html aplica antes do render pra não
// piscar branco.

const CHAVE = 'orcamento:tema'
export type Tema = 'claro' | 'escuro'

export function temaAtual(): Tema {
  try {
    const s = localStorage.getItem(CHAVE)
    if (s === 'claro' || s === 'escuro') return s
  } catch {
    /* storage bloqueado */
  }
  const escuroDoSistema =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  return escuroDoSistema ? 'escuro' : 'claro'
}

export function aplicarTema(t: Tema): void {
  document.documentElement.classList.toggle('dark', t === 'escuro')
  const cor = t === 'escuro' ? '#030712' : '#ffffff'
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute('content', cor))
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
