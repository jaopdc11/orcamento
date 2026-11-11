# App Android do Orçamento — design (rascunho)

Status: decidido em 2026-11-11 (FCM pelo nativo; digital na abertura fria e após 5 min fora). Implementado em `android-app/` e `orcamento-api` (rotas `/push/fcm`).

## Intenção

APK do Orçamento para uso próprio (jão e Gabi), no padrão do `us8-mobile`
(`~/programas/WK/AV09/us8-mobile`): casco nativo fino que abre o site ao vivo
(`https://orcamento.jaopd.dev`) num WebView. Deploy do front aparece no app sem
novo build; build novo só quando muda o nativo.

## Decidido

| Item | Decisão |
|---|---|
| Base | Casco Capacitor fino, abre `orcamento.jaopd.dev` direto, sem tela local; login é o do próprio site |
| Notificação | Entra agora, via FCM |
| Digital | Sim — trava local para abrir o app (não substitui o login por código) |
| Local | Pasta dentro do repo `orcamento` (ex.: `orcamento/android-app/`) |
| Distribuição | Só APK assinado, para dois aparelhos; sem Play Store |

## Contexto que molda o desenho

- **Login por código de e-mail, sem senha.** Sessão em cookie `HttpOnly; Secure; SameSite=Lax`, 90 dias deslizantes (`orcamento-api`, módulo `auth`). O WebView guarda o cookie sozinho: não há entrega de sessão como no us8 (`app_auth` no localStorage) nem login no casco.
- **Site único:** sem hub.
- **PWA offline-first:** service worker + fila de lançamentos no `localStorage` (`src/lib/fila.ts`). O WebView do Android suporta service worker, então após o primeiro carregamento o site abre offline pelo cache do SW — precisa ser validado no aparelho (abrir em modo avião).
- **Push atual é Web Push (VAPID)**, que não funciona dentro do WebView. O site continua com Web Push; o app ganha FCM em paralelo.

## Reaproveitado do us8-mobile

- Navegação sem `server.allowNavigation` (`NavegacaoPlugin.shouldOverrideLoad` para `orcamento.jaopd.dev`; outros domínios abrem no navegador do sistema). Site não tem acesso à ponte nativa.
- Voltar pelo histórico do WebView; sem histórico, fecha.
- Edge-to-edge com padding de systemBars + cutout no container do WebView; `SystemBars.insetsHandling: "disable"`.
- `allowBackup="false"` + `dataExtractionRules` excluindo tudo; `loggingBehavior: "none"`; `appendUserAgent`.
- Stub de `window.Capacitor` no site (evita erro em pausa/retomada).
- Build release assinado com keystore próprio; `profileinstaller`; nunca avaliar fluidez em debug.

## Digital (trava ao abrir)

**[proposta]** `BiometricPrompt` nativo cobrindo o WebView (tela de bloqueio nativa por cima), aceitando também PIN/padrão do aparelho como fallback (`BIOMETRIC_STRONG | DEVICE_CREDENTIAL`), para não ficar trancado fora se a digital falhar. Nada no backend.

**[pendente]** Quando pede: a cada abertura e toda volta do segundo plano, ou só após X minutos fora do app.

## Notificação (FCM)

Caminhos considerados:

1. **[proposta, recomendado] Pelo nativo.** `MainActivity` obtém o token FCM, lê o cookie de sessão via `CookieManager` e chama rota nova `POST /push/fcm` com o `Origin` do front (passa no CSRF). Front não muda. Retenta quando o usuário loga (antes não há cookie).
2. **Pelo site.** Script de início de documento injeta o token; `push.ts` registra. Acopla front ao app.
3. **Ponte Capacitor liberada ao site.** Descartado por segurança.

Na API (qualquer caminho): tabela de tokens FCM por usuário/aparelho, remoção do token no logout/invalidação, e envio FCM HTTP v1 dentro de `verificarMetas` (mesmo título/corpo/`data` do Web Push). Conta de serviço do Firebase no servidor (VPS).

Toque na notificação: abre o app no orçamento/mês do `data` (`ledgerId`, `mes`).

**[pendente]** Confirmar o caminho 1.

## Não-objetivos

- Play Store, iOS.
- Cópia do front embarcada no APK.
- Digital substituindo o login por código.
