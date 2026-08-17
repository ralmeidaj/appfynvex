import React, {useState} from 'react';
import {View, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {InicioStackParamList} from '../../navigation/EmpresaNavigator';
import {enviarNotaFiscal} from '../../api/antecipacoes';
import {useAntecipacaoStore} from '../../store/antecipacaoStore';
import {DocCard} from '../../components/DocCard';

type Nav = NativeStackNavigationProp<InicioStackParamList>;

// RF-ANT-01/02 — a solicitação sempre começa pelo envio de uma Nota Fiscal.
export function AdvanceNewScreen() {
  const navigation = useNavigation<Nav>();
  const [attached, setAttached] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setNfLeituraId = useAntecipacaoStore(s => s.setNfLeituraId);

  const canSubmit = attached && consentAccepted;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await enviarNotaFiscal();
      setNfLeituraId(res.data.nf_leitura_id);
      navigation.navigate('AdvanceNfExtract');
    } catch {
      setError('Não foi possível enviar a Nota Fiscal. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Nova solicitação</Text>
        <Text style={styles.subtitle}>
          Envie a Nota Fiscal do recebível. Nossa IA lê o documento e identifica os dados
          automaticamente.
        </Text>

        <DocCard
          title="Nota Fiscal"
          required
          attached={attached}
          hint="Nossa IA lê o arquivo e identifica os dados do recebível"
          onToggle={() => setAttached(!attached)}
        />

        <TouchableOpacity style={styles.checkboxRow} onPress={() => setConsentAccepted(!consentAccepted)} activeOpacity={0.8}>
          <View style={[styles.checkbox, consentAccepted && styles.checkboxChecked]}>
            {consentAccepted && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            Autorizo a leitura desta Nota Fiscal por inteligência artificial (OCR) para extração automática dos dados.
          </Text>
        </TouchableOpacity>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, !canSubmit && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
          activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Enviar Nota Fiscal</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  back: {padding: 20},
  backText: {color: '#124B9A', fontSize: 15},
  content: {paddingHorizontal: 24, paddingBottom: 40},
  title: {fontSize: 26, fontWeight: '800', color: '#0F2137', marginBottom: 10},
  subtitle: {fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 20},
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 16},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  checkboxRow: {flexDirection: 'row', alignItems: 'flex-start', marginTop: 20, gap: 10},
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {backgroundColor: '#124B9A', borderColor: '#124B9A'},
  checkboxMark: {color: '#ffffff', fontSize: 14, fontWeight: '800'},
  checkboxLabel: {flex: 1, fontSize: 13, color: '#374151', lineHeight: 19},
});
