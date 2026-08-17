import axios, {AxiosError} from 'axios';
import {Alert} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Config from 'react-native-config';
import {getTokenFromKeychain} from '../hooks/useAuth';
import {mockAdapter} from './mocks/adapter';
import {useAuthStore} from '../store/authStore';

export const API_BASE_URL = Config.API_URL ?? 'http://10.0.2.2:8091/api/v1/app';

const useMockApi = Config.USE_MOCK_API === 'true';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {'Content-Type': 'application/json', Accept: 'application/json'},
  adapter: useMockApi ? mockAdapter : undefined,
});

// RNF-25 — mesmo padrão do 401 (RNF-18): silencia e devolve pro login, sem
// tentar reenviar nada em segundo plano (seção 2.7 — nunca fila offline pra
// operação financeira). forceLogout() só limpa o token, preservando a senha
// lembrada (RF-AUTH-04a) — quando a conexão voltar, a próxima abertura do
// app entra sozinha de novo, sem pedir CPF/senha.
function handleConnectivityLoss() {
  Alert.alert('Sem conexão', 'Sem conexão com a internet. Verifique sua rede e tente novamente.');
  useAuthStore.getState().forceLogout();
}

apiClient.interceptors.request.use(async config => {
  const token = await getTokenFromKeychain();
  if (token) {
    // RNF-25: checagem proativa de conectividade real do aparelho (não só
    // erro de resposta do backend) — só faz sentido pra requisição
    // autenticada, já em pleno uso do app (RNF-25 é sobre ficar parado no
    // meio de um fluxo, não sobre login/simulador pré-login).
    const netState = await NetInfo.fetch();
    if (netState.isConnected === false) {
      handleConnectivityLoss();
      return Promise.reject(new Error('Sem conexão com a internet.'));
    }
    config.headers.Authorization = `Bearer ${token}`;
    // RNF-17: sinaliza dispositivo root/jailbreak ao backend junto da sessão,
    // sem endpoint dedicado — só em requisições já autenticadas.
    if (useAuthStore.getState().deviceCompromised) {
      config.headers['X-Device-Integrity'] = 'compromised';
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    // Só age se a chamada que falhou já usava um token de sessão — senão o
    // 401 de FACIAL_MISMATCH (login, sem sessão ainda) dispararia o mesmo
    // caminho (RNF-18 é sobre sessão expirada, não sobre login reprovado).
    const hadAuthHeader = Boolean(error.config?.headers?.Authorization);
    // RNF-25: erro de rede real (sem resposta do backend nenhuma) — a
    // checagem proativa acima cobre a maioria dos casos, mas a conexão pode
    // cair no meio de uma requisição já em andamento.
    const isNetworkError = !error.response && error.code !== 'ERR_CANCELED';
    if (hadAuthHeader && isNetworkError) {
      handleConnectivityLoss();
    } else if (error.response?.status === 401 && hadAuthHeader) {
      useAuthStore.getState().forceLogout();
    }
    return Promise.reject(error);
  },
);

export default apiClient;
