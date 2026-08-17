import type {AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig} from 'axios';
import {
  mockCheckCpf,
  mockLogin,
  mockLogout,
  mockIniciarRecuperacao,
  mockConfirmarRecuperacao,
  mockIniciarRecuperacaoFacial,
  mockConfirmarRecuperacaoFacial,
} from './auth.mock';
import {
  mockIniciarCadastro,
  mockObterCadastro,
  mockConfirmarDados,
  mockIniciarLeituraFacialCadastro,
  mockConfirmarLeituraFacialCadastro,
  mockDadosBancarios,
  mockAceiteTermos,
  mockReenviarDocumentos,
} from './cadastro.mock';
import {
  mockGetContratoMae,
  mockIniciarAssinaturaContratoMae,
  mockConfirmarAssinaturaContratoMae,
  mockListAntecipacoes,
  mockEnviarNotaFiscal,
  mockObterNotaFiscal,
  mockSimularAntecipacao,
  mockCriarAntecipacao,
  mockIniciarAssinaturaAntecipacao,
  mockConfirmarAssinaturaAntecipacao,
  mockCancelarAntecipacao,
  mockRecusarAntecipacao,
  mockObterPagamento,
  mockSimulacaoPublica,
  mockConfirmarDadosNf,
} from './antecipacoes.mock';
import {
  mockGetPerfil,
  mockListarBancos,
  mockGetDadosBancarios,
  mockAtualizarDadosBancarios,
  mockListarRepresentantes,
  mockConvidarRepresentante,
  mockAlterarRepresentante,
  mockRemoverRepresentante,
  mockIniciarLeituraFacialConvite,
  mockConfirmarLeituraFacialConvite,
  mockAceitarConvite,
  mockConfirmarConviteVisualizador,
} from './perfil.mock';
import {MOCK_NETWORK_DELAY_MS, findBancoNome} from './fixtures';

type MockHandler = (
  config: InternalAxiosRequestConfig,
  params: Record<string, string>,
) => Promise<{status: number; data: unknown}>;

function parseBody(config: InternalAxiosRequestConfig): Record<string, any> {
  if (!config.data) {
    return {};
  }
  return typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
}

// method+path (path relativo, sem baseURL — é o que a gente mesmo passa em
// src/api/*.ts) -> handler. Segmentos ":nome" viram parâmetros de rota.
const ROUTES: Record<string, MockHandler> = {
  'POST /auth/cpf': config => mockCheckCpf(parseBody(config).cpf),
  'POST /auth/login': config => {
    const body = parseBody(config);
    return mockLogin(body.cpf, body.senha);
  },
  'POST /auth/logout': () => mockLogout(),
  'POST /auth/recuperacao/iniciar': config => {
    const body = parseBody(config);
    return mockIniciarRecuperacao(body.cpf, body.email);
  },
  'POST /auth/recuperacao/confirmar': config => {
    const body = parseBody(config);
    return mockConfirmarRecuperacao(body.cpf, body.email, body.codigo, body.nova_senha);
  },
  'POST /auth/recuperacao/leitura-facial/iniciar': config =>
    mockIniciarRecuperacaoFacial(parseBody(config).representante_id),
  'POST /auth/recuperacao/leitura-facial/confirmar': config =>
    mockConfirmarRecuperacaoFacial(parseBody(config).session_id),

  'POST /cadastro': config => {
    const body = parseBody(config);
    return mockIniciarCadastro(body.cnpj, body.email, body.parceiro_codigo);
  },
  'GET /cadastro/:id': (_config, params) => mockObterCadastro(Number(params.id)),
  'POST /cadastro/:id/confirmar-dados': (config, params) => {
    const body = parseBody(config);
    return mockConfirmarDados(Number(params.id), body.nome_fantasia, body.responsavel_legal, body.senha);
  },
  'POST /cadastro/:id/leitura-facial/iniciar': (_config, params) =>
    mockIniciarLeituraFacialCadastro(Number(params.id)),
  'POST /cadastro/:id/leitura-facial/confirmar': (config, params) =>
    mockConfirmarLeituraFacialCadastro(parseBody(config).session_id, Number(params.id)),
  'POST /cadastro/:id/dados-bancarios': (config, params) => {
    const body = parseBody(config);
    return mockDadosBancarios(Number(params.id), {
      bancoId: body.banco_id,
      bancoNome: findBancoNome(body.banco_id),
      agencia: body.agencia,
      conta: body.conta,
      tipoConta: body.tipo_conta,
      tipoTransferencia: body.tipo_transferencia,
      pix: body.pix,
    });
  },
  'POST /cadastro/:id/aceite-termos': (config, params) =>
    mockAceiteTermos(Number(params.id), parseBody(config).versao_termos),
  'POST /cadastro/:id/reenviar-documentos': (_config, params) => mockReenviarDocumentos(Number(params.id)),

  'GET /contrato-mae': config => mockGetContratoMae(config),
  'POST /contrato-mae/assinar/iniciar': config => mockIniciarAssinaturaContratoMae(config),
  'POST /contrato-mae/assinar/confirmar': config =>
    mockConfirmarAssinaturaContratoMae(config, parseBody(config).session_id),

  'GET /antecipacoes': config => mockListAntecipacoes(config),
  'POST /antecipacoes/nota-fiscal': config => mockEnviarNotaFiscal(config),
  'GET /antecipacoes/nota-fiscal/:id': (config, params) => mockObterNotaFiscal(config, Number(params.id)),
  'POST /antecipacoes/nota-fiscal/:id/confirmar-dados': (config, params) => {
    const body = parseBody(config);
    return mockConfirmarDadosNf(Number(params.id), {
      numero: body.numero,
      tomador: body.tomador,
      cnpjTomador: body.cnpj_tomador,
      valor: body.valor,
      valorSolicitado: body.valor_solicitado,
      dataEmissao: body.data_emissao,
      dataVencimento: body.data_vencimento,
    });
  },
  'POST /antecipacoes/simular': config => mockSimularAntecipacao(parseBody(config).nf_leitura_id),
  'POST /antecipacoes': config => mockCriarAntecipacao(config, parseBody(config).nf_leitura_id),
  'POST /antecipacoes/:id/assinar/iniciar': (config, params) =>
    mockIniciarAssinaturaAntecipacao(config, Number(params.id)),
  'POST /antecipacoes/:id/assinar/confirmar': (config, params) =>
    mockConfirmarAssinaturaAntecipacao(config, Number(params.id), parseBody(config).session_id),
  'POST /antecipacoes/:id/cancelar': (_config, params) => mockCancelarAntecipacao(Number(params.id)),
  'POST /antecipacoes/:id/recusar': (config, params) => mockRecusarAntecipacao(config, Number(params.id)),
  'GET /antecipacoes/:id/pagamento': (_config, params) => mockObterPagamento(Number(params.id)),

  'GET /perfil': config => mockGetPerfil(config),
  'GET /bancos': () => mockListarBancos(),
  'GET /perfil/dados-bancarios': config => mockGetDadosBancarios(config),
  'PUT /perfil/dados-bancarios': config => {
    const body = parseBody(config);
    return mockAtualizarDadosBancarios(config, {
      bancoId: body.banco_id,
      agencia: body.agencia,
      conta: body.conta,
      tipoConta: body.tipo_conta,
      tipoTransferencia: body.tipo_transferencia,
      pix: body.pix,
    });
  },

  'GET /perfil/representantes': config => mockListarRepresentantes(config),
  'POST /perfil/representantes': config => {
    const body = parseBody(config);
    return mockConvidarRepresentante(config, {
      nome: body.nome,
      cpf: body.cpf,
      cargo: body.cargo,
      email: body.email,
      perfilAcesso: body.perfil_acesso,
    });
  },
  'PUT /perfil/representantes/:id': (config, params) => {
    const body = parseBody(config);
    return mockAlterarRepresentante(config, Number(params.id), {
      perfilAcesso: body.perfil_acesso,
      status: body.status,
    });
  },
  'DELETE /perfil/representantes/:id': (config, params) => mockRemoverRepresentante(config, Number(params.id)),

  'POST /convites/:id/leitura-facial/iniciar': (_config, params) => mockIniciarLeituraFacialConvite(params.id),
  'POST /convites/:id/leitura-facial/confirmar': (config, params) =>
    mockConfirmarLeituraFacialConvite(parseBody(config).session_id, params.id),
  'POST /convites/:id/aceitar': (config, params) => mockAceitarConvite(params.id, parseBody(config).senha),
  'POST /convites/visualizador/confirmar': config => {
    const body = parseBody(config);
    return mockConfirmarConviteVisualizador(body.email, body.codigo, body.senha);
  },

  'POST /simulacao-publica': config => {
    const body = parseBody(config);
    return mockSimulacaoPublica(body.valor_bruto, body.data_vencimento);
  },
};

interface RouteMatch {
  handler: MockHandler;
  params: Record<string, string>;
}

function matchRoute(method: string, path: string): RouteMatch | null {
  const pathSegments = path.split('/').filter(Boolean);
  for (const key of Object.keys(ROUTES)) {
    const [routeMethod, routePath] = key.split(' ');
    if (routeMethod !== method) {
      continue;
    }
    const routeSegments = routePath.split('/').filter(Boolean);
    if (routeSegments.length !== pathSegments.length) {
      continue;
    }
    const params: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < routeSegments.length; i++) {
      const routeSeg = routeSegments[i];
      if (routeSeg.startsWith(':')) {
        params[routeSeg.slice(1)] = pathSegments[i];
      } else if (routeSeg !== pathSegments[i]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return {handler: ROUTES[key], params};
    }
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(() => resolve(), ms));
}

export const mockAdapter: AxiosAdapter = async config => {
  const method = (config.method ?? 'get').toUpperCase();
  const path = config.url ?? '';
  const match = matchRoute(method, path);

  await delay(MOCK_NETWORK_DELAY_MS);

  if (!match) {
    return Promise.reject({
      message: `[mock] rota não implementada: ${method} ${path}`,
      config,
      response: {
        status: 404,
        data: {error_code: 'MOCK_ROUTE_NOT_FOUND', message: `Rota mockada não encontrada: ${method} ${path}`},
        config,
      },
    });
  }

  try {
    const {status, data} = await match.handler(config, match.params);
    const response: AxiosResponse = {
      data,
      status,
      statusText: status < 300 ? 'OK' : 'Error',
      headers: {},
      config: config as AxiosResponse['config'],
    };
    return response;
  } catch (err: any) {
    return Promise.reject({
      message: err?.data?.message ?? 'Mock error',
      config,
      response: {status: err.status, data: err.data, config},
      isAxiosError: true,
    });
  }
};
