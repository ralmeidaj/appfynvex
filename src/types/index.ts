export type KycStatus = 'none' | 'pending' | 'approved' | 'rejected';

// RF-STATUS-01 — 10 status (spec v2, alinhada à parceria ABM/DC): a liquidação é do tomador da
// NF, não uma cobrança à PJ (RF-ANT-11), por isso o ciclo passa por aprovada/crédito antes de
// chegar na liquidação em si. `aguardando_assinatura` só ocorre para antecipação originada por
// terceiro (RF-TER-01) — uma solicitação self-service nunca é criada nesse status (RF-ANT-08).
export type AntecipacaoStatus =
  | 'aguardando_assinatura'
  | 'solicitada'
  | 'em_analise'
  | 'aprovada'
  | 'recusada'
  | 'credito_efetuado'
  | 'aguardando_liquidacao'
  | 'liquidada'
  | 'em_atraso'
  | 'cancelada';

export type PagamentoStatus = 'pending' | 'paid';

// RF-TER-01 — quem originou a solicitação: a própria empresa (self-service)
// ou um terceiro convenente (gestora/hospital), que chega pronta pra
// aprovação (RF-TER-02 a 07).
export type AntecipacaoOrigem = 'self' | 'gestora' | 'hospital_convenio';

// RF-CAD-11/12/13 — vínculo de parceiro de originação (hoje: Departamento de Convênios da ABM).
export type VinculoParceiroStatus = 'nao_vinculado' | 'pendente' | 'confirmado';

export interface VinculoParceiro {
  parceiro: string | null;
  status: VinculoParceiroStatus;
}

// RF-REP — cada empresa pode ter mais de um representante logado; cada um com seu próprio
// perfil de acesso. Critério jurídico, não administrativo (seção 1.15): `representante_legal`
// pode comprometer a empresa financeiramente (solicitar, assinar, dados bancários) e tem
// template biométrico próprio (RF-BIO-04), usado só no momento de assinar algo; `visualizador`
// só acompanha a lista de antecipações já feitas, e entra pelo MESMO login de CPF + senha
// (RF-REP-08) — nunca chega a uma ação que exija leitura facial, não porque seu login seja
// diferente.
// `RepresentanteStatus` espelha deliberadamente `KycStatus` (mesmo gate de revisão humana da
// equipe Fynvex, ver RF-KYC-02) — mas um `visualizador` nunca passa por `pendente_analise`, vai
// direto de `convidado` para `ativo` ao definir a senha (RF-REP-03).
export type PerfilAcesso = 'representante_legal' | 'visualizador';
export type RepresentanteStatus = 'convidado' | 'pendente_analise' | 'ativo' | 'rejeitado' | 'inativo';

export interface Representante {
  id: number;
  empresaId: number;
  nome: string;
  cpf: string;
  cargo: string;
  email: string;
  perfilAcesso: PerfilAcesso;
  status: RepresentanteStatus;
  convidadoPorRepresentanteId: number | null;
  convidadoEm: string | null;
}

export interface EmpresaAuthState {
  sessionToken: string;
  expiresAt: string;
  empresaId: number;
  nomeFantasia: string;
  // RF-AUTH-01: metadado de exibição da empresa — nunca mais chave de sessão/login (isso é `cpf`).
  cnpj: string;
  // Identidade de quem está logado — chave da senha lembrada (RF-AUTH-04a) e do próprio login.
  cpf: string;
  kycStatus: KycStatus;
  representanteId: number;
  representanteNome: string;
  perfilAcesso: PerfilAcesso;
}

export type AuthState = EmpresaAuthState | null;
