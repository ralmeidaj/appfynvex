import {Alert} from 'react-native';
import JailMonkey from 'jail-monkey';
import {useAuthStore} from '../store/authStore';

// RNF-17 — checagem única no boot (chamada por RootNavigator), não por
// sessão: root/jailbreak/emulador é característica do aparelho, não da
// conta logada. No mínimo exigido pela spec: alertar o usuário (uma vez,
// sem bloquear o uso) e sinalizar o evento ao backend junto da sessão —
// isso último é feito pelo header X-Device-Integrity, injetado em toda
// requisição autenticada por src/api/client.ts a partir do flag salvo aqui.
// Bloquear totalmente o uso em dispositivo comprometido é decisão de
// produto/risco ainda não tomada (ver spec RNF-17) — não implementado.
export function checkDeviceIntegrity(): void {
  const isCompromised = JailMonkey.isJailBroken();
  useAuthStore.getState().setDeviceCompromised(isCompromised);
  if (isCompromised) {
    Alert.alert(
      'Dispositivo não confiável',
      'Identificamos que este aparelho pode estar com root/jailbreak ou rodando em um ambiente não confiável. Por segurança, algumas operações podem ser restritas.',
    );
  }
}
