import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  Alert,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {InicioStackParamList} from '../../navigation/EmpresaNavigator';
import {recusarAntecipacao} from '../../api/antecipacoes';
import {useAntecipacaoStore} from '../../store/antecipacaoStore';
import {formatBRL, formatDateBR} from '../../utils/format';

type Nav = NativeStackNavigationProp<InicioStackParamList>;
type Route = RouteProp<InicioStackParamList, 'AdvanceTerceiroReview'>;

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

// RF-TER-04/05/07 — revisão somente-leitura de antecipação originada por terceiro
// (gestora/hospital convenente). Aprovar reaproveita sem alteração o mecanismo de
// assinatura de RF-ANT-07 (mesmo modal de termo + AdvanceFacialConfirmScreen) — não
// existe upload/simulação aqui, os valores já vêm prontos. Recusar não tem 2º fator,
// só confirmação simples (RF-TER-07), e é definitiva.
export function AdvanceTerceiroReviewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {antecipacao} = route.params;
  const setAntecipacaoId = useAntecipacaoStore(s => s.setAntecipacaoId);
  const setSimulacao = useAntecipacaoStore(s => s.setSimulacao);

  const [modalOpen, setModalOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [recusando, setRecusando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // RF-ANT-07a: o checkbox só fica interativo depois que o usuário rolar o
  // termo até o fim — não basta abrir o modal.
  function handleTermsScroll({nativeEvent}: NativeSyntheticEvent<NativeScrollEvent>) {
    const {layoutMeasurement, contentOffset, contentSize} = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
      setScrolledToEnd(true);
    }
  }

  function handleOpenModal() {
    setAccepted(false);
    setScrolledToEnd(false);
    setError(null);
    setModalOpen(true);
  }

  function handleConfirmSignature() {
    setModalOpen(false);
    setAntecipacaoId(antecipacao.id);
    setSimulacao({
      valorBruto: antecipacao.valor_bruto,
      desagioPct: antecipacao.desagio_pct,
      desagio: antecipacao.desagio,
      taxaAdministrativa: antecipacao.taxa_administrativa,
      valorLiquido: antecipacao.valor_liquido,
      dataCreditoPrevista: antecipacao.data_credito,
    });
    navigation.navigate('AdvanceFacialConfirm');
  }

  function handleRecusar() {
    Alert.alert(
      'Recusar antecipação',
      'Tem certeza que deseja recusar esta solicitação? Essa ação não pode ser desfeita.',
      [
        {text: 'Voltar', style: 'cancel'},
        {
          text: 'Recusar',
          style: 'destructive',
          onPress: async () => {
            setRecusando(true);
            setError(null);
            try {
              await recusarAntecipacao(antecipacao.id);
              navigation.navigate('Home');
            } catch {
              setError('Não foi possível recusar esta solicitação. Tente novamente.');
            } finally {
              setRecusando(false);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Antecipação recebida</Text>
        <Text style={styles.subtitle}>
          Esta solicitação foi originada por {antecipacao.tomador} e está pronta para sua aprovação.
        </Text>

        <View style={styles.card}>
          <Field label="Nota Fiscal" value={`NF ${antecipacao.nf_numero} · ${antecipacao.tomador}`} />
          <View style={styles.divider} />
          <Field label="Valor bruto" value={formatBRL(antecipacao.valor_bruto)} />
          <View style={styles.divider} />
          <Field
            label="Deságio"
            value={`- ${formatBRL(antecipacao.desagio)} (${antecipacao.desagio_pct.toLocaleString('pt-BR')}%)`}
          />
          <View style={styles.divider} />
          <Field label="Taxa administrativa" value={`- ${formatBRL(antecipacao.taxa_administrativa)}`} />
          <View style={styles.divider} />
          <Field label="Valor líquido" value={formatBRL(antecipacao.valor_liquido)} />
          <View style={styles.divider} />
          <Field label="Data prevista de crédito" value={formatDateBR(antecipacao.data_credito)} />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.btn} onPress={handleOpenModal} disabled={recusando} activeOpacity={0.85}>
          <Text style={styles.btnText}>Aprovar e assinar</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleRecusar} disabled={recusando} style={styles.recusarLink}>
          {recusando ? (
            <ActivityIndicator color="#dc3545" />
          ) : (
            <Text style={styles.recusarText}>Recusar solicitação</Text>
          )}
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
              activeOpacity={0.8}>
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
              activeOpacity={0.85}>
              <Text style={styles.btnText}>Assinar e confirmar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalOpen(false)}>
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
  fieldLabel: {fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4},
  fieldValue: {fontSize: 14, color: '#111827', marginTop: 4, fontWeight: '600'},
  divider: {height: 1, backgroundColor: '#f0f1f3', marginVertical: 10},
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 16},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  recusarLink: {alignItems: 'center', marginTop: 16, padding: 8},
  recusarText: {color: '#dc3545', fontSize: 14, fontWeight: '600'},
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
  scrollHint: {fontSize: 12, color: '#9ca3af', marginTop: 6, marginLeft: 32},
  cancelText: {color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 14},
});
