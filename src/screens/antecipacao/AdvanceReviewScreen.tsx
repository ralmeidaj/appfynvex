import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {InicioStackParamList} from '../../navigation/EmpresaNavigator';
import {criarAntecipacao} from '../../api/antecipacoes';
import {getDadosBancarios} from '../../api/perfil';
import {useAntecipacaoStore} from '../../store/antecipacaoStore';
import {formatBRL, formatDateBR} from '../../utils/format';

type Nav = NativeStackNavigationProp<InicioStackParamList>;

const CONTRACT_TEXT = `TERMO DE CESSÃO DE RECEBÍVEIS (BORDERÔ) — FYNVEX (texto ilustrativo)

1. Objeto. Pelo presente termo, o CEDENTE cede à Fynvex os direitos creditórios representados pela Nota Fiscal informada nesta operação, mediante pagamento antecipado do valor líquido apurado, descontados o deságio e a taxa administrativa vigentes.

2. Deságio e taxa administrativa. Aplica-se sobre o valor bruto da Nota Fiscal o percentual de deságio vigente, além de taxa administrativa fixa ou percentual conforme condições comerciais, ambos informados previamente ao CEDENTE na tela de simulação.

3. Crédito. O valor líquido será depositado na conta bancária ou Pix cadastrado pelo CEDENTE em até 1 dia útil após a confirmação da assinatura.

4. Confirmação. A assinatura desta operação é validada por meio de segundo fator de autenticação (leitura facial). Em produção, a assinatura eletrônica dos contratos ocorre por meio de plataforma especializada de assinatura digital.

5. Disposições gerais. Este é um texto ilustrativo utilizado apenas para fins de protótipo e não constitui documento legal válido.`;

function Field({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

// RF-ANT-06/07 — revisão final + aceite do termo de cessão antes da
// assinatura por leitura facial. É aqui (e não antes) que a criação da
// solicitação é tentada — RN-11 (NF duplicada) é decidido pelo backend
// nesse momento, nunca adivinhado no app.
export function AdvanceReviewScreen() {
  const navigation = useNavigation<Nav>();
  const nf = useAntecipacaoStore(s => s.nfDados);
  const simulacao = useAntecipacaoStore(s => s.simulacao);
  const nfLeituraId = useAntecipacaoStore(s => s.nfLeituraId);
  const setAntecipacaoId = useAntecipacaoStore(s => s.setAntecipacaoId);

  const [bankInfo, setBankInfo] = useState('—');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [signing, setSigning] = useState(false);

  // RF-ANT-07a: o checkbox só fica interativo depois que o usuário rolar o
  // termo até o fim — não basta abrir o modal.
  function handleTermsScroll({nativeEvent}: NativeSyntheticEvent<NativeScrollEvent>) {
    const {layoutMeasurement, contentOffset, contentSize} = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
      setScrolledToEnd(true);
    }
  }

  useEffect(() => {
    getDadosBancarios()
      .then(res => {
        const d = res.data;
        setBankInfo(d.tipo_transferencia === 'pix' ? `Pix: ${d.pix}` : `${d.banco_nome} · Ag. ${d.agencia} · Conta ${d.conta}`);
      })
      .catch(() => setBankInfo('—'));
  }, []);

  async function handleStartSignature() {
    if (!nfLeituraId) {
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await criarAntecipacao(nfLeituraId);
      setAntecipacaoId(res.data.id);
      setAccepted(false);
      setScrolledToEnd(false);
      setModalOpen(true);
    } catch (err: any) {
      const errorCode = err?.response?.data?.error_code;
      if (errorCode === 'SALDO_NF_INSUFICIENTE') {
        setError(err.response.data.message || 'Esta Nota Fiscal não tem saldo suficiente para este valor.');
      } else {
        setError('Não foi possível criar a solicitação. Tente novamente.');
      }
    } finally {
      setCreating(false);
    }
  }

  function handleConfirmSignature() {
    setSigning(true);
    setModalOpen(false);
    navigation.navigate('AdvanceFacialConfirm');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity
        style={styles.back}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Voltar">
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Revisão</Text>
        <Text style={styles.subtitle}>Confira os detalhes antes de assinar a solicitação.</Text>

        <View style={styles.card}>
          <Field label="Nota Fiscal" value={nf ? `NF ${nf.numero} · ${nf.tomador}` : '—'} />
          <View style={styles.divider} />
          <Field label="Valor bruto" value={simulacao ? formatBRL(simulacao.valorBruto) : '—'} />
          <View style={styles.divider} />
          <Field
            label="Deságio"
            value={simulacao ? `- ${formatBRL(simulacao.desagio)} (${simulacao.desagioPct.toLocaleString('pt-BR')}%)` : '—'}
          />
          <View style={styles.divider} />
          <Field label="Taxa administrativa" value={simulacao ? `- ${formatBRL(simulacao.taxaAdministrativa)}` : '—'} />
          <View style={styles.divider} />
          <Field label="Valor líquido" value={simulacao ? formatBRL(simulacao.valorLiquido) : '—'} />
          <View style={styles.divider} />
          <Field label="Data prevista de crédito" value={simulacao ? formatDateBR(simulacao.dataCreditoPrevista) : '—'} />
          <View style={styles.divider} />
          <Field label="Crédito será enviado para" value={bankInfo} />
        </View>

        {error && (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.btn}
          onPress={handleStartSignature}
          disabled={creating || signing}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Assinar e confirmar"
          accessibilityState={{disabled: creating || signing, busy: creating}}>
          {creating ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Assinar e confirmar</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Termo de cessão de recebíveis</Text>
            <ScrollView style={styles.sheetBody} onScroll={handleTermsScroll} scrollEventThrottle={100}>
              <Text style={styles.termsText}>{CONTRACT_TEXT}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => scrolledToEnd && setAccepted(!accepted)}
              disabled={!scrolledToEnd}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{checked: accepted, disabled: !scrolledToEnd}}
              accessibilityLabel="Li e aceito os termos desta cessão de recebíveis.">
              <View style={[styles.checkbox, accepted && styles.checkboxChecked, !scrolledToEnd && styles.checkboxDisabled]}>
                {accepted && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Li e aceito os termos desta cessão de recebíveis.</Text>
            </TouchableOpacity>
            {!scrolledToEnd && (
              <Text style={styles.scrollHint}>Role o texto acima até o final para habilitar o aceite.</Text>
            )}
            <TouchableOpacity
              style={[styles.btn, !accepted && styles.btnDisabled]}
              onPress={handleConfirmSignature}
              disabled={!accepted}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Assinar e confirmar"
              accessibilityState={{disabled: !accepted}}>
              <Text style={styles.btnText}>Assinar e confirmar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setModalOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancelar">
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  fieldLabel: {fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4},
  fieldValue: {fontSize: 14, color: '#111827', marginTop: 4, fontWeight: '600'},
  divider: {height: 1, backgroundColor: '#f0f1f3', marginVertical: 10},
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 16},
  errorText: {color: '#b91c1c', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  modalBackdrop: {flex: 1, backgroundColor: 'rgba(4,19,36,0.5)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%', padding: 20},
  sheetTitle: {fontSize: 16, fontWeight: '800', color: '#0F2137', marginBottom: 12},
  sheetBody: {maxHeight: 300, backgroundColor: '#f8fafc', borderRadius: 10, padding: 12},
  termsText: {fontSize: 13, lineHeight: 20, color: '#374151'},
  checkboxRow: {flexDirection: 'row', alignItems: 'flex-start', marginTop: 16, gap: 10},
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
  checkboxDisabled: {backgroundColor: '#f3f4f6'},
  checkboxMark: {color: '#ffffff', fontSize: 14, fontWeight: '800'},
  checkboxLabel: {flex: 1, fontSize: 13, color: '#374151', lineHeight: 19},
  scrollHint: {fontSize: 12, color: '#6b7280', marginTop: 6, marginLeft: 32},
  cancelText: {color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 14},
});
