import type {InternalAxiosRequestConfig} from 'axios';
import {
  empresaIdFromAuthHeader,
  representanteIdFromAuthHeader,
  isContratoMaeSigned,
  signContratoMae,
  createLivenessSession,
  consumeLivenessSession,
  findEmpresaById,
  findRepresentanteById,
  listAntecipacoesByEmpresa,
  findAntecipacaoById,
  saldoDisponivelNf,
  createAntecipacaoDraft,
  finalizeAntecipacaoSignature,
  cancelAntecipacaoFixture,
  recusarAntecipacaoFixture,
  createNfLeitura,
  findNfLeitura,
  updateNfLeitura,
  calcAdminFee,
  calcDesagioPct,
} from './fixtures';

interface MockError {
  status: number;
  data: {error_code: string; message: string; [key: string]: unknown};
}

function mockError(status: number, errorCode: string, message: string, extra?: Record<string, unknown>): MockError {
  return {status, data: {error_code: errorCode, message, ...extra}};
}

function requireEmpresaId(config: InternalAxiosRequestConfig): number {
  const empresaId = empresaIdFromAuthHeader(config.headers?.Authorization as string | undefined);
  if (!empresaId) {
    throw mockError(401, 'UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  }
  return empresaId;
}

// RN-17: toda assinatura (Contrato-Mãe ou antecipação, própria ou aprovando
// uma originada por terceiro, RF-TER-05) precisa saber qual representante
// especificamente assinou — não só qual empresa.
function requireRepresentanteId(config: InternalAxiosRequestConfig): number {
  const representanteId = representanteIdFromAuthHeader(config.headers?.Authorization as string | undefined);
  if (!representanteId) {
    throw mockError(401, 'UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  }
  return representanteId;
}

function qrHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Porta de mockLinhaDigitavel (prototipo/js/qrcode-mock.js) — determinístico
// a partir do id da antecipação, mesmo LCG.
function mockLinhaDigitavel(seed: string): string {
  let state = qrHash(seed) || 1;
  function digits(count: number): string {
    let s = '';
    for (let i = 0; i < count; i++) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      s += state % 10;
    }
    return s;
  }
  return `${digits(5)}.${digits(5)} ${digits(5)}.${digits(6)} ${digits(5)}.${digits(6)} ${digits(1)} ${digits(14)}`;
}

/* -------------------------------------------------------------------------
   Contrato-Mãe (RF-MAE)
   ------------------------------------------------------------------------- */

export async function mockGetContratoMae(config: InternalAxiosRequestConfig) {
  const empresaId = requireEmpresaId(config);
  const assinadoEm = isContratoMaeSigned(empresaId);
  return {
    status: 200,
    data: assinadoEm ? {status: 'assinado', assinado_em: assinadoEm} : {status: 'nunca_assinado', assinado_em: null},
  };
}

export async function mockIniciarAssinaturaContratoMae(config: InternalAxiosRequestConfig) {
  const empresaId = requireEmpresaId(config);
  const representanteId = requireRepresentanteId(config);
  const empresa = findEmpresaById(empresaId);
  if (!empresa) {
    throw mockError(404, 'EMPRESA_NAO_ENCONTRADA', 'Empresa não encontrada.');
  }
  const sessionId = createLivenessSession(empresa.cnpj, empresaId, representanteId);
  return {status: 200, data: {session_id: sessionId, session_expires_in: 180}};
}

export async function mockConfirmarAssinaturaContratoMae(config: InternalAxiosRequestConfig, sessionId: string) {
  const empresaId = requireEmpresaId(config);
  const representanteId = requireRepresentanteId(config);
  const session = consumeLivenessSession(sessionId);
  if (!session || session.empresaId !== empresaId || session.representanteId !== representanteId) {
    throw mockError(401, 'FACIAL_MISMATCH', 'Não foi possível confirmar sua identidade.');
  }
  const representante = findRepresentanteById(representanteId);
  const assinadoEm = signContratoMae(empresaId, representante?.nome ?? '');
  return {
    status: 200,
    data: {status: 'assinado', assinado_em: assinadoEm, assinado_por: {representante_id: representanteId, nome: representante?.nome}},
  };
}

/* -------------------------------------------------------------------------
   Lista de antecipações (RF-HOME)
   ------------------------------------------------------------------------- */

export async function mockListAntecipacoes(config: InternalAxiosRequestConfig) {
  const empresaId = requireEmpresaId(config);
  const data = listAntecipacoesByEmpresa(empresaId).map(a => ({
    id: a.id,
    nf_numero: a.nfNumero,
    tomador: a.tomador,
    valor_bruto: a.valorBruto,
    desagio_pct: a.desagioPct,
    desagio: a.desagio,
    taxa_administrativa: a.taxaAdministrativa,
    valor_liquido: a.valorLiquido,
    data_credito: a.dataCredito,
    status: a.status,
    pagamento_status: a.pagamentoStatus,
    motivo_recusa: a.motivoRecusa,
    origem: a.origem,
    created_at: a.createdAt,
  }));
  return {status: 200, data: {data}};
}

/* -------------------------------------------------------------------------
   Nota Fiscal + simulação (RF-ANT-01..06)
   ------------------------------------------------------------------------- */

export async function mockEnviarNotaFiscal(config: InternalAxiosRequestConfig) {
  const empresaId = requireEmpresaId(config);
  const leitura = createNfLeitura(empresaId);
  return {status: 201, data: {nf_leitura_id: leitura.nfLeituraId, status: 'processando_ia'}};
}

// RF-ANT-04: `valor_solicitado` já nasce pré-preenchido com o saldo ainda
// disponível dessa NF — não com o valor total — pra quem revisa nunca
// precisar calcular a subtração de cabeça. Só tem efeito visível quando o
// número/CNPJ do tomador extraídos já colidem com uma solicitação ativa
// existente (ex.: o usuário corrigiu manualmente o número da NF na revisão
// pra apontar pra uma nota já parcialmente antecipada); no caminho comum
// (NF nova, número nunca visto), saldo disponível = valor total.
export async function mockObterNotaFiscal(config: InternalAxiosRequestConfig, nfLeituraId: number) {
  const empresaId = requireEmpresaId(config);
  const leitura = findNfLeitura(nfLeituraId);
  if (!leitura) {
    throw mockError(404, 'LEITURA_NAO_ENCONTRADA', 'Leitura de Nota Fiscal não encontrada.');
  }
  const saldo = saldoDisponivelNf(empresaId, leitura.numero, leitura.cnpjTomador, leitura.valor);
  return {
    status: 200,
    data: {
      nf_leitura_id: leitura.nfLeituraId,
      status: 'dados_extraidos',
      numero: leitura.numero,
      tomador: leitura.tomador,
      cnpj_tomador: leitura.cnpjTomador,
      valor: leitura.valor,
      valor_solicitado: Math.min(leitura.valor, saldo.saldoDisponivel),
      data_emissao: leitura.dataEmissao,
      data_vencimento: leitura.dataVencimento,
    },
  };
}

function diasAteVencimento(dataVencimento: string): number {
  return Math.round((new Date(dataVencimento).getTime() - Date.now()) / 86400000);
}

export async function mockConfirmarDadosNf(
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
) {
  const leitura = findNfLeitura(nfLeituraId);
  if (!leitura) {
    throw mockError(404, 'LEITURA_NAO_ENCONTRADA', 'Leitura de Nota Fiscal não encontrada.');
  }
  updateNfLeitura(nfLeituraId, dados);
  return {status: 200, data: {nf_leitura_id: nfLeituraId, status: 'dados_confirmados'}};
}

// RF-ANT-05/RF-ANT-10: o deságio incide sobre `valorSolicitado` (o que o
// usuário confirmou querer antecipar agora), não sobre o valor total da NF
// quando os dois forem diferentes (cessão parcial).
export async function mockSimularAntecipacao(nfLeituraId: number) {
  const leitura = findNfLeitura(nfLeituraId);
  if (!leitura) {
    throw mockError(404, 'LEITURA_NAO_ENCONTRADA', 'Leitura de Nota Fiscal não encontrada.');
  }
  const desagioPct = calcDesagioPct(diasAteVencimento(leitura.dataVencimento));
  const desagio = leitura.valorSolicitado * (desagioPct / 100);
  const taxaAdministrativa = calcAdminFee(leitura.valorSolicitado);
  return {
    status: 200,
    data: {
      valor_bruto: leitura.valorSolicitado,
      desagio_pct: desagioPct,
      desagio,
      taxa_administrativa: taxaAdministrativa,
      valor_liquido: leitura.valorSolicitado - desagio - taxaAdministrativa,
      data_credito_prevista: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    },
  };
}

/* -------------------------------------------------------------------------
   Criação e assinatura da solicitação (RF-ANT-07..10 / RN-11 / RN-14)
   ------------------------------------------------------------------------- */

export async function mockCriarAntecipacao(config: InternalAxiosRequestConfig, nfLeituraId: number) {
  const empresaId = requireEmpresaId(config);
  const leitura = findNfLeitura(nfLeituraId);
  if (!leitura) {
    throw mockError(404, 'LEITURA_NAO_ENCONTRADA', 'Leitura de Nota Fiscal não encontrada.');
  }

  // RF-ANT-10/RN-11: a mesma NF pode lastrear mais de uma solicitação ativa
  // — só rejeita se o valor solicitado agora superar o saldo ainda
  // disponível (valor total da NF menos o que já foi antecipado).
  const saldo = saldoDisponivelNf(empresaId, leitura.numero, leitura.cnpjTomador, leitura.valor);
  if (leitura.valorSolicitado > saldo.saldoDisponivel) {
    throw mockError(
      409,
      'SALDO_NF_INSUFICIENTE',
      `Esta Nota Fiscal já tem R$ ${saldo.valorJaAntecipado.toFixed(2)} antecipados. Saldo disponível: R$ ${saldo.saldoDisponivel.toFixed(2)}.`,
      {
        valor_total_nf: saldo.valorTotalNf,
        valor_ja_antecipado: saldo.valorJaAntecipado,
        saldo_disponivel: saldo.saldoDisponivel,
        antecipacao_id: saldo.antecipacaoIds[0],
      },
    );
  }

  const draft = createAntecipacaoDraft(empresaId, leitura);
  return {
    status: 201,
    data: {
      id: draft.id,
      status: 'aguardando_assinatura',
      valor_bruto: draft.valorBruto,
      desagio: draft.desagio,
      taxa_administrativa: draft.taxaAdministrativa,
      valor_liquido: draft.valorLiquido,
      data_credito: draft.dataCredito,
    },
  };
}

export async function mockIniciarAssinaturaAntecipacao(config: InternalAxiosRequestConfig, antecipacaoId: number) {
  const empresaId = requireEmpresaId(config);
  const representanteId = requireRepresentanteId(config);
  const antecipacao = findAntecipacaoById(antecipacaoId);
  if (!antecipacao || antecipacao.empresaId !== empresaId) {
    throw mockError(404, 'ANTECIPACAO_NAO_ENCONTRADA', 'Solicitação não encontrada.');
  }
  const empresa = findEmpresaById(antecipacao.empresaId);
  if (!empresa) {
    throw mockError(404, 'EMPRESA_NAO_ENCONTRADA', 'Empresa não encontrada.');
  }
  // RF-TER-05: mesmo mecanismo pra assinar uma solicitação própria ou
  // aprovar uma originada por terceiro (RN-17) — quem chama é sempre o
  // representante logado, nunca quem originou a operação.
  const sessionId = createLivenessSession(empresa.cnpj, antecipacao.empresaId, representanteId);
  return {status: 200, data: {session_id: sessionId, session_expires_in: 180}};
}

export async function mockConfirmarAssinaturaAntecipacao(
  config: InternalAxiosRequestConfig,
  antecipacaoId: number,
  sessionId: string,
) {
  const empresaId = requireEmpresaId(config);
  const representanteId = requireRepresentanteId(config);
  const session = consumeLivenessSession(sessionId);
  if (!session || session.empresaId !== empresaId || session.representanteId !== representanteId) {
    throw mockError(401, 'FACIAL_MISMATCH', 'Não foi possível confirmar sua identidade.');
  }
  const representante = findRepresentanteById(representanteId);
  const antecipacao = finalizeAntecipacaoSignature(antecipacaoId, representanteId, representante?.nome ?? '');
  if (!antecipacao) {
    throw mockError(404, 'ANTECIPACAO_NAO_ENCONTRADA', 'Solicitação não encontrada ou já assinada.');
  }
  return {
    status: 200,
    data: {
      id: antecipacao.id,
      status: 'solicitada',
      assinado_em: new Date().toISOString(),
      assinado_por: {representante_id: representanteId, nome: representante?.nome},
    },
  };
}

/* -------------------------------------------------------------------------
   Cancelamento (RF-STATUS-05 / RN-03)
   ------------------------------------------------------------------------- */

export async function mockCancelarAntecipacao(antecipacaoId: number) {
  const antecipacao = cancelAntecipacaoFixture(antecipacaoId);
  if (!antecipacao) {
    throw mockError(409, 'CANCELAMENTO_NAO_PERMITIDO', 'Solicitação não pode mais ser cancelada.');
  }
  return {status: 200, data: {id: antecipacao.id, status: 'cancelada'}};
}

/* -------------------------------------------------------------------------
   Recusa de antecipação de terceiro (RF-TER-07) — sem leitura facial,
   definitiva, só para origem !== 'self'.
   ------------------------------------------------------------------------- */

export async function mockRecusarAntecipacao(config: InternalAxiosRequestConfig, antecipacaoId: number) {
  const empresaId = requireEmpresaId(config);
  const antecipacao = findAntecipacaoById(antecipacaoId);
  if (!antecipacao || antecipacao.empresaId !== empresaId) {
    throw mockError(404, 'ANTECIPACAO_NAO_ENCONTRADA', 'Solicitação não encontrada.');
  }
  if (antecipacao.origem === 'self') {
    throw mockError(409, 'RECUSA_NAO_PERMITIDA', 'Só é possível recusar antecipação originada por terceiro.');
  }
  const atualizada = recusarAntecipacaoFixture(antecipacaoId);
  if (!atualizada) {
    throw mockError(409, 'RECUSA_NAO_PERMITIDA', 'Esta solicitação não pode mais ser recusada.');
  }
  return {status: 200, data: {id: atualizada.id, status: 'cancelada'}};
}

/* -------------------------------------------------------------------------
   Liquidação da operação pelo tomador (RF-PAG) — RF-ANT-11: nunca uma
   cobrança à PJ, o boleto resgata o valor bruto da NF junto ao tomador.
   ------------------------------------------------------------------------- */

const LIQUIDACAO_STATUSES = new Set(['aguardando_liquidacao', 'em_atraso', 'liquidada']);

export async function mockObterPagamento(antecipacaoId: number) {
  const antecipacao = findAntecipacaoById(antecipacaoId);
  if (!antecipacao || !LIQUIDACAO_STATUSES.has(antecipacao.status)) {
    throw mockError(409, 'LIQUIDACAO_INDISPONIVEL', 'Esta solicitação não possui liquidação em andamento.');
  }
  const empresa = findEmpresaById(antecipacao.empresaId);
  const semParceiroConfirmado = empresa?.vinculoParceiro.status !== 'confirmado';

  const seed = String(antecipacao.id);
  const pixPayload =
    '00020126580014BR.GOV.BCB.PIX0136financeiro@fynvex.com.br5204000053039865802BR5909FYNVEX SA6009SAOPAULO62070503***' +
    seed.slice(-4);
  return {
    status: 200,
    data: {
      antecipacao_id: antecipacao.id,
      valor_bruto: antecipacao.valorBruto,
      tomador: antecipacao.tomador,
      data_vencimento: antecipacao.dataVencimentoNf,
      pagamento_status: antecipacao.pagamentoStatus,
      pix_payload: semParceiroConfirmado ? pixPayload : null,
      linha_digitavel: semParceiroConfirmado ? mockLinhaDigitavel(seed) : null,
    },
  };
}

/* -------------------------------------------------------------------------
   Simulador aberto, pré-login (RF-SIM-01) — mesmo motor de RN-14, sem
   depender de uma leitura de NF real.
   ------------------------------------------------------------------------- */

export async function mockSimulacaoPublica(valorBruto: number, dataVencimento: string) {
  const desagioPct = calcDesagioPct(diasAteVencimento(dataVencimento));
  const desagio = valorBruto * (desagioPct / 100);
  const taxaAdministrativa = calcAdminFee(valorBruto);
  return {
    status: 200,
    data: {
      valor_bruto: valorBruto,
      desagio_pct: desagioPct,
      desagio,
      taxa_administrativa: taxaAdministrativa,
      valor_liquido: valorBruto - desagio - taxaAdministrativa,
      data_credito_prevista: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    },
  };
}
