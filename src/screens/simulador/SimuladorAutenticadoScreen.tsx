import React, {useState} from 'react';
import {View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {InicioStackParamList} from '../../navigation/EmpresaNavigator';
import {simulacaoPublica, type SimularAntecipacaoResponse} from '../../api/antecipacoes';
import {useAntecipacaoStore} from '../../store/antecipacaoStore';
import {formatBRL, formatDateBR, parseDateBR} from '../../utils/format';

type Nav = NativeStackNavigationProp<InicioStackParamList>;

// RF-SIM-04 — mesmo simulador de SimuladorScreen.tsx (duplicado por
// convenção de momento de autenticação, não compartilhado — ver
// CLAUDE.md), acessível já logado a partir da Home. Única diferença de
// comportamento: o CTA final leva pro upload de NF (RF-ANT-01) em vez de
// pro cadastro, levando os valores simulados como prefill (RF-ANT-04).
export function SimuladorAutenticadoScreen() {
  const navigation = useNavigation<Nav>();
  const setSimuladoPrefill = useAntecipacaoStore(s => s.setSimuladoPrefill);
  const [valorTexto, setValorTexto] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [resultado, setResultado] = useState<SimularAntecipacaoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valor = Number(valorTexto.replace(/\./g, '').replace(',', '.'));
  const valido = valor > 0 && /^\d{2}\/\d{2}\/\d{4}$/.test(vencimento);

  async function handleSimular() {
    if (!valido) {
      setError('Informe o valor da Nota Fiscal e a data de vencimento (dd/mm/aaaa).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await simulacaoPublica(valor, parseDateBR(vencimento));
      setResultado(res.data);
    } catch {
      setError('Não foi possível simular agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function handleSolicitar() {
    setSimuladoPrefill({valorBruto: valor, dataVencimento: parseDateBR(vencimento)});
    navigation.navigate('AdvanceNew');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Simule sua antecipação</Text>
        <Text style={styles.subtitle}>Informe o valor e o vencimento da Nota Fiscal.</Text>

        <Text style={styles.label}>Valor bruto da NF (R$)</Text>
        <TextInput
          style={styles.input}
          placeholder="0,00"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={valorTexto}
          onChangeText={setValorTexto}
        />

        <Text style={[styles.label, styles.labelSpaced]}>Data de vencimento (dd/mm/aaaa)</Text>
        <TextInput
          style={styles.input}
          placeholder="00/00/0000"
          placeholderTextColor="#9ca3af"
          value={vencimento}
          onChangeText={setVencimento}
        />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.btn} onPress={handleSimular} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Simular</Text>}
        </TouchableOpacity>

        {resultado && (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.muted}>Valor bruto</Text>
                <Text style={styles.bold}>{formatBRL(resultado.valor_bruto)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.muted}>Deságio ({resultado.desagio_pct.toLocaleString('pt-BR')}%)</Text>
                <Text style={styles.negative}>- {formatBRL(resultado.desagio)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.muted}>Taxa administrativa</Text>
                <Text style={styles.negative}>- {formatBRL(resultado.taxa_administrativa)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.bold}>Valor líquido estimado</Text>
                <Text style={styles.netValue}>{formatBRL(resultado.valor_liquido)}</Text>
              </View>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Previsão de crédito em{' '}
                <Text style={styles.bold}>{formatDateBR(resultado.data_credito_prevista)}</Text>, após o envio e a
                assinatura da Nota Fiscal.
              </Text>
            </View>

            <TouchableOpacity style={styles.btnCta} onPress={handleSolicitar} activeOpacity={0.85}>
              <Text style={styles.btnText}>Solicitar com estes valores</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  back: {padding: 20},
  backText: {color: '#124B9A', fontSize: 15},
  content: {paddingHorizontal: 24, paddingBottom: 40},
  title: {fontSize: 24, fontWeight: '800', color: '#0F2137', marginBottom: 8},
  subtitle: {fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 20},
  label: {fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6},
  labelSpaced: {marginTop: 16},
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 16},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  card: {backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginTop: 24},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  muted: {fontSize: 14, color: '#6b7280'},
  bold: {fontSize: 14, fontWeight: '700', color: '#0F2137'},
  negative: {fontSize: 14, color: '#dc3545'},
  divider: {height: 1, backgroundColor: '#f0f1f3', marginVertical: 4},
  netValue: {fontSize: 18, fontWeight: '800', color: '#16a34a'},
  infoBox: {backgroundColor: '#eef3ff', borderRadius: 10, padding: 14, marginTop: 12},
  infoText: {fontSize: 13, color: '#374151', lineHeight: 19},
  btnCta: {backgroundColor: '#00A3E4', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16},
});
