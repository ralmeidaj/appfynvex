import apiClient from './client';
import type {KycStatus} from '../types';

export interface IniciarCadastroResponse {
  cadastro_id: number;
  status: string;
}

export interface DadosExtraidosResponse {
  razao_social: string;
  nome_fantasia: string;
  endereco: string;
  responsavel_legal: {nome: string; cpf: string; cargo: string};
}

export interface ObterCadastroResponse {
  cadastro_id: number;
  status: string;
  dados_extraidos?: DadosExtraidosResponse;
}

export interface IniciarLeituraFacialCadastroResponse {
  session_id: string;
  session_expires_in: number;
}

export interface ConfirmarEtapaCadastroResponse {
  cadastro_id: number;
  status: string;
}

export interface ConfirmarDadosResponse extends ConfirmarEtapaCadastroResponse {
  representante_id: number;
}

export interface DadosBancariosPayload {
  bancoId: number;
  agencia: string;
  conta: string;
  tipoConta: 'corrente' | 'poupanca';
  tipoTransferencia: 'pix' | 'ted';
  pix: string;
}

export interface AceiteTermosResponse {
  cadastro_id: number;
  status: string;
  kyc_status: KycStatus;
  access_token: string;
  token_type: string;
  expires_in: number;
}

export const iniciarCadastro = (cnpj: string, parceiroCodigo?: string) =>
  apiClient.post<IniciarCadastroResponse>('/cadastro', {cnpj, parceiro_codigo: parceiroCodigo});

export const obterCadastro = (cadastroId: number) =>
  apiClient.get<ObterCadastroResponse>(`/cadastro/${cadastroId}`);

// RF-CAD-07: o usuário pode corrigir qualquer campo antes de confirmar — por
// isso aceita o objeto completo, não só o nome fantasia. `senha` define a
// credencial de login do responsável legal, que se torna o primeiro
// representante da empresa (RF-REP-01/RF-AUTH-01) — é criada aqui, uma
// única vez, não numa tela de login separada (RF-KYC-05).
export const confirmarDados = (cadastroId: number, dados: DadosExtraidosResponse, senha: string) =>
  apiClient.post<ConfirmarDadosResponse>(`/cadastro/${cadastroId}/confirmar-dados`, {
    razao_social: dados.razao_social,
    nome_fantasia: dados.nome_fantasia,
    endereco: dados.endereco,
    responsavel_legal: dados.responsavel_legal,
    senha,
  });

export const iniciarLeituraFacialCadastro = (cadastroId: number) =>
  apiClient.post<IniciarLeituraFacialCadastroResponse>(`/cadastro/${cadastroId}/leitura-facial/iniciar`);

export const confirmarLeituraFacialCadastro = (cadastroId: number, sessionId: string) =>
  apiClient.post<ConfirmarEtapaCadastroResponse>(`/cadastro/${cadastroId}/leitura-facial/confirmar`, {
    session_id: sessionId,
  });

export const salvarDadosBancarios = (cadastroId: number, dados: DadosBancariosPayload) =>
  apiClient.post<ConfirmarEtapaCadastroResponse>(`/cadastro/${cadastroId}/dados-bancarios`, {
    banco_id: dados.bancoId,
    agencia: dados.agencia,
    conta: dados.conta,
    tipo_conta: dados.tipoConta,
    tipo_transferencia: dados.tipoTransferencia,
    pix: dados.pix,
  });

// RF-TERM-02: registra qual versão do termo foi de fato aceita.
export const aceitarTermos = (cadastroId: number, versaoTermos: string) =>
  apiClient.post<AceiteTermosResponse>(`/cadastro/${cadastroId}/aceite-termos`, {
    termos_aceitos: true,
    versao_termos: versaoTermos,
  });
