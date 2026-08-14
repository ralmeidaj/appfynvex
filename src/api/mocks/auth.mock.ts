import {
  findRepresentanteByCpf,
  findEmpresaById,
  validarSenha,
  representanteAtivo,
  gerarCodigoRecuperacao,
  validarCodigoRecuperacao,
  findRepresentanteById,
  createRecuperacaoLivenessSession,
  consumeRecuperacaoLivenessSession,
} from './fixtures';

interface MockError {
  status: number;
  data: {error_code: string; message: string; [key: string]: unknown};
}

function mockError(status: number, errorCode: string, message: string, extra?: Record<string, unknown>): MockError {
  return {status, data: {error_code: errorCode, message, ...extra}};
}

// RF-AUTH-02: verifica existência de representante ativo pra este CPF antes
// de pedir a senha. Não distingue "CPF não encontrado" de "empresa em
// análise" pra quem só está checando — o app decide o que mostrar a partir
// de `possui_cadastro`/`kyc_status`.
export async function mockCheckCpf(cpf: string) {
  const representante = findRepresentanteByCpf(cpf);
  const empresa = representante ? findEmpresaById(representante.empresaId) : undefined;
  if (!representante || representante.status !== 'ativo' || !empresa) {
    return {
      status: 200,
      data: {empresa_id: null, possui_cadastro: false, kyc_status: 'none'},
    };
  }
  return {
    status: 200,
    data: {empresa_id: empresa.empresaId, possui_cadastro: true, kyc_status: empresa.kycStatus},
  };
}

// RF-AUTH-01/03: CPF + senha só — emite o token direto, sem sessão de
// leitura facial nenhuma (RF-BIO-03). Sem restrição de perfil: representante
// legal e visualizador usam exatamente o mesmo login (RF-REP-08).
export async function mockLogin(cpf: string, senha: string) {
  const representante = validarSenha(cpf, senha);
  if (!representante) {
    // Mensagem genérica deliberada — não diferencia CPF errado de senha
    // errada, pra não confirmar a existência de um cadastro a quem só tem o CPF.
    throw mockError(401, 'SENHA_INVALIDA', 'CPF ou senha incorretos.');
  }
  const empresa = findEmpresaById(representante.empresaId);
  if (!empresa) {
    throw mockError(404, 'EMPRESA_NAO_ENCONTRADA', 'Nenhum cadastro encontrado para este CPF.');
  }
  return {
    status: 200,
    data: {
      access_token: `mock-token-${empresa.empresaId}-${representante.id}-${Date.now()}`,
      token_type: 'bearer',
      expires_in: 604800,
      empresa: {
        id: empresa.empresaId,
        nome_fantasia: empresa.nomeFantasia,
        cnpj: empresa.cnpj,
        kyc_status: empresa.kycStatus,
      },
      representante: {
        id: representante.id,
        nome: representante.nome,
        perfil_acesso: representante.perfilAcesso,
      },
    },
  };
}

export async function mockLogout() {
  return {status: 204, data: undefined};
}

/* -------------------------------------------------------------------------
   Recuperação de conta (RF-AUTH-08) — qualquer representante ativo, dos
   dois perfis; segundo fator (código por e-mail) equivalente à leitura
   facial, não um substituto mais fraco.
   ------------------------------------------------------------------------- */

export async function mockIniciarRecuperacao(cpf: string, email: string) {
  const representante = findRepresentanteByCpf(cpf);
  // Response sempre 200 genérico, mesmo quando não bate — nunca confirma nem
  // nega que aquele CPF/e-mail tenha cadastro (RF-AUTH-08). O código só é
  // gerado de fato quando a combinação é válida.
  if (representante && representante.status === 'ativo' && representante.email.toLowerCase() === email.toLowerCase()) {
    gerarCodigoRecuperacao(cpf, email, representante.id);
  }
  return {status: 200, data: {status: 'codigo_enviado'}};
}

export async function mockConfirmarRecuperacao(cpf: string, email: string, codigo: string, novaSenha: string) {
  const representanteId = validarCodigoRecuperacao(cpf, email, codigo);
  if (!representanteId) {
    throw mockError(401, 'CODIGO_INVALIDO', 'Código incorreto ou expirado.');
  }
  const representante = findRepresentanteById(representanteId);
  if (!representante) {
    throw mockError(404, 'RECUPERACAO_NAO_ENCONTRADA', 'Não foi possível concluir a recuperação.');
  }
  representante.senha = novaSenha;
  // A partir daqui o app segue para o par dedicado de leitura facial abaixo
  // — RF-AUTH-08 não pula a facial, só restabelece a senha; o template
  // biométrico é recadastrado nesse passo seguinte. Sem `empresa_id`: a
  // tela seguinte (RecuperarFacial) só precisa do `representante_id`.
  return {status: 200, data: {status: 'senha_atualizada', representante_id: representanteId}};
}

// Par dedicado de leitura facial que encerra a recuperação de conta
// (RF-AUTH-08/RF-BIO-03) — não reaproveita o par de login, que não existe
// mais (login não tem leitura facial nenhuma).
export async function mockIniciarRecuperacaoFacial(representanteId: number) {
  const representante = representanteAtivo(representanteId);
  if (!representante) {
    throw mockError(404, 'REPRESENTANTE_NAO_ENCONTRADO', 'Representante não encontrado.');
  }
  const sessionId = createRecuperacaoLivenessSession(representanteId);
  return {status: 200, data: {session_id: sessionId, session_expires_in: 180}};
}

export async function mockConfirmarRecuperacaoFacial(sessionId: string) {
  const session = consumeRecuperacaoLivenessSession(sessionId);
  const representante = session ? representanteAtivo(session.representanteId) : undefined;
  if (!session || !representante) {
    throw mockError(401, 'FACIAL_MISMATCH', 'Não foi possível confirmar sua identidade.');
  }
  const empresa = findEmpresaById(representante.empresaId);
  if (!empresa) {
    throw mockError(404, 'EMPRESA_NAO_ENCONTRADA', 'Nenhum cadastro encontrado para este CPF.');
  }
  return {
    status: 200,
    data: {
      access_token: `mock-token-${empresa.empresaId}-${representante.id}-${Date.now()}`,
      token_type: 'bearer',
      expires_in: 604800,
      empresa: {
        id: empresa.empresaId,
        nome_fantasia: empresa.nomeFantasia,
        cnpj: empresa.cnpj,
        kyc_status: empresa.kycStatus,
      },
      representante: {
        id: representante.id,
        nome: representante.nome,
        perfil_acesso: representante.perfilAcesso,
      },
    },
  };
}
