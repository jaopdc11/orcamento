/** @type {import('tailwindcss').Config} */

// Tokens dirigidos por CSS variables (canais RGB separados por espaço), pra
// suportarem opacidade do Tailwind (bg-painel/60) e trocarem de valor entre
// claro e escuro sem tocar em nenhuma className. As cores em si vivem no index.css.
const cor = (nome) => `rgb(var(${nome}) / <alpha-value>)`

export default {
  // dark por classe (.dark no <html>), igual o cashly — o toggle da sidebar manda.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fundo: cor('--fundo'),
        painel: cor('--painel'),
        'painel-forte': cor('--painel-forte'),
        borda: cor('--borda'),
        texto: cor('--texto'),
        apagado: cor('--apagado'),
        primaria: cor('--primaria'),
        saida: cor('--saida'),
        entrada: cor('--entrada'),
        atencao: cor('--atencao'),
      },
    },
  },
  plugins: [],
}
