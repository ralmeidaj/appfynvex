import apiClient from './client';
import type {AntecipacaoStatus, PagamentoStatus} from '../types';

export interface ContratoMaeResponse {
  status: 'assinado' | 'nunca_assinado';
  assinado_em: string | null;
}

export interface IniciarAssinaturaResponse {
  session_id: string;
  session_expires_in: number;
}

export interface AntecipacaoListItem {
  id: number;
  nf_numero: string;
  tomador: string;
  valor_bruto: number;
  desagio_pct: number;
  desagio: number;
  taxa_administrativa: number;
  valor_liquido: number;
  data_credito: string;
  status: AntecipacaoStatus;
  pagamento_status: PagamentoStatus | null;
  motivo_recusa: string | null;
  created_at: string;
}

export interface ListAntecipacoesResponse {
  data: AntecipacaoListItem[];
}

export interface EnviarNotaFiscalResponse {
  nf_leitura_id: number;
  status: string;
}

export interface ObterNotaFiscalResponse {
  nf_leitura_id: number;
  status: string;
  numero: string;
  tomador: string;
  // RF-ANT-03/RN-11: identifica a NF junto com `numero`, pra somar saldo já
  // usado por outra solicitação contra a mesma nota.
  cnpj_tomador: string;
  valor: number;
  // RF-ANT-04: distinto de `valor` — já nasce pré-preenchido com o saldo
  // ainda disponível dessa NF (não com o valor total), editável só para um
  // valor menor.
  valor_solicitado: number;
  data_emissao: string;
  data_vencimento: string;
}

export interface SimularAntecipacaoResponse {
  valor_bruto: number;
  desagio_pct: number;
  desagio: number;
  taxa_administrativa: number;
  valor_liquido: number;
  data_credito_prevista: string;
}

export interface CriarAntecipacaoResponse {
  id: number;
  status: string;
  valor_bruto: number;
  desagio: number;
  taxa_administrativa: number;
  valor_liquido: number;
  data_credito: string;
}

export interface ConfirmarAssinaturaAntecipacaoResponse {
  id: number;
  status: AntecipacaoStatus;
  assinado_em: string;
}

export interface CancelarAntecipacaoResponse {
  id: number;
  status: AntecipacaoStatus;
}

export interface ObterPagamentoResponse {
  antecipacao_id: number;
  valor_bruto: number;
  tomador: string;
  data_vencimento: string;
  pagamento_status: PagamentoStatus;
  pix_payload: string | null;
  linha_digitavel: string | null;
}

export const getContratoMae = () => apiClient.get<ContratoMaeResponse>('/contrato-mae');

export const iniciarAssinaturaContratoMae = () =>
  apiClient.post<IniciarAssinaturaResponse>('/contrato-mae/assinar/iniciar');

export const confirmarAssinaturaContratoMae = (sessionId: string) =>
  apiClient.post<ContratoMaeResponse>('/contrato-mae/assinar/confirmar', {session_id: sessionId});

export const listAntecipacoes = () => apiClient.get<ListAntecipacoesResponse>('/antecipacoes');

export const enviarNotaFiscal = () => apiClient.post<EnviarNotaFiscalResponse>('/antecipacoes/nota-fiscal');

export const obterNotaFiscal = (nfLeituraId: number) =>
  apiClient.get<ObterNotaFiscalResponse>(`/antecipacoes/nota-fiscal/${nfLeituraId}`);

export interface ConfirmarDadosNfResponse {
  nf_leitura_id: number;
  status: string;
}

// RF-ANT-04: correção manual antes de seguir para a simulação.
export const confirmarDadosNf = (
  nfLeituraId: number,
  dados: {
    numero: string;
    tomador: string;
    cnpjTomador: string;
    valor: number;
    valorSolicitado: number;
    dataEmissao: string;
    dataVencimento: string;
  },
) =>
  apiClient.post<ConfirmarDadosNfResponse>(`/antecipacoes/nota-fiscal/${nfLeituraId}/confirmar-dados`, {
    numero: dados.numero,
    tomador: dados.tomador,
    cnpj_tomador: dados.cnpjTomador,
    valor: dados.valor,
    valor_solicitado: dados.valorSolicitado,
    data_emissao: dados.dataEmissao,
    data_vencimento: dados.dataVencimento,
  });

export const simularAntecipacao = (nfLeituraId: number) =>
  apiClient.post<SimularAntecipacaoResponse>('/antecipacoes/simular', {nf_leitura_id: nfLeituraId});

export const criarAntecipacao = (nfLeituraId: number) =>
  apiClient.post<CriarAntecipacaoResponse>('/antecipacoes', {nf_leitura_id: nfLeituraId});

export const iniciarAssinaturaAntecipacao = (antecipacaoId: number) =>
  apiClient.post<IniciarAssinaturaResponse>(`/antecipacoes/${antecipacaoId}/assinar/iniciar`);

export const confirmarAssinaturaAntecipacao = (antecipacaoId: number, sessionId: string) =>
  apiClient.post<ConfirmarAssinaturaAntecipacaoResponse>(`/antecipacoes/${antecipacaoId}/assinar/confirmar`, {
    session_id: sessionId,
  });

export const cancelarAntecipacao = (antecipacaoId: number) =>
  apiClient.post<CancelarAntecipacaoResponse>(`/antecipacoes/${antecipacaoId}/cancelar`);

// RF-TER-07 — recusa de antecipação originada por terceiro, definitiva e sem 2º fator.
export const recusarAntecipacao = (antecipacaoId: number) =>
  apiClient.post<CancelarAntecipacaoResponse>(`/antecipacoes/${antecipacaoId}/recusar`);

export const obterPagamento = (antecipacaoId: number) =>
  apiClient.get<ObterPagamentoResponse>(`/antecipacoes/${antecipacaoId}/pagamento`);

// RF-SIM-01 — público, sem token; mesmo motor de cálculo de simularAntecipacao.
export const simulacaoPublica = (valorBruto: number, dataVencimento: string) =>
  apiClient.post<SimularAntecipacaoResponse>('/simulacao-publica', {
    valor_bruto: valorBruto,
    data_vencimento: dataVencimento,
  });
