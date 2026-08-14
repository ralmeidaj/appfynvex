import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {iniciarRecuperacaoFacial, confirmarRecuperacaoFacial} from '../../api/auth';
import {useAuthStore} from '../../store/authStore';
import {saveSenhaToKeychain} from '../../hooks/useAuth';
import type {EmpresaAuthState} from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'RecuperarFacial'>;

// RF-AUTH-08/RF-BIO-03: par DEDICADO de leitura facial exclusivo do fim da
// recuperação de conta — diferente do login do dia a dia (que não tem
// leitura facial nenhuma), recuperar conta é sensível o bastante pra
// justificar a facial de novo (novo template, substituindo o antigo).
//
// iniciando: cria a sessão de liveness no backend.
// capturando: hoje é um botão simulado; é aqui que entra o SDK do fornecedor
//   quando escolhido (RF-BIO-08) — ver TODO abaixo.
// confirmando: envia o resultado da sessão pro backend, que decide o match.
type Phase = 'iniciando' | 'capturando' | 'confirmando' | 'erro';

export function RecuperarFacialScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {representanteId, cpf, novaSenha} = route.params;
  const setAuth = useAuthStore(s => s.setAuth);

  const [phase, setPhase] = useState<Phase>('iniciando');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await iniciarRecuperacaoFacial(representanteId);
        if (!active) {
          return;
        }
        setSessionId(res.data.session_id);
        setPhase('capturando');
      } catch {
        if (!active) {
          return;
        }
        setError('Não foi possível iniciar a verificação facial. Tente novamente.');
        setPhase('erro');
      }
    })();
    return () => {
      active = false;
    };
  }, [representanteId]);

  // TODO(liveness-vendor): quando o fornecedor for confirmado (RF-BIO-08),
  // substituir o botão/setTimeout abaixo pelo componente de captura dele
  // (ex.: FaceLivenessDetector do AWS Amplify), usando o mesmo `sessionId`.
  // A captura em si nunca passa pelo backend Fynvex — só este `sessionId`
  // e, depois, o resultado via confirmarRecuperacaoFacial.
  const handleSimulateCapture = useCallback(() => {
    if (!sessionId) {
      return;
    }
    setError(null);
    setPhase('confirmando');
    setTimeout(async () => {
      try {
        const res = await confirmarRecuperacaoFacial(sessionId);
        const {access_token, expires_in, empresa, representante} = res.data;
        await setAuth({
          sessionToken: access_token,
          expiresAt: new Date(Date.now() + expires_in * 1000).toISOString(),
          empresaId: empresa.id,
          nomeFantasia: empresa.nome_fantasia,
          cnpj: empresa.cnpj,
          cpf,
          kycStatus: empresa.kyc_status,
          representanteId: representante.id,
          representanteNome: representante.nome,
          perfilAcesso: representante.perfil_acesso as EmpresaAuthState['perfilAcesso'],
        });
        // Fim de recuperação conta como "primeiro login" no dispositivo pra
        // fins de senha lembrada (RF-AUTH-04a) — senão a próxima abertura do
        // app pediria CPF+senha de novo, logo depois de acabar de recuperar.
        await saveSenhaToKeychain(cpf, novaSenha);
        // RootNavigator reage à mudança de `auth` e troca de tela sozinho.
      } catch (e: any) {
        const code = e?.response?.data?.error_code;
        setError(
          code === 'TOO_MANY_ATTEMPTS'
            ? 'Muitas tentativas seguidas. Tente novamente em alguns minutos.'
            : 'Não foi possível confirmar sua identidade. Tente novamente.',
        );
        setPhase('capturando');
      }
    }, 1200);
  }, [sessionId, cpf, novaSenha, setAuth]);

  if (phase === 'erro') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Text style={styles.title}>Algo deu errado</Text>
          <Text style={styles.subtitle}>{error}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.btnText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🤳</Text>
        </View>
        <Text style={styles.title}>Leitura facial</Text>
        <Text style={styles.subtitle}>
          Posicione o rosto dentro da área da câmera para concluir a recuperação da sua conta.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {(phase === 'iniciando' || phase === 'confirmando') && (
          <ActivityIndicator color="#124B9A" style={styles.spinner} />
        )}

        {phase === 'capturando' && (
          <TouchableOpacity style={styles.btn} onPress={handleSimulateCapture} activeOpacity={0.85}>
            <Text style={styles.btnText}>Simular leitura facial</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  content: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32},
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {fontSize: 30},
  title: {fontSize: 19, fontWeight: '800', color: '#0F2137', textAlign: 'center', marginBottom: 8},
  subtitle: {fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 20},
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 16, width: '100%'},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19, textAlign: 'center'},
  spinner: {marginTop: 8, marginBottom: 24},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, marginTop: 8},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  link: {color: '#6b7280', fontSize: 14, marginTop: 20},
});
