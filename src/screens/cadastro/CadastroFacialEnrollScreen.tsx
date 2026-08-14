import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {iniciarLeituraFacialCadastro, confirmarLeituraFacialCadastro} from '../../api/cadastro';
import {useCadastroStore} from '../../store/cadastroStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Mesmas 3 fases dos outros pontos de leitura facial do app (ver
// RecuperarFacialScreen) — é o mesmo mecanismo (RF-BIO-03), aqui usado pra
// cadastrar o template em vez de verificar contra um já existente.
type Phase = 'iniciando' | 'capturando' | 'confirmando' | 'erro';

export function CadastroFacialEnrollScreen() {
  const navigation = useNavigation<Nav>();
  const cadastroId = useCadastroStore(s => s.cadastroId);

  const [phase, setPhase] = useState<Phase>('iniciando');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cadastroId) {
      navigation.goBack();
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await iniciarLeituraFacialCadastro(cadastroId);
        if (!active) {
          return;
        }
        setSessionId(res.data.session_id);
        setPhase('capturando');
      } catch {
        if (!active) {
          return;
        }
        setError('Não foi possível iniciar a leitura facial. Tente novamente.');
        setPhase('erro');
      }
    })();
    return () => {
      active = false;
    };
  }, [cadastroId, navigation]);

  // TODO(liveness-vendor): mesmo ponto de troca dos outros pontos de
  // leitura facial do app — ver RecuperarFacialScreen.tsx.
  const handleSimulateCapture = useCallback(() => {
    if (!sessionId || !cadastroId) {
      return;
    }
    setError(null);
    setPhase('confirmando');
    setTimeout(async () => {
      try {
        await confirmarLeituraFacialCadastro(cadastroId, sessionId);
        navigation.navigate('CadastroBankData');
      } catch {
        setError('Não foi possível concluir a leitura facial. Tente novamente.');
        setPhase('capturando');
      }
    }, 1200);
  }, [sessionId, cadastroId, navigation]);

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
        <Text style={styles.title}>Cadastre sua leitura facial</Text>
        <Text style={styles.subtitle}>
          Esta leitura será usada como 2º fator para confirmar assinaturas (antecipações,
          Contrato-Mãe) — o login do dia a dia continua sendo só CPF e senha. Posicione o rosto
          dentro da área da câmera.
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
            <Text style={styles.btnText}>Fazer leitura facial</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Voltar</Text>
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
