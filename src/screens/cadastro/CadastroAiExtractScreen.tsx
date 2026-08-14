import React, {useEffect} from 'react';
import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';
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

  useEffect(() => {
    if (!cadastroId) {
      navigation.goBack();
      return;
    }
    let active = true;
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
          navigation.goBack();
        }
      }
    }, 1800);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cadastroId, navigation, setDadosExtraidos]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🤖</Text>
        </View>
        <Text style={styles.title}>Analisando o Contrato Social</Text>
        <Text style={styles.subtitle}>
          Nossa IA está lendo o documento e identificando os dados da empresa. Isso leva poucos
          segundos.
        </Text>
        <ActivityIndicator color="#0F2137" style={styles.spinner} />
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
  subtitle: {fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20},
  spinner: {marginTop: 24},
});
