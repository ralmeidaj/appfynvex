import apiClient from './client';
import type {KycStatus} from '../types';

export interface CheckCpfResponse {
  empresa_id: number | null;
  possui_cadastro: boolean;
  kyc_status: KycStatus;
}

export const checkCpf = (cpf: string) =>
  apiClient.post<CheckCpfResponse>('/auth/cpf', {cpf});

export interface EmpresaResumo {
  id: number;
  nome_fantasia: string;
  cnpj: string;
  kyc_status: KycStatus;
  // RF-KYC-04: motivo quando kyc_status === 'rejected'; null nos demais casos.
  motivo_rejeicao: string | null;
}

export interface RepresentanteResumo {
  id: number;
  nome: string;
  perfil_acesso: string;
}

// RF-AUTH-01/03: login por CPF + senha só — emite o token direto, sem sessão
// de leitura facial nenhuma (RF-BIO-03). Mesmo formato de resposta de
// `confirmarRecuperacaoFacial`, já que os dois terminam entregando uma sessão
// autenticada equivalente.
export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  empresa: EmpresaResumo;
  representante: RepresentanteResumo;
}

export const login = (cpf: string, senha: string) =>
  apiClient.post<LoginResponse>('/auth/login', {cpf, senha});

export const logout = () => apiClient.post('/auth/logout');

/* -------------------------------------------------------------------------
   Recuperação de conta (RF-AUTH-08)
   ------------------------------------------------------------------------- */

export interface IniciarRecuperacaoResponse {
  status: string;
}

export interface ConfirmarRecuperacaoResponse {
  status: string;
  representante_id: number;
}

export const iniciarRecuperacao = (cpf: string, email: string) =>
  apiClient.post<IniciarRecuperacaoResponse>('/auth/recuperacao/iniciar', {cpf, email});

export const confirmarRecuperacao = (cpf: string, email: string, codigo: string, novaSenha: string) =>
  apiClient.post<ConfirmarRecuperacaoResponse>('/auth/recuperacao/confirmar', {
    cpf,
    email,
    codigo,
    nova_senha: novaSenha,
  });

// Par dedicado de leitura facial que encerra a recuperação (RF-AUTH-08/RF-BIO-03)
// — não reaproveita nada do login, que não tem leitura facial nenhuma.
export interface IniciarRecuperacaoFacialResponse {
  session_id: string;
  session_expires_in: number;
}

export const iniciarRecuperacaoFacial = (representanteId: number) =>
  apiClient.post<IniciarRecuperacaoFacialResponse>('/auth/recuperacao/leitura-facial/iniciar', {
    representante_id: representanteId,
  });

export const confirmarRecuperacaoFacial = (sessionId: string) =>
  apiClient.post<LoginResponse>('/auth/recuperacao/leitura-facial/confirmar', {
    session_id: sessionId,
  });
