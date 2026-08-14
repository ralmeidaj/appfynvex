import axios, {AxiosError} from 'axios';
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

apiClient.interceptors.request.use(async config => {
  const token = await getTokenFromKeychain();
  if (token) {
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
    // Só força logout se a chamada que falhou já usava um token de sessão —
    // senão o 401 de FACIAL_MISMATCH (login, sem sessão ainda) dispararia o
    // mesmo caminho (RNF-18 é sobre sessão expirada, não sobre login reprovado).
    const hadAuthHeader = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && hadAuthHeader) {
      useAuthStore.getState().forceLogout();
    }
    return Promise.reject(error);
  },
);

export default apiClient;
