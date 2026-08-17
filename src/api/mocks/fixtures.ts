import type {AntecipacaoStatus, KycStatus, PagamentoStatus, Representante, VinculoParceiro} from '../../types';

export interface BankDataFixture {
  bancoId: number;
  bancoNome: string;
  agencia: string;
  conta: string;
  tipoConta: 'corrente' | 'poupanca';
  tipoTransferencia: 'pix' | 'ted';
  pix: string;
}

export interface EmpresaFixture {
  empresaId: number;
  cnpj: string;
  nomeFantasia: string;
  kycStatus: KycStatus;
  bankData?: BankDataFixture;
  contratoMaeSignedAt?: string | null;
  contratoMaeAssinadoPorNome?: string | null;
  vinculoParceiro: VinculoParceiro;
  // RF-CAD-01: coletado em POST /cadastro, junto com CNPJ/documentos — usado
  // só quando confirmar-dados cria o primeiro representante (RF-REP-01), que
  // precisa de um email (RF-REP-07) igual qualquer outro representante.
  cadastroEmail?: string;
  // RF-TERM-02: registro imutável de qual versão dos Termos de Uso foi
  // aceita e quando — nunca sobrescrito por um aceite posterior (um novo
  // aceite, se a versão mudar, seria um registro novo, não visto ainda).
  termosVersao?: string;
  termosAceitosEm?: string;
  // RF-KYC-04: motivo mostrado ao usuário quando kycStatus === 'rejected' —
  // limpo no reenvio de documentos (volta pra 'pending').
  motivoRejeicao?: string;
}

// Um CNPJ fixo por kyc_status, para exercitar os 4 caminhos do login sem
// backend real. Qualquer CNPJ fora desta lista responde como "none" (sem
// cadastro) — não precisa de entrada própria pra isso. empresaId 1 (approved)
// já tem dados bancários pré-cadastrados e vínculo de parceiro confirmado
// (RF-CAD-13), pra dar pra testar os dois ramos de RF-PAG-01 (com e sem
// parceiro) via login sem precisar passar pelo cadastro primeiro.
export const EMPRESAS_SEED: EmpresaFixture[] = [
  {
    empresaId: 1,
    cnpj: '11111111111111',
    nomeFantasia: 'Bem Estar Serviços Médicos',
    kycStatus: 'approved',
    bankData: {
      bancoId: 6,
      bancoNome: 'Nubank',
      agencia: '0001',
      conta: '12345-6',
      tipoConta: 'corrente',
      tipoTransferencia: 'pix',
      pix: '11111111111111',
    },
    contratoMaeSignedAt: null,
    vinculoParceiro: {parceiro: 'ABM/DC', status: 'confirmado'},
  },
  {
    empresaId: 2,
    cnpj: '22222222222222',
    nomeFantasia: 'Vida Nova Saúde',
    kycStatus: 'pending',
    vinculoParceiro: {parceiro: null, status: 'nao_vinculado'},
  },
  {
    empresaId: 4,
    cnpj: '44444444444444',
    nomeFantasia: 'Horizonte Saúde',
    kycStatus: 'rejected',
    motivoRejeicao: 'Contrato Social ilegível — não foi possível confirmar o CNPJ e o responsável legal.',
    vinculoParceiro: {parceiro: null, status: 'nao_vinculado'},
  },
];

export function findEmpresaByCnpj(cnpj: string): EmpresaFixture | undefined {
  return EMPRESAS_SEED.find(e => e.cnpj === cnpj);
}

export function findEmpresaById(empresaId: number): EmpresaFixture | undefined {
  return EMPRESAS_SEED.find(e => e.empresaId === empresaId);
}

let nextEmpresaId = 100; // ids de cadastro novo — distintos dos seeds de login (1, 2, 4)

// RN-01: CNPJ que já tem cadastro reconduz ao registro existente, em vez de
// criar um segundo. Fora isso, cria um rascunho novo (nome fantasia só é
// preenchido depois da leitura do Contrato Social).
export function createOrReuseEmpresaDraft(cnpj: string, email: string): EmpresaFixture {
  const existing = findEmpresaByCnpj(cnpj);
  if (existing) {
    return existing;
  }
  const empresa: EmpresaFixture = {
    empresaId: nextEmpresaId++,
    cnpj,
    nomeFantasia: '',
    kycStatus: 'pending',
    vinculoParceiro: {parceiro: null, status: 'nao_vinculado'},
    cadastroEmail: email,
  };
  EMPRESAS_SEED.push(empresa);
  return empresa;
}

// RF-CAD-11/12: autodeclaração de vínculo no cadastro. Mock simplifica a
// validação assíncrona contra a base do parceiro (RF-CAD-12) em uma decisão
// síncrona determinística — código "DC" ou "ABM" (qualquer caixa) confirma
// na hora; qualquer outro código não-vazio fica pendente; vazio/ausente
// nunca declarou vínculo.
export function setVinculoParceiroFromCodigo(empresaId: number, parceiroCodigo?: string): void {
  const empresa = findEmpresaById(empresaId);
  if (!empresa || !parceiroCodigo) {
    return;
  }
  const codigo = parceiroCodigo.trim();
  if (!codigo) {
    return;
  }
  const reconhecido = /^(DC|ABM)$/i.test(codigo);
  empresa.vinculoParceiro = reconhecido
    ? {parceiro: 'ABM/DC', status: 'confirmado'}
    : {parceiro: codigo, status: 'pendente'};
}

export function updateEmpresaNomeFantasia(empresaId: number, nomeFantasia: string): void {
  const empresa = findEmpresaById(empresaId);
  if (empresa) {
    empresa.nomeFantasia = nomeFantasia;
  }
}

// RF-KYC-04: reenvio de documentos corrigidos — volta pra análise (RF-KYC-01)
// sem reiniciar o cadastro do zero, e sem exigir logout/login de novo.
export function reenviarDocumentosCadastro(empresaId: number): void {
  const empresa = findEmpresaById(empresaId);
  if (empresa) {
    empresa.kycStatus = 'pending';
    empresa.motivoRejeicao = undefined;
  }
}

// RF-TERM-02: só registra na primeira vez — imutável, não sobrescreve um
// aceite já registrado (mesmo espírito de contratoMaeSignedAt).
export function registrarAceiteTermos(empresaId: number, versaoTermos: string): void {
  const empresa = findEmpresaById(empresaId);
  if (empresa && !empresa.termosAceitosEm) {
    empresa.termosVersao = versaoTermos;
    empresa.termosAceitosEm = new Date().toISOString();
  }
}

// GET /api/v1/app/bancos (§4.5) — mesma lista/ordem do seletor local do
// protótipo (MockData.banks), id = posição (1-based).
export const BANCOS_MOCK = [
  'Banco do Brasil',
  'Bradesco',
  'Itaú Unibanco',
  'Santander',
  'Caixa Econômica Federal',
  'Nubank',
  'Inter',
  'C6 Bank',
  'Sicoob',
].map((nome, i) => ({id: i + 1, nome}));

export function findBancoNome(bancoId: number): string {
  return BANCOS_MOCK.find(b => b.id === bancoId)?.nome ?? 'Banco';
}

export function setEmpresaBankData(empresaId: number, bankData: BankDataFixture): void {
  const empresa = findEmpresaById(empresaId);
  if (empresa) {
    empresa.bankData = bankData;
  }
}

// RN-09: o app nunca deve cachear "Contrato-Mãe assinado" permanentemente —
// isso aqui é a autoridade do "backend" mock, sempre consultada de novo a
// cada nova solicitação (nunca lida direto de AsyncStorage/authStore).
export function isContratoMaeSigned(empresaId: number): string | null {
  return findEmpresaById(empresaId)?.contratoMaeSignedAt ?? null;
}

export function signContratoMae(empresaId: number, assinadoPorNome: string): string {
  const empresa = findEmpresaById(empresaId);
  const signedAt = new Date().toISOString();
  if (empresa) {
    empresa.contratoMaeSignedAt = signedAt;
    empresa.contratoMaeAssinadoPorNome = assinadoPorNome;
  }
  return signedAt;
}

// Extrai o empresaId do token mock (`mock-token-{empresaId}-{timestamp}`) —
// mesmo formato emitido em auth.mock.ts/cadastro.mock.ts. Rotas protegidas
// usam isto pra resolver "qual empresa está autenticada" sem precisar
// decodificar um JWT de verdade.
export function empresaIdFromAuthHeader(authHeader?: string): number | null {
  if (!authHeader) {
    return null;
  }
  const match = /^Bearer mock-token-(\d+)-/.exec(authHeader);
  return match ? Number(match[1]) : null;
}

// Resultado fixo da leitura por IA do Contrato Social — mesma simplificação
// já validada no protótipo: sempre os mesmos dados, independente do arquivo.
export const AI_EXTRACTION_MOCK = {
  razaoSocial: 'Bem Estar Serviços Médicos Ltda',
  nomeFantasia: 'Bem Estar Serviços Médicos',
  endereco: 'Av. Paulista, 1000 - Bela Vista, São Paulo/SP',
  responsavelNome: 'Ana Ferreira',
  responsavelCpf: '123.456.789-00',
  responsavelCargo: 'Sócia-administradora',
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// RF-REP-01/02/03 — cada empresa pode ter mais de um representante logado.
// O primeiro representante (quem faz o cadastro) sempre nasce
// `representante_legal`/`ativo` (ver mockConfirmarDados em cadastro.mock.ts).
// Um `representante_legal` convidado depois (ex.: sócio com procuração)
// passa pelo mesmo gate de revisão da equipe Fynvex que o cadastro original
// antes de ficar `ativo` (RF-KYC-02) — nunca só por leitura facial, pra não
// deixar um representante_legal "mintar" outro sem checagem externa nenhuma.
// Um `visualizador` convidado não passa por nada disso — sem senha lembrada,
// sem leitura facial, `ativo` direto ao confirmar o código de e-mail
// (RF-REP-03/08).
// `senha` é mock-only — nunca faz parte do tipo público `Representante`
// (types/index.ts), que é o que os endpoints de fato devolvem; nenhum
// handler deve espalhar (`...representante`) este objeto direto numa
// resposta, sempre selecionar campo a campo.
export interface RepresentanteFixture extends Representante {
  senha: string;
}

// Senhas fixas de seed, documentadas aqui do mesmo jeito que os CNPJs fixos
// de EMPRESAS_SEED — pra dar pra logar sem precisar passar por cadastro.
export const REPRESENTANTES_SEED: RepresentanteFixture[] = [
  {
    id: 1,
    empresaId: 1,
    nome: 'Ana Ferreira',
    cpf: '123.456.789-00',
    cargo: 'Sócia-administradora',
    email: 'ana.ferreira@exemplo.com.br',
    perfilAcesso: 'representante_legal',
    status: 'ativo',
    convidadoPorRepresentanteId: null,
    convidadoEm: null,
    senha: 'senha123',
  },
  {
    id: 2,
    empresaId: 1,
    nome: 'Carlos Mendes',
    cpf: '987.654.321-00',
    cargo: 'Gerente financeiro',
    email: 'carlos.mendes@exemplo.com.br',
    perfilAcesso: 'visualizador',
    status: 'ativo',
    convidadoPorRepresentanteId: 1,
    convidadoEm: addDaysISO(todayISO(), -30),
    senha: 'senha456',
  },
  {
    id: 3,
    empresaId: 4,
    nome: 'Marcos Vidal',
    cpf: '444.444.444-00',
    cargo: 'Sócio-administrador',
    email: 'marcos.vidal@exemplo.com.br',
    perfilAcesso: 'representante_legal',
    // RF-KYC-04: o representante fica `ativo` (pode logar) mesmo com o
    // cadastro da empresa `rejected` — quem decide pra onde ele vai depois
    // do login é o RootNavigator, a partir de kycStatus, não este status.
    status: 'ativo',
    convidadoPorRepresentanteId: null,
    convidadoEm: null,
    senha: 'senha444',
  },
];

let nextRepresentanteId = 100; // ids de seed são 1/2 — distintos dos criados por cadastro/convite

export function findRepresentantesByEmpresa(empresaId: number): RepresentanteFixture[] {
  return REPRESENTANTES_SEED.filter(r => r.empresaId === empresaId);
}

export function findRepresentanteById(id: number): RepresentanteFixture | undefined {
  return REPRESENTANTES_SEED.find(r => r.id === id);
}

// RF-AUTH-01/02: CPF é o identificador de login — único globalmente, não
// escopado por empresa (uma pessoa não pertence a uma empresa antes de ser
// identificada). Comparação exata, sem normalizar, mesmo critério de
// `findEmpresaByCnpj` — o CPF chega formatado com pontuação
// (`123.456.789-00`), igual ao que está salvo no fixture.
export function findRepresentanteByCpf(cpf: string): RepresentanteFixture | undefined {
  return REPRESENTANTES_SEED.find(r => r.cpf === cpf);
}

export function findRepresentantesAtivosByEmpresa(empresaId: number): RepresentanteFixture[] {
  return findRepresentantesByEmpresa(empresaId).filter(r => r.status === 'ativo');
}

// RF-AUTH-01/03: valida a senha do representante identificado pelo CPF — o
// CPF já é pessoal e desambigua quem está entrando (RF-REP-08), não há
// escopo de empresa nem restrição de perfil aqui: `representante_legal` e
// `visualizador` usam exatamente o mesmo login. Só considera representantes
// `ativo` (convidado/pendente_analise/rejeitado/inativo não conseguem logar,
// independente de saberem a senha).
export function validarSenha(cpf: string, senha: string): RepresentanteFixture | undefined {
  const representante = findRepresentanteByCpf(cpf);
  if (!representante || representante.status !== 'ativo' || representante.senha !== senha) {
    return undefined;
  }
  return representante;
}

// RF-REP-01: chamado por mockConfirmarDados quando o cadastro é o primeiro
// representante da empresa (perfilAcesso sempre 'representante_legal' nesse
// caso). RF-REP-03: chamado pelo convite de um novo representante (perfil
// escolhido por quem convidou; status começa 'convidado').
export function criarRepresentante(
  empresaId: number,
  dados: {nome: string; cpf: string; cargo: string; email: string; perfilAcesso: Representante['perfilAcesso']},
  senha: string,
  status: Representante['status'],
  convidadoPorRepresentanteId: number | null,
): RepresentanteFixture {
  const representante: RepresentanteFixture = {
    id: nextRepresentanteId++,
    empresaId,
    nome: dados.nome,
    cpf: dados.cpf,
    cargo: dados.cargo,
    email: dados.email,
    perfilAcesso: dados.perfilAcesso,
    status,
    convidadoPorRepresentanteId,
    convidadoEm: convidadoPorRepresentanteId != null ? new Date().toISOString() : null,
    senha,
  };
  REPRESENTANTES_SEED.push(representante);
  return representante;
}

export function findRepresentanteByEmail(email: string): RepresentanteFixture | undefined {
  return REPRESENTANTES_SEED.find(r => r.email.toLowerCase() === email.toLowerCase());
}

export function atualizarRepresentante(
  id: number,
  patch: Partial<Pick<Representante, 'perfilAcesso' | 'status'>>,
): RepresentanteFixture | undefined {
  const representante = findRepresentanteById(id);
  if (!representante) {
    return undefined;
  }
  Object.assign(representante, patch);
  return representante;
}

// RN-15 (unicidade de representante_legal ativo): nenhuma alteração pode
// deixar a empresa sem nenhum representante_legal `ativo`. `excluirId` é o
// representante sendo removido/alterado — ele é ignorado na contagem, já
// que é o próprio candidato à mudança que está sendo avaliado.
export function ficariaSemRepresentanteLegalAtivo(empresaId: number, excluirId: number): boolean {
  return !findRepresentantesAtivosByEmpresa(empresaId).some(
    r => r.id !== excluirId && r.perfilAcesso === 'representante_legal',
  );
}

// RF-AUTH-07 aplicado a uma pessoa específica: todo endpoint autenticado que
// precisa saber "qual representante" deve tratar status !== 'ativo' como
// sessão inválida (401), não só bloquear login futuro — senão a pessoa
// removida mantém acesso pelo resto da validade do token (RF-AUTH-04, padrão
// 7 dias) mesmo depois de removida. `status` é a única fonte de verdade;
// não há um registro de revogação separado para não duplicar estado.
export function representanteAtivo(id: number): RepresentanteFixture | undefined {
  const representante = findRepresentanteById(id);
  return representante?.status === 'ativo' ? representante : undefined;
}

// Extrai o representanteId do token mock
// (`mock-token-{empresaId}-{representanteId}-{timestamp}`). Irmão de
// empresaIdFromAuthHeader (abaixo), que continua funcionando sem mudança —
// ele só captura o primeiro grupo de dígitos, então o formato de token mais
// longo não quebra nada que já dependia dele.
export function representanteIdFromAuthHeader(authHeader?: string): number | null {
  if (!authHeader) {
    return null;
  }
  const match = /^Bearer mock-token-\d+-(\d+)-/.exec(authHeader);
  return match ? Number(match[1]) : null;
}

// Regras de negócio da antecipação (RN-14, spec v2) — 3,95% flat até 30 dias
// de prazo, acréscimo pro rata die a partir do 31º. Não há mais prazo
// mínimo bloqueante: um prazo curto só resulta em deságio maior.
export const DESAGIO_PCT_BASE = 3.95;
const DESAGIO_PRAZO_BASE_DIAS = 30;
const ADMIN_FEE_VALOR = 15.0;

export function calcDesagioPct(diasPrazo: number): number {
  if (diasPrazo <= DESAGIO_PRAZO_BASE_DIAS) {
    return DESAGIO_PCT_BASE;
  }
  const incrementoDiario = DESAGIO_PCT_BASE / DESAGIO_PRAZO_BASE_DIAS;
  return DESAGIO_PCT_BASE + (diasPrazo - DESAGIO_PRAZO_BASE_DIAS) * incrementoDiario;
}

export function calcAdminFee(_valorBruto: number): number {
  return ADMIN_FEE_VALOR; // taxa fixa hoje — poderia ser percentual por gestora
}

export const STATUS_LABELS: Record<AntecipacaoStatus, string> = {
  aguardando_assinatura: 'Aguardando assinatura',
  solicitada: 'Solicitada',
  em_analise: 'Em análise',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  credito_efetuado: 'Crédito efetuado',
  aguardando_liquidacao: 'Aguardando liquidação',
  liquidada: 'Liquidada',
  em_atraso: 'Em atraso',
  cancelada: 'Cancelada',
};

// Pool de resultados simulados da leitura por IA da Nota Fiscal.
const NF_MOCK_POOL = [
  {tomador: 'Convênio SulSaúde', cnpjTomador: '22333444000155', valor: 4820.0, diasVencimento: 35},
  {tomador: 'Convênio VidaMais', cnpjTomador: '33444555000166', valor: 2310.5, diasVencimento: 45},
  {tomador: 'Particular — Consultas', cnpjTomador: '44555666000177', valor: 1150.0, diasVencimento: 18},
  {tomador: 'Convênio SulSaúde', cnpjTomador: '22333444000155', valor: 3040.0, diasVencimento: 40},
];

export interface NfLeituraFixture {
  nfLeituraId: number;
  empresaId: number;
  numero: string;
  tomador: string;
  cnpjTomador: string;
  valor: number; // valor total da NF (RF-ANT-03)
  valorSolicitado: number; // quanto o usuário quer antecipar nesta operação (RF-ANT-04/RF-ANT-10)
  dataEmissao: string;
  dataVencimento: string;
}

let nextNfLeituraId = 1;
let nfAttempts = 0;
const NF_LEITURAS = new Map<number, NfLeituraFixture>();

export function createNfLeitura(empresaId: number): NfLeituraFixture {
  const pick = NF_MOCK_POOL[nfAttempts % NF_MOCK_POOL.length];
  const nfLeituraId = nextNfLeituraId++;
  const leitura: NfLeituraFixture = {
    nfLeituraId,
    empresaId,
    numero: String(1000 + nfAttempts),
    tomador: pick.tomador,
    cnpjTomador: pick.cnpjTomador,
    valor: pick.valor,
    valorSolicitado: pick.valor,
    dataEmissao: addDaysISO(todayISO(), -5),
    dataVencimento: addDaysISO(todayISO(), pick.diasVencimento),
  };
  nfAttempts++;
  NF_LEITURAS.set(nfLeituraId, leitura);
  return leitura;
}

export function findNfLeitura(nfLeituraId: number): NfLeituraFixture | undefined {
  return NF_LEITURAS.get(nfLeituraId);
}

// RF-ANT-04: correção manual dos dados extraídos, mesmo padrão de
// updateEmpresaNomeFantasia para o cadastro. `valorSolicitado` é distinto de
// `valor` (o total da NF) desde RF-ANT-10 — nasce igual a `valor` na leitura
// (createNfLeitura), mas o usuário pode reduzi-lo aqui quando a NF já tem
// saldo parcialmente usado por outra solicitação ativa.
export function updateNfLeitura(
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
): void {
  const leitura = NF_LEITURAS.get(nfLeituraId);
  if (!leitura) {
    return;
  }
  leitura.numero = dados.numero;
  leitura.tomador = dados.tomador;
  leitura.cnpjTomador = dados.cnpjTomador;
  leitura.valor = dados.valor;
  leitura.valorSolicitado = dados.valorSolicitado;
  leitura.dataEmissao = dados.dataEmissao;
  leitura.dataVencimento = dados.dataVencimento;
}

export type AntecipacaoOrigem = 'self' | 'gestora' | 'hospital_convenio';

export interface AntecipacaoFixture {
  id: number;
  empresaId: number;
  nfNumero: string;
  cnpjTomador: string;
  tomador: string;
  valorBruto: number; // valor solicitado NESTA operação (RF-ANT-10) — pode ser < valorTotalNf
  valorTotalNf: number; // valor total da NF (mesmo em várias solicitações contra a mesma NF)
  desagioPct: number;
  desagio: number;
  taxaAdministrativa: number;
  valorLiquido: number;
  dataCredito: string;
  dataVencimentoNf: string;
  status: AntecipacaoStatus;
  pagamentoStatus: PagamentoStatus | null;
  motivoRecusa: string | null;
  origem: AntecipacaoOrigem;
  assinadoPorRepresentanteId: number | null;
  assinadoPorNome: string | null;
  createdAt: string;
}

let nextAntecipacaoId = 1000;
export const ANTECIPACOES_SEED: AntecipacaoFixture[] = [];

// Seeds pra empresaId 1 (approved, vínculo de parceiro confirmado) chegar na
// Home já com boa parte dos 9 status representados, sem precisar passar
// pelo fluxo de criação — inclui liquidação "paid" e "pending" pra dar pra
// ver a tela de pagamento nos dois estados (RF-PAG-05) sem esperar timers.
function seedAntecipacoes() {
  const base = {
    empresaId: 1,
    desagioPct: DESAGIO_PCT_BASE,
    origem: 'self' as AntecipacaoOrigem,
    assinadoPorRepresentanteId: null,
    assinadoPorNome: null,
  };
  const items: Array<Omit<AntecipacaoFixture, 'id' | 'empresaId' | 'desagioPct' | 'origem' | 'assinadoPorRepresentanteId' | 'assinadoPorNome' | 'valorTotalNf'>> = [
    {
      nfNumero: '1000',
      tomador: 'Convênio SulSaúde',
      cnpjTomador: '22333444000155',
      valorBruto: 4820.0,
      desagio: 190.39,
      taxaAdministrativa: 15.0,
      valorLiquido: 4614.61,
      dataCredito: addDaysISO(todayISO(), -6),
      dataVencimentoNf: addDaysISO(todayISO(), -1),
      status: 'liquidada',
      pagamentoStatus: 'paid',
      motivoRecusa: null,
      createdAt: addDaysISO(todayISO(), -8),
    },
    {
      nfNumero: '1001',
      tomador: 'Convênio VidaMais',
      cnpjTomador: '33444555000166',
      valorBruto: 2310.5,
      desagio: 91.27,
      taxaAdministrativa: 15.0,
      valorLiquido: 2204.23,
      dataCredito: addDaysISO(todayISO(), -3),
      dataVencimentoNf: addDaysISO(todayISO(), 2),
      status: 'aguardando_liquidacao',
      pagamentoStatus: 'pending',
      motivoRecusa: null,
      createdAt: addDaysISO(todayISO(), -5),
    },
    {
      nfNumero: '1002',
      tomador: 'Particular — Consultas',
      cnpjTomador: '44555666000177',
      valorBruto: 1150.0,
      desagio: 45.43,
      taxaAdministrativa: 15.0,
      valorLiquido: 1089.57,
      dataCredito: addDaysISO(todayISO(), -1),
      dataVencimentoNf: addDaysISO(todayISO(), -4),
      status: 'em_atraso',
      pagamentoStatus: 'pending',
      motivoRecusa: null,
      createdAt: addDaysISO(todayISO(), -4),
    },
    {
      nfNumero: '1003',
      tomador: 'Convênio SulSaúde',
      cnpjTomador: '22333444000155',
      valorBruto: 3200.0,
      desagio: 126.4,
      taxaAdministrativa: 15.0,
      valorLiquido: 3058.6,
      dataCredito: todayISO(),
      dataVencimentoNf: addDaysISO(todayISO(), 25),
      status: 'credito_efetuado',
      pagamentoStatus: null,
      motivoRecusa: null,
      createdAt: addDaysISO(todayISO(), -1),
    },
    {
      nfNumero: '1004',
      tomador: 'Particular — Consultas',
      cnpjTomador: '44555666000177',
      valorBruto: 1780.0,
      desagio: 70.31,
      taxaAdministrativa: 15.0,
      valorLiquido: 1694.69,
      dataCredito: addDaysISO(todayISO(), 1),
      dataVencimentoNf: addDaysISO(todayISO(), 33),
      status: 'em_analise',
      pagamentoStatus: null,
      motivoRecusa: null,
      createdAt: todayISO(),
    },
    {
      nfNumero: '0998',
      tomador: 'Convênio SulSaúde',
      cnpjTomador: '22333444000155',
      valorBruto: 980.0,
      desagio: 38.71,
      taxaAdministrativa: 15.0,
      valorLiquido: 926.29,
      dataCredito: addDaysISO(todayISO(), -10),
      dataVencimentoNf: addDaysISO(todayISO(), -22),
      status: 'recusada',
      pagamentoStatus: null,
      motivoRecusa: 'Nota Fiscal com divergência entre o valor informado e o valor extraído do documento.',
      createdAt: addDaysISO(todayISO(), -12),
    },
  ];
  // valorTotalNf = valorBruto pra todos os seeds acima — nenhum representa
  // uma cessão parcial (RF-ANT-10); esse cenário é exercitado manualmente
  // (ver "Verificação" do plano), não precisa de seed dedicado.
  items.forEach(item => {
    ANTECIPACOES_SEED.push({...base, id: nextAntecipacaoId++, ...item, valorTotalNf: item.valorBruto});
  });

  // RF-TER-01/02/03: duas antecipações já chegam criadas por terceiro (gestora
  // e hospital convenente), aguardando a aprovação (= assinatura, RF-TER-05)
  // do representante — sem precisar de um gatilho externo real pra
  // demonstrar o estado. Diferente dos itens acima, `origem !== 'self'` é o
  // que faz um item em `aguardando_assinatura` aparecer na Home (RF-TER-03).
  ANTECIPACOES_SEED.push(
    {
      id: nextAntecipacaoId++,
      empresaId: 1,
      nfNumero: '2001',
      tomador: 'Convênio SulSaúde',
      cnpjTomador: '22333444000155',
      valorBruto: 2650.0,
      valorTotalNf: 2650.0,
      desagioPct: DESAGIO_PCT_BASE,
      desagio: 104.68,
      taxaAdministrativa: 15.0,
      valorLiquido: 2530.32,
      dataCredito: addDaysISO(todayISO(), 1),
      dataVencimentoNf: addDaysISO(todayISO(), 28),
      status: 'aguardando_assinatura',
      pagamentoStatus: null,
      motivoRecusa: null,
      origem: 'gestora',
      assinadoPorRepresentanteId: null,
      assinadoPorNome: null,
      createdAt: todayISO(),
    },
    {
      id: nextAntecipacaoId++,
      empresaId: 1,
      nfNumero: '2002',
      tomador: 'Hospital Santa Vida',
      cnpjTomador: '55666777000188',
      valorBruto: 5400.0,
      valorTotalNf: 5400.0,
      desagioPct: DESAGIO_PCT_BASE,
      desagio: 213.3,
      taxaAdministrativa: 15.0,
      valorLiquido: 5171.7,
      dataCredito: addDaysISO(todayISO(), 1),
      dataVencimentoNf: addDaysISO(todayISO(), 30),
      status: 'aguardando_assinatura',
      pagamentoStatus: null,
      motivoRecusa: null,
      origem: 'hospital_convenio',
      assinadoPorRepresentanteId: null,
      assinadoPorNome: null,
      createdAt: todayISO(),
    },
  );
}
seedAntecipacoes();

// RF-TER-03: um rascunho `aguardando_assinatura` da própria empresa (`self`)
// nunca aparece na lista — é só um estado interno entre criar e assinar. Já
// uma antecipação de terceiro (`gestora`/`hospital_convenio`) nesse mesmo
// status **aparece**, com ação de aprovar — é assim que o representante
// sabe que existe algo pendente, sem depender só do push chegar/ser tocado.
export function listAntecipacoesByEmpresa(empresaId: number): AntecipacaoFixture[] {
  return ANTECIPACOES_SEED.filter(
    a => a.empresaId === empresaId && (a.status !== 'aguardando_assinatura' || a.origem !== 'self'),
  )
    .slice()
    .reverse();
}

export function findAntecipacaoById(id: number): AntecipacaoFixture | undefined {
  return ANTECIPACOES_SEED.find(a => a.id === id);
}

export interface SaldoNf {
  valorTotalNf: number;
  valorJaAntecipado: number;
  saldoDisponivel: number;
  antecipacaoIds: number[];
}

// RN-11/RF-ANT-10 (cessão parcial): a mesma NF (número + CNPJ do tomador)
// pode lastrear mais de uma solicitação ativa — soma-se `valorBruto` de toda
// solicitação da empresa que não seja `recusada`/`cancelada`, **incluindo**
// `liquidada` (a cessão já ocorreu na criação, o boleto pago depois não
// devolve saldo). `valorTotalNf` vem de `valorTotalNf` das solicitações já
// existentes contra essa NF, ou do parâmetro `valorTotalNfAtual` (a leitura
// em uso) quando é a primeira vez que essa NF aparece.
export function saldoDisponivelNf(
  empresaId: number,
  numero: string,
  cnpjTomador: string,
  valorTotalNfAtual: number,
): SaldoNf {
  const ativas = ANTECIPACOES_SEED.filter(
    a =>
      a.empresaId === empresaId &&
      a.nfNumero === numero &&
      a.cnpjTomador === cnpjTomador &&
      a.status !== 'recusada' &&
      a.status !== 'cancelada',
  );
  const valorTotalNf = ativas[0]?.valorTotalNf ?? valorTotalNfAtual;
  const valorJaAntecipado = ativas.reduce((soma, a) => soma + a.valorBruto, 0);
  return {
    valorTotalNf,
    valorJaAntecipado,
    saldoDisponivel: valorTotalNf - valorJaAntecipado,
    antecipacaoIds: ativas.map(a => a.id),
  };
}

export function createAntecipacaoDraft(empresaId: number, nf: NfLeituraFixture): AntecipacaoFixture {
  const diasPrazo = Math.round((new Date(nf.dataVencimento).getTime() - Date.now()) / 86400000);
  const desagioPct = calcDesagioPct(diasPrazo);
  const desagio = nf.valorSolicitado * (desagioPct / 100);
  const taxaAdministrativa = calcAdminFee(nf.valorSolicitado);
  const draft: AntecipacaoFixture = {
    id: nextAntecipacaoId++,
    empresaId,
    nfNumero: nf.numero,
    cnpjTomador: nf.cnpjTomador,
    tomador: nf.tomador,
    valorBruto: nf.valorSolicitado,
    valorTotalNf: nf.valor,
    desagioPct,
    desagio,
    taxaAdministrativa,
    valorLiquido: nf.valorSolicitado - desagio - taxaAdministrativa,
    dataCredito: addDaysISO(todayISO(), 1),
    dataVencimentoNf: nf.dataVencimento,
    status: 'aguardando_assinatura',
    pagamentoStatus: null,
    motivoRecusa: null,
    origem: 'self',
    assinadoPorRepresentanteId: null,
    assinadoPorNome: null,
    createdAt: todayISO(),
  };
  ANTECIPACOES_SEED.push(draft);
  return draft;
}

// RF-STATUS-02/RF-ANT-08 + o mesmo espírito de scheduleAdvanceLifecycle do
// protótipo — aqui dentro do mock (não numa UI de debug) simula, em
// sequência rápida, as transições que no backend real são feitas pela
// equipe Fynvex/webhook do provedor de boletos (RF-STATUS-03), só pra esta
// solicitação dar pra ser observada avançando de status durante o teste
// manual, sem precisar de um backend real.
export function finalizeAntecipacaoSignature(
  id: number,
  assinadoPorRepresentanteId: number,
  assinadoPorNome: string,
): AntecipacaoFixture | undefined {
  const antecipacao = findAntecipacaoById(id);
  if (!antecipacao || antecipacao.status !== 'aguardando_assinatura') {
    return undefined;
  }
  antecipacao.status = 'solicitada';
  antecipacao.assinadoPorRepresentanteId = assinadoPorRepresentanteId;
  antecipacao.assinadoPorNome = assinadoPorNome;

  setTimeout(() => {
    if (antecipacao.status === 'solicitada') {
      antecipacao.status = 'em_analise';
    }
  }, 5000);
  setTimeout(() => {
    if (antecipacao.status === 'em_analise') {
      antecipacao.status = 'aprovada';
    }
  }, 9000);
  setTimeout(() => {
    if (antecipacao.status === 'aprovada') {
      antecipacao.status = 'credito_efetuado';
    }
  }, 11000);
  setTimeout(() => {
    if (antecipacao.status === 'credito_efetuado') {
      antecipacao.status = 'aguardando_liquidacao';
      antecipacao.pagamentoStatus = 'pending';
    }
  }, 13000);

  return antecipacao;
}

export function cancelAntecipacaoFixture(id: number): AntecipacaoFixture | undefined {
  const antecipacao = findAntecipacaoById(id);
  if (!antecipacao) {
    return undefined;
  }
  if (antecipacao.status !== 'solicitada' && antecipacao.status !== 'em_analise') {
    return undefined;
  }
  antecipacao.status = 'cancelada';
  return antecipacao;
}

// RF-TER-07: recusa de antecipação de terceiro — sem leitura facial (não
// movimenta dinheiro), transição direta pra `cancelada`, nunca passa por
// finalizeAntecipacaoSignature (esse é só para o caminho de assinatura).
// Definitivo: não existe função pra "desfazer" uma recusa.
export function recusarAntecipacaoFixture(id: number): AntecipacaoFixture | undefined {
  const antecipacao = findAntecipacaoById(id);
  if (!antecipacao || antecipacao.origem === 'self' || antecipacao.status !== 'aguardando_assinatura') {
    return undefined;
  }
  antecipacao.status = 'cancelada';
  return antecipacao;
}

interface LivenessSession {
  cnpj: string;
  empresaId: number;
  representanteId: number;
  createdAt: number;
}

// Sessões de leitura facial em andamento — só existe em memória, tanto faz
// reiniciar o app (não há necessidade de persistir um mock de curta duração).
const livenessSessions = new Map<string, LivenessSession>();

export function createLivenessSession(cnpj: string, empresaId: number, representanteId: number): string {
  const sessionId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  livenessSessions.set(sessionId, {cnpj, empresaId, representanteId, createdAt: Date.now()});
  return sessionId;
}

export function consumeLivenessSession(sessionId: string): LivenessSession | undefined {
  const session = livenessSessions.get(sessionId);
  if (session) {
    livenessSessions.delete(sessionId);
  }
  return session;
}

// Par dedicado à leitura facial de fim de recuperação de conta (RF-AUTH-08/
// RF-BIO-03) — não reaproveita `LivenessSession` porque o login deixou de
// carregar cnpj/empresaId/senha por esse ponto: a recuperação só tem o
// `representanteId` (já autenticado pelo código de e-mail + nova senha).
interface RecuperacaoLivenessSession {
  representanteId: number;
  createdAt: number;
}

const recuperacaoLivenessSessions = new Map<string, RecuperacaoLivenessSession>();

export function createRecuperacaoLivenessSession(representanteId: number): string {
  const sessionId = `mock-rec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  recuperacaoLivenessSessions.set(sessionId, {representanteId, createdAt: Date.now()});
  return sessionId;
}

export function consumeRecuperacaoLivenessSession(sessionId: string): RecuperacaoLivenessSession | undefined {
  const session = recuperacaoLivenessSessions.get(sessionId);
  if (session) {
    recuperacaoLivenessSessions.delete(sessionId);
  }
  return session;
}

const CODIGO_TTL_MS = 15 * 60 * 1000; // 15 min — mesmo horizonte de RNF-08

function gerarCodigo6Digitos(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

interface RecuperacaoCodigo {
  representanteId: number;
  codigo: string;
  expiresAt: number;
}

// RF-AUTH-08: recuperação de conta — qualquer representante `ativo`, dos dois
// perfis (RF-REP-02 diz que `visualizador` também tem senha própria, definida
// no aceite do convite). Chave é cpf+email pra não expor, antes de validar o
// e-mail, se aquele e-mail pertence a este CPF. Não existe SMTP real no mock
// — o código só é logado no console do Metro (mesmo espírito de
// scheduleAdvanceLifecycle do protótipo: dá pra observar o comportamento sem
// infraestrutura real).
const recuperacaoCodigos = new Map<string, RecuperacaoCodigo>();

export function gerarCodigoRecuperacao(cpf: string, email: string, representanteId: number): string {
  const codigo = gerarCodigo6Digitos();
  recuperacaoCodigos.set(`${cpf}:${email.toLowerCase()}`, {representanteId, codigo, expiresAt: Date.now() + CODIGO_TTL_MS});
  console.log(`[mock] Código de recuperação de conta para ${email}: ${codigo}`);
  return codigo;
}

export function validarCodigoRecuperacao(cpf: string, email: string, codigo: string): number | null {
  const chave = `${cpf}:${email.toLowerCase()}`;
  const registro = recuperacaoCodigos.get(chave);
  if (!registro || registro.codigo !== codigo || registro.expiresAt < Date.now()) {
    return null;
  }
  recuperacaoCodigos.delete(chave);
  return registro.representanteId;
}

interface ConviteVisualizadorCodigo {
  representanteId: number;
  codigo: string;
  expiresAt: number;
}

// RF-REP-03/08: convite de visualizador — sem convite_id compartilhado
// manualmente (diferente do convite de representante_legal); o código vai
// "por e-mail" (console do Metro, mesmo padrão de gerarCodigoRecuperacao).
const convitesVisualizador = new Map<string, ConviteVisualizadorCodigo>();

export function gerarCodigoConviteVisualizador(email: string, representanteId: number): string {
  const codigo = gerarCodigo6Digitos();
  convitesVisualizador.set(email.toLowerCase(), {representanteId, codigo, expiresAt: Date.now() + CODIGO_TTL_MS});
  console.log(`[mock] Código de convite (visualizador) para ${email}: ${codigo}`);
  return codigo;
}

export function validarCodigoConviteVisualizador(email: string, codigo: string): number | null {
  const chave = email.toLowerCase();
  const registro = convitesVisualizador.get(chave);
  if (!registro || registro.codigo !== codigo || registro.expiresAt < Date.now()) {
    return null;
  }
  convitesVisualizador.delete(chave);
  return registro.representanteId;
}

export const MOCK_NETWORK_DELAY_MS = 350;
