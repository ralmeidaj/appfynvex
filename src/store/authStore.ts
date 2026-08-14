import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AuthState, EmpresaAuthState} from '../types';
import {
  saveTokenToKeychain,
  getTokenFromKeychain,
  clearTokenFromKeychain,
  getSenhaLembrada,
  clearSenhaFromKeychain,
} from '../hooks/useAuth';
import {login as apiLogin, logout as apiLogout} from '../api/auth';

const PROFILE_CACHE_KEY = 'fynvex_empresa_cache';

// Dados não-sensíveis (nome/CNPJ/status) — o token fica só no Keychain
// (RNF-20); isso é cache pra retomar a sessão sem esperar rede.
type ProfileCache = Omit<EmpresaAuthState, 'sessionToken'>;

async function saveProfileCache(profile: ProfileCache): Promise<void> {
  await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
}

async function readProfileCache(): Promise<ProfileCache | null> {
  const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.empresaId !== 'number' || typeof parsed.cnpj !== 'string') {
      return null;
    }
    // Fail closed: cache corrompido/sem kycStatus, sem identidade de
    // representante (RF-REP-01) ou sem CPF (RF-AUTH-01), nunca libera acesso
    // direto — cache de uma versão anterior a esta mudança (sem `cpf`) é
    // tratado como sessão inexistente, senão a retomada silenciosa nunca
    // teria como chavear a senha lembrada.
    if (
      typeof parsed.representanteId !== 'number' ||
      typeof parsed.perfilAcesso !== 'string' ||
      typeof parsed.cpf !== 'string'
    ) {
      return null;
    }
    return {
      empresaId: parsed.empresaId,
      cnpj: parsed.cnpj,
      cpf: parsed.cpf,
      nomeFantasia: parsed.nomeFantasia ?? '',
      kycStatus: parsed.kycStatus ?? 'pending',
      expiresAt: parsed.expiresAt ?? '',
      representanteId: parsed.representanteId,
      representanteNome: parsed.representanteNome ?? '',
      perfilAcesso: parsed.perfilAcesso,
    };
  } catch {
    return null;
  }
}

async function clearProfileCache(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
}

async function persistAuth(auth: EmpresaAuthState): Promise<void> {
  await saveTokenToKeychain(auth.sessionToken);
  await saveProfileCache({
    empresaId: auth.empresaId,
    cnpj: auth.cnpj,
    cpf: auth.cpf,
    nomeFantasia: auth.nomeFantasia,
    kycStatus: auth.kycStatus,
    expiresAt: auth.expiresAt,
    representanteId: auth.representanteId,
    representanteNome: auth.representanteNome,
    perfilAcesso: auth.perfilAcesso,
  });
}

// RF-AUTH-04a: "o app reenvia essa senha automaticamente e entra sem pedir
// nada ao usuário" — usado tanto no cold boot (restoreSession, sem token em
// cache) quanto quando o token expira em pleno uso (forceLogout, disparado
// pelo interceptor de 401). Nunca lança: qualquer falha (senha mudou em
// outro dispositivo, sem rede) só limpa a senha lembrada e devolve `null`,
// deixando quem chamou cair para a tela de login. Um guard em módulo evita
// duas chamadas de rede em paralelo se dois 401s chegarem quase juntos.
let reloginEmAndamento: Promise<AuthState> | null = null;

async function trySilentRelogin(): Promise<AuthState> {
  if (!reloginEmAndamento) {
    reloginEmAndamento = (async () => {
      const remembered = await getSenhaLembrada();
      if (!remembered) {
        return null;
      }
      try {
        const res = await apiLogin(remembered.cpf, remembered.senha);
        const {access_token, expires_in, empresa, representante} = res.data;
        const auth: EmpresaAuthState = {
          sessionToken: access_token,
          expiresAt: new Date(Date.now() + expires_in * 1000).toISOString(),
          empresaId: empresa.id,
          nomeFantasia: empresa.nome_fantasia,
          cnpj: empresa.cnpj,
          cpf: remembered.cpf,
          kycStatus: empresa.kyc_status,
          representanteId: representante.id,
          representanteNome: representante.nome,
          perfilAcesso: representante.perfil_acesso as EmpresaAuthState['perfilAcesso'],
        };
        await persistAuth(auth);
        return auth;
      } catch {
        await clearSenhaFromKeychain();
        return null;
      }
    })().finally(() => {
      reloginEmAndamento = null;
    });
  }
  return reloginEmAndamento;
}

interface AuthStore {
  auth: AuthState;
  isLoading: boolean;
  // RNF-17: setado uma vez no boot (ver useDeviceIntegrity), nunca por sessão
  // — sobrevive a login/logout, só reseta em cold start.
  deviceCompromised: boolean;
  setAuth: (auth: AuthState) => Promise<void>;
  logout: () => Promise<void>;
  forceLogout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  setDeviceCompromised: (value: boolean) => void;
}

export const useAuthStore = create<AuthStore>(set => ({
  auth: null,
  isLoading: true,
  deviceCompromised: false,

  setAuth: async auth => {
    if (auth) {
      await persistAuth(auth);
    }
    set({auth, isLoading: false});
  },

  logout: async () => {
    try {
      await apiLogout();
    } catch {
      // Best-effort — mesmo se a revogação no backend falhar, desloga localmente.
    }
    await clearTokenFromKeychain();
    await clearSenhaFromKeychain();
    await clearProfileCache();
    set({auth: null, isLoading: false});
  },

  forceLogout: async () => {
    // Chamado pelo interceptor de 401 (RNF-18). Limpa o token ANTES de tentar
    // relogar — se não limpasse, o interceptor de request reenviaria o
    // Authorization antigo na chamada de login e um 401 de senha errada
    // reentraria aqui num loop (o request de login precisa ir sem header).
    await clearTokenFromKeychain();
    await clearProfileCache();
    const auth = await trySilentRelogin();
    set({auth, isLoading: false});
  },

  restoreSession: async () => {
    try {
      const token = await getTokenFromKeychain();
      const profile = token ? await readProfileCache() : null;

      if (token && profile) {
        // Token em cache — retoma direto, sem nenhuma tela intermediária nem
        // leitura facial (RF-AUTH-04a/RNF-19): RootNavigator decide
        // KycPending/EmpresaApp a partir do `kycStatus` já em cache.
        set({auth: {sessionToken: token, ...profile}, isLoading: false});
        return true;
      }

      // Token sem cache (ou vice-versa) é um estado inconsistente — limpa os
      // dois antes de tentar a senha lembrada.
      if (token || profile) {
        await clearTokenFromKeychain();
        await clearProfileCache();
      }

      const auth = await trySilentRelogin();
      if (auth) {
        set({auth, isLoading: false});
        return true;
      }
    } catch {
      // Keychain/AsyncStorage indisponível — trata como deslogado.
    }
    set({auth: null, isLoading: false});
    return false;
  },

  setDeviceCompromised: value => set({deviceCompromised: value}),
}));
