/** @type {import('tailwindcss').Config} */

// Cores são TOKENS POR PAPEL (fundo, superficie, texto, entrada...), dirigidos por
// CSS variables em canais "r g b" — assim bg-superficie/60 funciona e o tema troca
// sem tocar em className. Os valores vivem no src/index.css (:root = claro,
// .dark = escuro, que é o principal). Tela NUNCA usa cor literal (gray-500, #fff):
// só papel. Ver DESIGN.md.
const cor = (nome) => `rgb(var(${nome}) / <alpha-value>)`

// easing do jão: sai rápido e assenta devagar — é o que dá "peso" sem ser mole.
const SUAVE = 'cubic-bezier(0.16, 1, 0.3, 1)'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fundo: cor('--fundo'),
        superficie: cor('--superficie'),
        'superficie-alta': cor('--superficie-alta'),
        campo: cor('--campo'),
        borda: cor('--borda'),
        'borda-forte': cor('--borda-forte'),
        texto: cor('--texto'),
        // "text-suave" / "text-tenue" leem melhor que "text-texto-suave"
        suave: cor('--texto-suave'),
        tenue: cor('--texto-tenue'),
        acento: cor('--acento'),
        'acento-suave': cor('--acento-suave'),
        'sobre-acento': cor('--sobre-acento'),
        entrada: cor('--entrada'),
        saida: cor('--saida'),
        atencao: cor('--atencao'),
        perigo: cor('--perigo'),
        // fundos tintados de estado (chip, badge, ícone, faixa de aviso)
        'tinta-acento': cor('--tinta-acento'),
        'tinta-entrada': cor('--tinta-entrada'),
        'tinta-saida': cor('--tinta-saida'),
        'tinta-atencao': cor('--tinta-atencao'),
        'tinta-perigo': cor('--tinta-perigo'),

      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Space Grotesk"', '"Inter Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        // sheet e caixas grandes um degrau acima do card
        sheet: '20px',
      },
      boxShadow: {
        // o "fio de luz" no topo é o que dá volume ao card escuro sem glow
        card: 'var(--sombra-card)',
        flutuante: 'var(--sombra-flutuante)',
      },
      // Tailwind 3 só tem min-h-0/full/screen: sem isto, min-h-11 (alvo de toque
      // de 44px) não gera CSS nenhum e todo botão vira uma fita achatada.
      minHeight: ({ theme }) => theme('spacing'),
      spacing: {
        nav: '4.25rem', // altura da nav inferior (sem safe-area)
        topo: '3.5rem', // altura da top bar
        sidebar: '15rem',
      },
      transitionTimingFunction: {
        suave: SUAVE,
      },
      keyframes: {
        subir: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'subir-sheet': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.7)' },
          '70%': { transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        toast: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        brilho: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        subir: `subir 0.36s ${SUAVE} both`,
        'subir-sheet': `subir-sheet 0.32s ${SUAVE} both`,
        fade: 'fade 0.2s ease-out both',
        pop: `pop 0.32s ${SUAVE} both`,
        'scale-in': `scale-in 0.26s ${SUAVE} both`,
        toast: `toast 0.3s ${SUAVE} both`,
        brilho: 'brilho 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
