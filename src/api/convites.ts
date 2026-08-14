import apiClient from './client';

// RF-REP-03: aceite do convite de representante_legal — anônimo (quem
// convida ainda não tem sessão), identificado só pelo `convite_id` opaco.
// Não emite token: fica `pendente_analise` até a revisão da equipe Fynvex
// (mesmo gate de RF-KYC-02).
export const aceitarConvite = (conviteId: string, senha: string) =>
  apiClient.post<{representante_id: number; status: string}>(`/convites/${conviteId}/aceitar`, {senha});

// RF-REP-03/RF-REP-08: confirmação do convite de visualizador — código por
// e-mail, sem leitura facial (esse perfil não passa por biometria). Também
// sem token: a pessoa loga normalmente depois com CPF + a senha definida aqui.
export const confirmarConviteVisualizador = (email: string, codigo: string, senha: string) =>
  apiClient.post<{representante_id: number; status: string}>('/convites/visualizador/confirmar', {
    email,
    codigo,
    senha,
  });
