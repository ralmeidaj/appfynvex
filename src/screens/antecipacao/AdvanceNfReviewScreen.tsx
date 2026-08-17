import React, {useState} from 'react';
import {View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {InicioStackParamList} from '../../navigation/EmpresaNavigator';
import {confirmarDadosNf} from '../../api/antecipacoes';
import {useAntecipacaoStore} from '../../store/antecipacaoStore';
import {formatDateBR, parseDateBR} from '../../utils/format';

type Nav = NativeStackNavigationProp<InicioStackParamList>;

function EditableField({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

// RF-ANT-04 — dados extraídos exibidos para revisão e correção manual antes
// da simulação. Não há mais prazo mínimo bloqueante (RN-14) — a NF sempre
// segue para simulação, um prazo curto só resulta em deságio maior.
export function AdvanceNfReviewScreen() {
  const navigation = useNavigation<Nav>();
  const nfLeituraId = useAntecipacaoStore(s => s.nfLeituraId);
  const nf = useAntecipacaoStore(s => s.nfDados);
  const setNfDados = useAntecipacaoStore(s => s.setNfDados);

  const [numero, setNumero] = useState(nf?.numero ?? '');
  const [tomador, setTomador] = useState(nf?.tomador ?? '');
  const [cnpjTomador, setCnpjTomador] = useState(nf?.cnpjTomador ?? '');
  const [valorTexto, setValorTexto] = useState(nf ? String(nf.valor).replace('.', ',') : '');
  const [valorSolicitadoTexto, setValorSolicitadoTexto] = useState(
    nf ? String(nf.valorSolicitado).replace('.', ',') : '',
  );
  const [dataEmissao, setDataEmissao] = useState(nf ? formatDateBR(nf.dataEmissao) : '');
  const [dataVencimento, setDataVencimento] = useState(nf ? formatDateBR(nf.dataVencimento) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!nfLeituraId) {
      return;
    }
    const valor = Number(valorTexto.replace(/\./g, '').replace(',', '.'));
    const valorSolicitado = Number(valorSolicitadoTexto.replace(/\./g, '').replace(',', '.'));
    if (!numero.trim() || !tomador.trim() || !cnpjTomador.trim() || !valor || !dataEmissao || !dataVencimento) {
      setError('Preencha todos os campos antes de continuar.');
      return;
    }
    if (!valorSolicitado || valorSolicitado > valor) {
      setError('O valor solicitado deve ser maior que zero e não pode passar do valor total da NF.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const dadosCorrigidos = {
        numero: numero.trim(),
        tomador: tomador.trim(),
        cnpjTomador: cnpjTomador.trim(),
        valor,
        valorSolicitado,
        dataEmissao: parseDateBR(dataEmissao),
        dataVencimento: parseDateBR(dataVencimento),
      };
      await confirmarDadosNf(nfLeituraId, dadosCorrigidos);
      setNfDados(dadosCorrigidos);
      navigation.navigate('AdvanceSimulate');
    } catch {
      setError('Não foi possível confirmar os dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Dados identificados</Text>
        <Text style={styles.subtitle}>
          Confira e corrija, se precisar, os dados que nossa IA encontrou na Nota Fiscal enviada.
        </Text>

        <View style={styles.card}>
          <EditableField label="Número da NF" value={numero} onChangeText={setNumero} />
          <View style={styles.divider} />
          <EditableField label="Tomador / Convênio" value={tomador} onChangeText={setTomador} />
          <View style={styles.divider} />
          <EditableField label="CNPJ do tomador" value={cnpjTomador} onChangeText={setCnpjTomador} />
          <View style={styles.divider} />
          <EditableField label="Valor total da NF (R$)" value={valorTexto} onChangeText={setValorTexto} keyboardType="numeric" />
          <View style={styles.divider} />
          <EditableField
            label="Valor que você quer antecipar (R$)"
            value={valorSolicitadoTexto}
            onChangeText={setValorSolicitadoTexto}
            keyboardType="numeric"
          />
          <View style={styles.divider} />
          <EditableField label="Data de emissão (dd/mm/aaaa)" value={dataEmissao} onChangeText={setDataEmissao} />
          <View style={styles.divider} />
          <EditableField
            label="Data de vencimento (dd/mm/aaaa)"
            value={dataVencimento}
            onChangeText={setDataVencimento}
          />
        </View>
        <Text style={styles.hint}>
          Se esta NF já tem parte antecipada em outra solicitação, o valor acima já vem descontado
          do que ainda está disponível.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.btn} onPress={handleContinue} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Continuar</Text>}
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
  title: {fontSize: 22, fontWeight: '800', color: '#0F2137', marginBottom: 8},
  subtitle: {fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 16},
  card: {backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 16},
  field: {paddingVertical: 4},
  fieldLabel: {fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4},
  fieldInput: {fontSize: 15, color: '#111827', marginTop: 4, fontWeight: '600', paddingVertical: 4},
  divider: {height: 1, backgroundColor: '#f0f1f3', marginVertical: 6},
  hint: {fontSize: 12, color: '#6b7280', lineHeight: 17, marginTop: 10},
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 16},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
});
