import apiClient from './client';
import type {KycStatus, PerfilAcesso, RepresentanteStatus, VinculoParceiroStatus} from '../types';

export interface DadosBancariosResponse {
  banco_id: number;
  banco_nome: string;
  agencia: string;
  conta: string;
  tipo_conta: 'corrente' | 'poupanca';
  tipo_transferencia: 'pix' | 'ted';
  pix: string;
}

export const getDadosBancarios = () => apiClient.get<DadosBancariosResponse>('/perfil/dados-bancarios');

export interface BancoOption {
  id: number;
  nome: string;
}

// §4.5 — lista de bancos pra preencher o seletor de RF-BANK-01. Público
// (não exige token), usada tanto no cadastro quanto na edição de perfil.
export const listarBancos = () => apiClient.get<{data: BancoOption[]}>('/bancos');

export interface AtualizarDadosBancariosPayload {
  bancoId: number;
  agencia: string;
  conta: string;
  tipoConta: 'corrente' | 'poupanca';
  tipoTransferencia: 'pix' | 'ted';
  pix: string;
}

export const atualizarDadosBancarios = (dados: AtualizarDadosBancariosPayload) =>
  apiClient.put<{status: string}>('/perfil/dados-bancarios', {
    banco_id: dados.bancoId,
    agencia: dados.agencia,
    conta: dados.conta,
    tipo_conta: dados.tipoConta,
    tipo_transferencia: dados.tipoTransferencia,
    pix: dados.pix,
  });

// RF-PERF-01: `documentos`/status de facial por representante não são
// retornados hoje (gap pré-existente — a persistência desses dados nunca
// existiu, nem durante o cadastro). O tipo reflete só o que o backend
// (mock) de fato envia.
export interface PerfilResponse {
  empresa_id: number;
  nome_fantasia: string;
  cnpj: string;
  kyc_status: KycStatus;
  vinculo_parceiro: {parceiro: string | null; status: VinculoParceiroStatus};
  representante_logado: {
    id: number;
    nome: string;
    cargo: string;
    perfil_acesso: PerfilAcesso;
  };
}

export const getPerfil = () => apiClient.get<PerfilResponse>('/perfil');

export interface RepresentanteResumoPerfil {
  id: number;
  nome: string;
  cpf: string;
  cargo: string;
  perfil_acesso: PerfilAcesso;
  status: RepresentanteStatus;
}

export const listarRepresentantes = () =>
  apiClient.get<{representantes: RepresentanteResumoPerfil[]}>('/perfil/representantes');

export interface ConvidarRepresentantePayload {
  nome: string;
  cpf: string;
  cargo: string;
  email: string;
  perfilAcesso: PerfilAcesso;
}

export interface ConvidarRepresentanteResponse {
  representante_id: number;
  status: RepresentanteStatus;
  // Só vem quando `perfilAcesso === 'representante_legal'` (RF-REP-03) — o
  // convite de visualizador não tem convite_id, é código por e-mail.
  convite_id?: string;
}

export const convidarRepresentante = (dados: ConvidarRepresentantePayload) =>
  apiClient.post<ConvidarRepresentanteResponse>('/perfil/representantes', {
    nome: dados.nome,
    cpf: dados.cpf,
    cargo: dados.cargo,
    email: dados.email,
    perfil_acesso: dados.perfilAcesso,
  });

export const alterarRepresentante = (id: number, patch: {perfilAcesso?: PerfilAcesso; status?: 'ativo' | 'inativo'}) =>
  apiClient.put<{id: number; status: RepresentanteStatus; perfil_acesso: PerfilAcesso}>(`/perfil/representantes/${id}`, {
    perfil_acesso: patch.perfilAcesso,
    status: patch.status,
  });

export const removerRepresentante = (id: number) =>
  apiClient.delete<{id: number; status: RepresentanteStatus}>(`/perfil/representantes/${id}`);
