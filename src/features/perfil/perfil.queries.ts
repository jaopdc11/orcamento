import { api } from '@/lib/api'
import type { Perfil } from '@/lib/tipos'

export const salvarNome = (nome: string | null) => api.put<Perfil>('/perfil', { nome })
export const pedirTrocaEmail = (novo_email: string) => api.post<{ enviado: true }>('/perfil/email', { novo_email })
export const confirmarTrocaEmail = (codigo: string) => api.post<Perfil>('/perfil/email/confirmar', { codigo })
export const encerrarOutrasSessoes = () => api.del<{ encerradas: number }>('/perfil/sessoes')
