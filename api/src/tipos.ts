// Variáveis que os middlewares deixam no contexto do Hono.
export type Ambiente = {
  Variables: {
    uid: string
    email: string
    ledgerId: string
  }
}
