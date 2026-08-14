import * as Keychain from 'react-native-keychain';

const SERVICE = 'fynvex_session_token';
const USERNAME = 'empresa';

export async function saveTokenToKeychain(token: string): Promise<void> {
  await Keychain.setGenericPassword(USERNAME, token, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getTokenFromKeychain(): Promise<string | null> {
  const creds = await Keychain.getGenericPassword({service: SERVICE});
  return creds ? creds.password : null;
}

export async function clearTokenFromKeychain(): Promise<void> {
  await Keychain.resetGenericPassword({service: SERVICE});
}

// RF-AUTH-04a: slot separado do token — a senha lembrada sobrevive ao token
// expirar (forceLogout, disparado pelo interceptor de 401, nunca limpa este
// slot); só um logout explícito do usuário (RF-AUTH-07) limpa os dois. É
// assim que o app reenvia a senha sozinho e entra sem pedir nada ao usuário,
// seja reabrindo o app, seja porque o token de 7 dias venceu — chaveado por
// CPF (identidade de quem loga), não pelo CNPJ da empresa.
const SENHA_SERVICE = 'fynvex_remembered_senha';

export async function saveSenhaToKeychain(cpf: string, senha: string): Promise<void> {
  await Keychain.setGenericPassword(cpf, senha, {
    service: SENHA_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getSenhaLembrada(): Promise<{cpf: string; senha: string} | null> {
  const creds = await Keychain.getGenericPassword({service: SENHA_SERVICE});
  return creds ? {cpf: creds.username, senha: creds.password} : null;
}

export async function clearSenhaFromKeychain(): Promise<void> {
  await Keychain.resetGenericPassword({service: SENHA_SERVICE});
}
