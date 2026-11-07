// Verificação das duas áreas que o plano marcou como perigosas: data e dinheiro.
// Não é suíte de testes — é a rede contra os bugs específicos que este app tem.
// Rodar: pnpm verificar

import {
  hoje,
  paraDataLocal,
  diaMes,
  intervaloDoMes,
  deslocarMes,
  mesDe,
} from '../lib/datas'
import { formatarSeco, empurrarDigito, apagarDigito, paraCentavos } from '../lib/dinheiro'
import { uuidv7 } from '../lib/uuidv7'
import { gerarCsv } from '../lib/csv'

let falhas = 0

function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  if (!ok) {
    falhas++
    console.error(`✗ ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`)
  } else {
    console.log(`✓ ${nome}`)
  }
}

console.log('\n— datas —')

conferir('hoje() no formato YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(hoje()), true)

// O bug clássico: new Date('2026-01-31') é meia-noite UTC e vira 30/01 no Brasil.
conferir('paraDataLocal mantém o dia 31', paraDataLocal('2026-01-31').getDate(), 31)
conferir('paraDataLocal mantém o mês', paraDataLocal('2026-01-31').getMonth(), 0)
conferir('diaMes formata pt-BR', diaMes('2026-01-31'), '31/01')

// Virada de ano no intervalo do mês.
conferir('intervalo de dezembro vira o ano', intervaloDoMes('2026-12'), {
  inicio: '2026-12-01',
  fim: '2027-01-01',
})
conferir('intervalo de janeiro', intervaloDoMes('2026-01'), {
  inicio: '2026-01-01',
  fim: '2026-02-01',
})
conferir('deslocarMes volta o ano', deslocarMes('2026-01', -1), '2025-12')
conferir('deslocarMes avança o ano', deslocarMes('2026-12', 1), '2027-01')
conferir('mesDe extrai YYYY-MM', mesDe('2026-01-31'), '2026-01')

// A garantia que importa: uma compra às 23h do último dia do mês pertence
// àquele mês, não ao seguinte. Simula o formato que o cliente manda.
{
  const vinteETresHoras = new Date(2026, 0, 31, 23, 30)
  const iso = vinteETresHoras.toLocaleDateString('en-CA')
  const { inicio, fim } = intervaloDoMes('2026-01')
  conferir('compra 31/01 23h30 cai em janeiro', iso >= inicio && iso < fim, true)
  conferir('compra 31/01 23h30 NÃO cai em fevereiro', iso >= intervaloDoMes('2026-02').inicio, false)
}

console.log('\n— dinheiro —')

conferir('formatarSeco de 1234 centavos', formatarSeco(1234), '12,34')
conferir('formatarSeco de 0', formatarSeco(0), '0,00')
conferir('formatarSeco com milhar', formatarSeco(123456789), '1.234.567,89')

// Digitação estilo caixa eletrônico: 1 → 2 → 3 → 4 produz R$ 12,34
{
  let c = 0
  for (const t of ['1', '2', '3', '4']) c = empurrarDigito(c, t)
  conferir('empurrar 1,2,3,4 → 12,34', formatarSeco(c), '12,34')
  conferir('apagar volta um dígito', formatarSeco(apagarDigito(c)), '1,23')
}
conferir('empurrar ignora não-dígito', empurrarDigito(5, 'x'), 5)
conferir('empurrar respeita o teto', empurrarDigito(9_999_999_999, '9'), 9_999_999_999)

conferir('paraCentavos pt-BR completo', paraCentavos('R$ 1.234,56'), 123456)
conferir('paraCentavos com vírgula curta', paraCentavos('12,5'), 1250)
conferir('paraCentavos com ponto decimal', paraCentavos('12.50'), 1250)
conferir('paraCentavos inteiro', paraCentavos('12'), 1200)
conferir('paraCentavos vazio', paraCentavos('  '), null)
// o caso que dá centavo fantasma se alguém usar float em algum ponto
conferir('paraCentavos de 0.1+0.2', paraCentavos('0,30'), 30)

console.log('\n— uuidv7 —')

{
  const id = uuidv7()
  conferir('formato uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id), true)

  const muitos = Array.from({ length: 500 }, uuidv7)
  conferir('sem colisão em 500', new Set(muitos).size, 500)

  // ordenável no tempo: ids gerados depois ordenam depois como string
  const antes = uuidv7()
  const depois = await new Promise<string>((r) => setTimeout(() => r(uuidv7()), 5))
  conferir('ordenável no tempo', depois > antes, true)
}

console.log('\n— csv —')

{
  const cats = new Map([
    ['c1', { id: 'c1', nome: 'Mercado' } as never],
    ['c2', { id: 'c2', nome: 'Comer; fora' } as never],
  ])

  const csv = gerarCsv(
    [
      {
        occurred_on: '2026-01-31',
        kind: 'expense',
        amount_cents: 123456,
        descricao: 'pão',
        category_id: 'c1',
      },
    ],
    cats,
  )
  const linha = csv.split('\r\n')[1]
  conferir('linha de despesa sai negativa e em pt-BR', linha, '2026-01-31;saida;Mercado;pão;-1234,56')

  // Descrição é texto livre digitado por gente: separador e aspas aparecem.
  const arriscado = gerarCsv(
    [
      {
        occurred_on: '2026-01-05',
        kind: 'income',
        amount_cents: 500,
        descricao: 'ele disse "ok"; depois sumiu',
        category_id: 'c2',
      },
    ],
    cats,
  )
  const l2 = arriscado.split('\r\n')[1]
  conferir(
    'escapa aspas e ponto e vírgula',
    l2,
    '2026-01-05;entrada;"Comer; fora";"ele disse ""ok""; depois sumiu";5,00',
  )
  conferir('campos por linha não vazam', l2.split(';').length > 5, true)

  conferir('centavos redondos', gerarCsv(
    [{ occurred_on: '2026-01-01', kind: 'expense', amount_cents: 100, descricao: null, category_id: null }],
    cats,
  ).split('\r\n')[1], '2026-01-01;saida;;;-1,00')

  conferir('centavos com zero à esquerda', gerarCsv(
    [{ occurred_on: '2026-01-01', kind: 'expense', amount_cents: 5, descricao: null, category_id: null }],
    cats,
  ).split('\r\n')[1], '2026-01-01;saida;;;-0,05')
}

console.log(falhas === 0 ? '\nTudo certo.\n' : `\n${falhas} falha(s).\n`)
process.exit(falhas === 0 ? 0 : 1)
