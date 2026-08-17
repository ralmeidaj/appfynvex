import {
  createOrReuseEmpresaDraft,
  updateEmpresaNomeFantasia,
  findEmpresaById,
  createLivenessSession,
  consumeLivenessSession,
  setEmpresaBankData,
  setVinculoParceiroFromCodigo,
  criarRepresentante,
  findRepresentantesByEmpresa,
  registrarAceiteTermos,
  reenviarDocumentosCadastro,
  AI_EXTRACTION_MOCK,
  type BankDataFixture,
} from './fixtures';

interface MockError {
  status: number;
  data: {error_code: string; message: string};
}

function mockError(status: number, errorCode: string, message: string): MockError {
  return {status, data: {error_code: errorCode, message}};
}

export async function mockIniciarCadastro(cnpj: string, email: string, parceiroCodigo?: string) {
  const empresa = createOrReuseEmpresaDraft(cnpj, email);
  setVinculoParceiroFromCodigo(empresa.empresaId, parceiroCodigo);
  return {
    status: 201,
    data: {cadastro_id: empresa.empresaId, status: 'processando_ia'},
  };
}

export async function mockObterCadastro(cadastroId: number) {
  const empresa = findEmpresaById(cadastroId);
  if (!empresa) {
    throw mockError(404, 'CADASTRO_NAO_ENCONTRADO', 'Cadastro não encontrado.');
  }
  return {
    status: 200,
    data: {
      cadastro_id: cadastroId,
      status: 'dados_extraidos',
      dados_extraidos: {
        razao_social: AI_EXTRACTION_MOCK.razaoSocial,
        nome_fantasia: AI_EXTRACTION_MOCK.nomeFantasia,
        endereco: AI_EXTRACTION_MOCK.endereco,
        responsavel_legal: {
          nome: AI_EXTRACTION_MOCK.responsavelNome,
          cpf: AI_EXTRACTION_MOCK.responsavelCpf,
          cargo: AI_EXTRACTION_MOCK.responsavelCargo,
        },
      },
    },
  };
}

// RF-REP-01: o responsável legal confirmado aqui se torna o primeiro
// representante da empresa — sempre `representante_legal`, criado direto
// `ativo` (o cadastro como um todo já passa pela revisão da equipe Fynvex,
// RF-KYC-02; não é um segundo gate). A senha definida nesta etapa
// (RF-AUTH-01) é dele, não da empresa. O e-mail vem de `POST /cadastro`
// (RF-CAD-01), guardado em `empresa.cadastroEmail` até este momento.
export async function mockConfirmarDados(
  cadastroId: number,
  nomeFantasia: string,
  responsavelLegal: {nome: string; cpf: string; cargo: string},
  senha: string,
) {
  // Mock só persiste o nome fantasia (é o único campo de empresa reaproveitado
  // depois, na Home/Perfil) — razão social e endereço são aceitos e devolvidos
  // como confirmados, mas não têm um "lugar" próprio no mock além do que a
  // tela já mostrou. O responsável legal, diferente da rodada anterior desta
  // spec, agora É persistido — como o primeiro representante.
  const empresa = findEmpresaById(cadastroId);
  if (!empresa) {
    throw mockError(404, 'CADASTRO_NAO_ENCONTRADO', 'Cadastro não encontrado.');
  }
  updateEmpresaNomeFantasia(cadastroId, nomeFantasia);
  const representante = criarRepresentante(
    cadastroId,
    {
      nome: responsavelLegal.nome,
      cpf: responsavelLegal.cpf,
      cargo: responsavelLegal.cargo,
      email: empresa.cadastroEmail ?? '',
      perfilAcesso: 'representante_legal',
    },
    senha,
    'ativo',
    null,
  );
  return {status: 200, data: {cadastro_id: cadastroId, status: 'dados_confirmados', representante_id: representante.id}};
}

export async function mockIniciarLeituraFacialCadastro(cadastroId: number) {
  const empresa = findEmpresaById(cadastroId);
  if (!empresa) {
    throw mockError(404, 'CADASTRO_NAO_ENCONTRADO', 'Cadastro não encontrado.');
  }
  // Neste ponto do fluxo (depois de confirmar-dados, RF-CAD-07/RF-REP-01) já
  // existe exatamente um representante — o recém-criado. É o template dele
  // que esta leitura facial está cadastrando.
  const [representante] = findRepresentantesByEmpresa(cadastroId);
  if (!representante) {
    throw mockError(404, 'CADASTRO_NAO_ENCONTRADO', 'Confirme os dados do cadastro antes da leitura facial.');
  }
  const sessionId = createLivenessSession(empresa.cnpj, cadastroId, representante.id);
  return {status: 200, data: {session_id: sessionId, session_expires_in: 180}};
}

export async function mockConfirmarLeituraFacialCadastro(sessionId: string, cadastroId: number) {
  const session = consumeLivenessSession(sessionId);
  if (!session || session.empresaId !== cadastroId) {
    throw mockError(401, 'SESSAO_INVALIDA', 'Sessão de leitura facial inválida ou expirada.');
  }
  // RF-BIO-09: aqui é onde, num backend real, a leitura facial recém-capturada
  // seria comparada (face match) com a foto do documento de identidade já
  // enviado (RF-CAD-01) — o app não muda nada nesta chamada por causa disso;
  // o resultado da comparação é insumo só para a análise da equipe Fynvex
  // (RF-KYC-02), nunca bloqueia o cadastro sozinho.
  return {status: 200, data: {cadastro_id: cadastroId, status: 'biometria_cadastrada'}};
}

export async function mockDadosBancarios(cadastroId: number, bankData: BankDataFixture) {
  const empresa = findEmpresaById(cadastroId);
  if (!empresa) {
    throw mockError(404, 'CADASTRO_NAO_ENCONTRADO', 'Cadastro não encontrado.');
  }
  setEmpresaBankData(cadastroId, bankData);
  return {status: 200, data: {cadastro_id: cadastroId, status: 'dados_bancarios_salvos'}};
}

export async function mockAceiteTermos(cadastroId: number, versaoTermos: string) {
  const empresa = findEmpresaById(cadastroId);
  const [representante] = findRepresentantesByEmpresa(cadastroId);
  if (!empresa || !representante) {
    throw mockError(404, 'CADASTRO_NAO_ENCONTRADO', 'Cadastro não encontrado.');
  }
  registrarAceiteTermos(cadastroId, versaoTermos);
  // RF-CAD-10/RF-KYC-05: concluir o cadastro leva direto à tela de análise,
  // sem exigir um login separado — por isso emite sessão aqui também, igual
  // ao passo de confirmação da leitura facial no login.
  return {
    status: 200,
    data: {
      cadastro_id: cadastroId,
      status: 'pending',
      kyc_status: 'pending',
      access_token: `mock-token-${cadastroId}-${representante.id}-${Date.now()}`,
      token_type: 'bearer',
      expires_in: 604800,
    },
  };
}

// RF-KYC-04: reenvio de documentos corrigidos depois de uma rejeição — não
// exige logout/login de novo, o app já reage à mudança de kyc_status via
// setAuth (ver KycRejectedScreen.tsx).
export async function mockReenviarDocumentos(cadastroId: number) {
  const empresa = findEmpresaById(cadastroId);
  if (!empresa) {
    throw mockError(404, 'CADASTRO_NAO_ENCONTRADO', 'Cadastro não encontrado.');
  }
  reenviarDocumentosCadastro(cadastroId);
  return {status: 200, data: {cadastro_id: cadastroId, status: 'pending'}};
}
