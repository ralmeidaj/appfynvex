import React, {useCallback, useEffect, useState} from 'react';
import {View, TouchableOpacity, StyleSheet, ActivityIndicator} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {obterCadastro} from '../../api/cadastro';
import {useCadastroStore} from '../../store/cadastroStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Só spinner — a "IA" é sempre a mesma resposta fixa (ver AI_EXTRACTION_MOCK),
// o delay aqui é só para a UX de "processando" não parecer instantânea.
export function CadastroAiExtractScreen() {
  const navigation = useNavigation<Nav>();
  const cadastroId = useCadastroStore(s => s.cadastroId);
  const setDadosExtraidos = useCadastroStore(s => s.setDadosExtraidos);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt(a => a + 1), []);

  useEffect(() => {
    if (!cadastroId) {
      navigation.goBack();
      return;
    }
    let active = true;
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await obterCadastro(cadastroId);
        if (!active) {
          return;
        }
        const dados = res.data.dados_extraidos;
        if (dados) {
          setDadosExtraidos({
            razaoSocial: dados.razao_social,
            nomeFantasia: dados.nome_fantasia,
            endereco: dados.endereco,
            responsavelNome: dados.responsavel_legal.nome,
            responsavelCpf: dados.responsavel_legal.cpf,
            responsavelCargo: dados.responsavel_legal.cargo,
          });
        }
        navigation.navigate('CadastroAiReview');
      } catch {
        if (active) {
          setError('Não foi possível ler o Contrato Social. Verifique sua conexão e tente novamente.');
        }
      }
    }, 1800);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cadastroId, navigation, setDadosExtraidos, attempt]);

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.iconCircleError} importantForAccessibility="no-hide-descendants">
            <Text style={styles.icon}>⚠️</Text>
          </View>
          <Text style={styles.title}>Não foi possível ler o documento</Text>
          <Text style={styles.subtitle}>{error}</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={retry}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente">
            <Text style={styles.btnText}>Tentar novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Voltar">
            <Text style={styles.link}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.iconCircle} importantForAccessibility="no-hide-descendants">
          <Text style={styles.icon}>🤖</Text>
        </View>
        <Text style={styles.title}>Analisando o Contrato Social</Text>
        <Text style={styles.subtitle}>
          Nossa IA está lendo o documento e identificando os dados da empresa. Isso leva poucos
          segundos.
        </Text>
        <ActivityIndicator color="#0F2137" style={styles.spinner} accessibilityLabel="Analisando o Contrato Social" />
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
  iconCircleError: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {fontSize: 30},
  title: {fontSize: 19, fontWeight: '800', color: '#0F2137', textAlign: 'center', marginBottom: 8},
  subtitle: {fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20},
  spinner: {marginTop: 24},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, marginTop: 20},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  link: {color: '#6b7280', fontSize: 14, marginTop: 20},
});
