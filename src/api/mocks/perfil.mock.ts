import type {InternalAxiosRequestConfig} from 'axios';
import {
  empresaIdFromAuthHeader,
  representanteIdFromAuthHeader,
  findEmpresaById,
  findRepresentanteById,
  findRepresentantesByEmpresa,
  representanteAtivo,
  criarRepresentante,
  atualizarRepresentante,
  ficariaSemRepresentanteLegalAtivo,
  createLivenessSession,
  consumeLivenessSession,
  gerarCodigoConviteVisualizador,
  validarCodigoConviteVisualizador,
  setEmpresaBankData,
  findBancoNome,
  type BankDataFixture,
} from './fixtures';
import type {PerfilAcesso} from '../../types';

interface MockError {
  status: number;
  data: {error_code: string; message: string};
}

function mockError(status: number, errorCode: string, message: string): MockError {
  return {status, data: {error_code: errorCode, message}};
}

function requireRepresentanteLegal(representanteId: number | null): void {
  const representante = representanteId != null ? representanteAtivo(representanteId) : undefined;
  if (!representante || representante.perfilAcesso !== 'representante_legal') {
    throw mockError(403, 'ACAO_RESTRITA_A_REPRESENTANTE_LEGAL', 'Apenas representantes legais podem executar esta ação.');
  }
}

export async function mockGetPerfil(config: InternalAxiosRequestConfig) {
  const authHeader = config.headers?.Authorization as string | undefined;
  const empresaId = empresaIdFromAuthHeader(authHeader);
  const empresa = empresaId ? findEmpresaById(empresaId) : undefined;
  const representante = representanteAtivo(representanteIdFromAuthHeader(authHeader) ?? -1);
  if (!empresa || !representante) {
    throw mockError(404, 'EMPRESA_NAO_ENCONTRADA', 'Empresa não encontrada.');
  }
  return {
    status: 200,
    data: {
      empresa_id: empresa.empresaId,
      nome_fantasia: empresa.nomeFantasia,
      cnpj: empresa.cnpj,
      kyc_status: empresa.kycStatus,
      vinculo_parceiro: {
        parceiro: empresa.vinculoParceiro.parceiro,
        status: empresa.vinculoParceiro.status,
      },
      representante_logado: {
        id: representante.id,
        nome: representante.nome,
        cargo: representante.cargo,
        perfil_acesso: representante.perfilAcesso,
      },
    },
  };
}

// RF-REP-02: dados bancários são só de representante_legal — um visualizador
// não tem acesso nenhum a esta rota (nem mascarado; a especificação mudou
// isso, dados bancários não fazem parte do que ele acompanha).
export async function mockGetDadosBancarios(config: InternalAxiosRequestConfig) {
  const authHeader = config.headers?.Authorization as string | undefined;
  const empresaId = empresaIdFromAuthHeader(authHeader);
  requireRepresentanteLegal(representanteIdFromAuthHeader(authHeader));
  const empresa = empresaId ? findEmpresaById(empresaId) : undefined;
  if (!empresa?.bankData) {
    throw mockError(404, 'DADOS_BANCARIOS_NAO_ENCONTRADOS', 'Nenhum dado bancário cadastrado.');
  }
  const {bancoId, bancoNome, agencia, conta, tipoConta, tipoTransferencia, pix} = empresa.bankData;
  return {
    status: 200,
    data: {
      banco_id: bancoId,
      banco_nome: bancoNome,
      agencia,
      conta,
      tipo_conta: tipoConta,
      tipo_transferencia: tipoTransferencia,
      pix,
    },
  };
}

// RF-PERF-02/03: edição de dados bancários pelo Perfil — vale só para
// futuras antecipações (é sempre o valor corrente de `empresa.bankData` que
// se lê; uma antecipação já criada não referencia isso de volta, RN-06).
// Mesma restrição de `mockGetDadosBancarios`: só representante_legal.
export async function mockAtualizarDadosBancarios(
  config: InternalAxiosRequestConfig,
  dados: Omit<BankDataFixture, 'bancoNome'>,
) {
  const authHeader = config.headers?.Authorization as string | undefined;
  const empresaId = empresaIdFromAuthHeader(authHeader);
  requireRepresentanteLegal(representanteIdFromAuthHeader(authHeader));
  if (!empresaId) {
    throw mockError(401, 'UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  }
  setEmpresaBankData(empresaId, {...dados, bancoNome: findBancoNome(dados.bancoId)});
  return {status: 200, data: {status: 'atualizado'}};
}

export async function mockListarRepresentantes(config: InternalAxiosRequestConfig) {
  const empresaId = empresaIdFromAuthHeader(config.headers?.Authorization as string | undefined);
  if (!empresaId) {
    throw mockError(401, 'UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  }
  const representantes = findRepresentantesByEmpresa(empresaId).map(r => ({
    id: r.id,
    nome: r.nome,
    cpf: r.cpf,
    cargo: r.cargo,
    perfil_acesso: r.perfilAcesso,
    status: r.status,
  }));
  return {status: 200, data: {representantes}};
}

let nextConviteId = 1;
const convites = new Map<string, {empresaId: number; representanteId: number}>();

function gerarConviteId(): string {
  return `F${(nextConviteId++).toString(36).toUpperCase().padStart(5, '0')}`;
}

// RF-REP-03: só representante_legal convida, de qualquer um dos dois perfis
// — e o convite se ramifica bem diferente dependendo de qual:
// - `representante_legal`: convidado entra `convidado`, só fica `ativo`
//   depois de completar o próprio ingresso (senha, documento, Procuração,
//   leitura facial — RF-BIO-09) E passar pela revisão da equipe Fynvex, o
//   mesmo gate de RF-KYC-02 — nunca só porque quem convidou disse que sim.
// - `visualizador`: sem convite_id, sem revisão — recebe um código por
//   e-mail (mesmo padrão da recuperação de conta) e já fica `ativo` ao
//   confirmá-lo (mockConfirmarConviteVisualizador).
export async function mockConvidarRepresentante(
  config: InternalAxiosRequestConfig,
  dados: {nome: string; cpf: string; cargo: string; email: string; perfilAcesso: PerfilAcesso},
) {
  const authHeader = config.headers?.Authorization as string | undefined;
  const empresaId = empresaIdFromAuthHeader(authHeader);
  const representanteId = representanteIdFromAuthHeader(authHeader);
  if (!empresaId) {
    throw mockError(401, 'UNAUTHENTICATED', 'Sessão inválida ou expirada.');
  }
  requireRepresentanteLegal(representanteId);
  const novo = criarRepresentante(empresaId, dados, '', 'convidado', representanteId);
  if (dados.perfilAcesso === 'visualizador') {
    gerarCodigoConviteVisualizador(dados.email, novo.id);
    return {status: 201, data: {representante_id: novo.id, status: novo.status}};
  }
  const conviteId = gerarConviteId();
  convites.set(conviteId, {empresaId, representanteId: novo.id});
  return {status: 201, data: {representante_id: novo.id, status: novo.status, convite_id: conviteId}};
}

// RF-REP-03/08: confirmação do convite de visualizador — sem sessão de
// leitura facial nenhuma (esse perfil não passa por biometria); ativa
// direto, sem revisão da equipe Fynvex.
export async function mockConfirmarConviteVisualizador(email: string, codigo: string, senha: string) {
  const representanteId = validarCodigoConviteVisualizador(email, codigo);
  if (!representanteId) {
    throw mockError(401, 'CODIGO_INVALIDO', 'Código incorreto ou expirado.');
  }
  const representante = findRepresentanteById(representanteId);
  if (!representante) {
    throw mockError(404, 'CONVITE_NAO_ENCONTRADO', 'Código de convite inválido ou já utilizado.');
  }
  representante.senha = senha;
  atualizarRepresentante(representante.id, {status: 'ativo'});
  return {status: 200, data: {representante_id: representante.id, status: 'ativo'}};
}

// RF-REP-03/RF-BIO-09: mesmo padrão de duas etapas (iniciar/confirmar) já
// usado no cadastro original — a diferença é que aqui não existe sessão
// nenhuma ainda (o convidado não tem token), então tudo é identificado só
// pelo `convite_id` opaco, igual a `iniciarLeituraFacialCadastro`.
export async function mockIniciarLeituraFacialConvite(conviteId: string) {
  const convite = convites.get(conviteId);
  const representante = convite ? findRepresentanteById(convite.representanteId) : undefined;
  const empresa = convite ? findEmpresaById(convite.empresaId) : undefined;
  if (!convite || !representante || !empresa) {
    throw mockError(404, 'CONVITE_NAO_ENCONTRADO', 'Código de convite inválido ou já utilizado.');
  }
  const sessionId = createLivenessSession(empresa.cnpj, convite.empresaId, representante.id);
  return {status: 200, data: {session_id: sessionId, session_expires_in: 180}};
}

export async function mockConfirmarLeituraFacialConvite(sessionId: string, conviteId: string) {
  const convite = convites.get(conviteId);
  if (!convite) {
    throw mockError(404, 'CONVITE_NAO_ENCONTRADO', 'Código de convite inválido ou já utilizado.');
  }
  const session = consumeLivenessSession(sessionId);
  if (!session || session.empresaId !== convite.empresaId || session.representanteId !== convite.representanteId) {
    throw mockError(401, 'FACIAL_MISMATCH', 'Não foi possível confirmar sua identidade.');
  }
  return {status: 200, data: {status: 'biometria_cadastrada'}};
}

// RF-REP-03: sem sessão — mesmo padrão de confirmarLeituraFacialCadastro,
// identificado só pelo convite_id opaco. Muda o status pra `pendente_analise`
// (não emite token — precisa da aprovação da equipe Fynvex primeiro).
export async function mockAceitarConvite(conviteId: string, senha: string) {
  const convite = convites.get(conviteId);
  if (!convite) {
    throw mockError(404, 'CONVITE_NAO_ENCONTRADO', 'Código de convite inválido ou já utilizado.');
  }
  const representante = findRepresentanteById(convite.representanteId);
  if (!representante) {
    throw mockError(404, 'CONVITE_NAO_ENCONTRADO', 'Código de convite inválido ou já utilizado.');
  }
  representante.senha = senha;
  atualizarRepresentante(representante.id, {status: 'pendente_analise'});
  return {status: 200, data: {representante_id: representante.id, status: 'pendente_analise'}};
}

// RN-15 (nunca zero representante_legal ativo) é checado aqui, antes de
// qualquer alteração — tanto pra rebaixar perfil quanto pra desativar.
export async function mockAlterarRepresentante(
  config: InternalAxiosRequestConfig,
  id: number,
  patch: {perfilAcesso?: PerfilAcesso; status?: 'ativo' | 'inativo'},
) {
  const authHeader = config.headers?.Authorization as string | undefined;
  const empresaId = empresaIdFromAuthHeader(authHeader);
  requireRepresentanteLegal(representanteIdFromAuthHeader(authHeader));
  const representante = findRepresentanteById(id);
  if (!representante || representante.empresaId !== empresaId) {
    throw mockError(404, 'REPRESENTANTE_NAO_ENCONTRADO', 'Representante não encontrado.');
  }
  const perderiaRepresentanteLegal =
    (patch.perfilAcesso === 'visualizador' || patch.status === 'inativo') && representante.perfilAcesso === 'representante_legal';
  if (perderiaRepresentanteLegal && ficariaSemRepresentanteLegalAtivo(representante.empresaId, representante.id)) {
    throw mockError(409, 'ULTIMO_REPRESENTANTE_LEGAL', 'A empresa precisa de ao menos um representante legal ativo.');
  }
  const atualizado = atualizarRepresentante(id, patch)!;
  return {status: 200, data: {id: atualizado.id, status: atualizado.status, perfil_acesso: atualizado.perfilAcesso}};
}

// RN-16: remover revoga a sessão ativa (RF-AUTH-07) — no mock, isso é só o
// status virar diferente de 'ativo', já que todo endpoint autenticado que
// resolve "qual representante" trata status !== 'ativo' como sessão inválida
// (representanteAtivo em fixtures.ts) — não precisa de um registro à parte.
export async function mockRemoverRepresentante(config: InternalAxiosRequestConfig, id: number) {
  const resultado = await mockAlterarRepresentante(config, id, {status: 'inativo'});
  return resultado;
}
