import React, {useEffect} from 'react';
import {View, StyleSheet, ActivityIndicator} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {InicioStackParamList} from '../../navigation/EmpresaNavigator';
import {obterNotaFiscal} from '../../api/antecipacoes';
import {useAntecipacaoStore} from '../../store/antecipacaoStore';

type Nav = NativeStackNavigationProp<InicioStackParamList>;

// Mesmo padrão de CadastroAiExtractScreen (RF-ANT-03, mesmo mecanismo de
// RF-CAD-05) — duplicado por convenção, não compartilhado (ver CLAUDE.md).
export function AdvanceNfExtractScreen() {
  const navigation = useNavigation<Nav>();
  const nfLeituraId = useAntecipacaoStore(s => s.nfLeituraId);
  const setNfDados = useAntecipacaoStore(s => s.setNfDados);

  useEffect(() => {
    if (!nfLeituraId) {
      navigation.goBack();
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await obterNotaFiscal(nfLeituraId);
        if (!active) {
          return;
        }
        setNfDados({
          numero: res.data.numero,
          tomador: res.data.tomador,
          cnpjTomador: res.data.cnpj_tomador,
          valor: res.data.valor,
          valorSolicitado: res.data.valor_solicitado,
          dataEmissao: res.data.data_emissao,
          dataVencimento: res.data.data_vencimento,
        });
        navigation.navigate('AdvanceNfReview');
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
  }, [nfLeituraId, navigation, setNfDados]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.iconCircle} importantForAccessibility="no-hide-descendants">
          <Text style={styles.icon}>🤖</Text>
        </View>
        <Text style={styles.title}>Analisando a Nota Fiscal</Text>
        <Text style={styles.subtitle}>
          Nossa IA está lendo o documento e identificando os dados do recebível. Isso leva poucos
          segundos.
        </Text>
        <ActivityIndicator color="#0F2137" style={styles.spinner} accessibilityLabel="Analisando a Nota Fiscal" />
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
