import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {InicioStackParamList} from '../../navigation/EmpresaNavigator';
import {iniciarAssinaturaAntecipacao, confirmarAssinaturaAntecipacao} from '../../api/antecipacoes';
import {useAntecipacaoStore} from '../../store/antecipacaoStore';

type Nav = NativeStackNavigationProp<InicioStackParamList>;

// Mesmas 3 fases de AdvanceMaeFacialConfirmScreen — RF-ANT-07: mesmo
// mecanismo de segundo fator de RF-BIO-03.
type Phase = 'iniciando' | 'capturando' | 'confirmando' | 'erro';

export function AdvanceFacialConfirmScreen() {
  const navigation = useNavigation<Nav>();
  const antecipacaoId = useAntecipacaoStore(s => s.antecipacaoId);

  const [phase, setPhase] = useState<Phase>('iniciando');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!antecipacaoId) {
      navigation.goBack();
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await iniciarAssinaturaAntecipacao(antecipacaoId);
        if (!active) {
          return;
        }
        setSessionId(res.data.session_id);
        setPhase('capturando');
      } catch {
        if (!active) {
          return;
        }
        setError('Não foi possível iniciar a confirmação. Tente novamente.');
        setPhase('erro');
      }
    })();
    return () => {
      active = false;
    };
  }, [antecipacaoId, navigation]);

  // TODO(liveness-vendor): mesmo ponto de troca de RecuperarFacialScreen.tsx.
  const handleSimulateCapture = useCallback(() => {
    if (!sessionId || !antecipacaoId) {
      return;
    }
    setError(null);
    setPhase('confirmando');
    setTimeout(async () => {
      try {
        await confirmarAssinaturaAntecipacao(antecipacaoId, sessionId);
        navigation.navigate('AdvanceSuccess');
      } catch {
        setError('Não foi possível confirmar a assinatura. Tente novamente.');
        setPhase('capturando');
      }
    }, 1200);
  }, [sessionId, antecipacaoId, navigation]);

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
        <Text style={styles.title}>Confirme com leitura facial</Text>
        <Text style={styles.subtitle}>
          Por segurança, confirme esta solicitação de antecipação com a leitura facial (2º fator).
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

        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
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
