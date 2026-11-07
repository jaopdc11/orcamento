// Peças de UI usadas por várias telas. Só o que é genérico de verdade mora aqui.

import { Icone, type NomeIcone } from './icones'

/** Título padrão de tela (mesmo estilo do "Orçamento Mensal" do Dashboard). */
export function CabecalhoTela({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{titulo}</h2>
      {subtitulo && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{subtitulo}</p>}
    </div>
  )
}

/** Placeholder enquanto a feature não chega. Some quando a tela for implementada. */
export function EmConstrucao({ titulo, icone }: { titulo: string; icone: NomeIcone }) {
  return (
    <div>
      <CabecalhoTela titulo={titulo} />
      <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-600">
          <Icone n={icone} className="h-5 w-5" />
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">em construção</p>
      </div>
    </div>
  )
}
