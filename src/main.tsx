import React from 'react'
import ReactDOM from 'react-dom/client'
// Fontes self-hosted (variáveis: um arquivo cobre todos os pesos) — o PWA
// precisa abrir com a cara certa sem rede, então nada de Google Fonts.
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'
import { App } from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
