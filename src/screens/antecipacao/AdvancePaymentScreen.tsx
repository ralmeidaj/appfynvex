import React, {useCallback, useEffect, useState} from 'react';
import {View, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Clipboard} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {InicioStackParamList} from '../../navigation/EmpresaNavigator';
import {obterPagamento, type ObterPagamentoResponse} from '../../api/antecipacoes';
import {MockQrCode, MockBarcode} from '../../components/MockPaymentCodes';
import {formatBRL, formatDateBR} from '../../utils/format';

type Nav = NativeStackNavigationProp<InicioStackParamList>;
type Route = RouteProp<InicioStackParamList, 'AdvancePayment'>;

function CopyButton({value, label}: {value: string; label: string}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    Clipboard?.setString?.(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <TouchableOpacity style={[styles.copyBtn, copied && styles.copyBtnDone]} onPress={handleCopy} activeOpacity={0.8}>
      <Text style={[styles.copyBtnText, copied && styles.copyBtnTextDone]}>{copied ? '✓ Copiado!' : label}</Text>
    </TouchableOpacity>
  );
}

// RF-PAG — liquidação da NF pelo tomador (RF-ANT-11), nunca uma cobrança à
// PJ. QR Code Pix + código de barras só aparecem quando a empresa NÃO tem
// vínculo de parceiro confirmado (RF-PAG-01) — o backend já decide isso e
// manda pix_payload/linha_digitavel null quando não se aplica. Nunca há
// ação de "confirmar liquidação" no app (RF-PAG-04): só reflete o status
// mais recente do backend, atualizado aqui por pull manual ou push.
export function AdvancePaymentScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {antecipacaoId, nfNumero} = route.params;

  const [pagamento, setPagamento] = useState<ObterPagamentoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await obterPagamento(antecipacaoId);
      setPagamento(res.data);
    } catch {
      setError('Não foi possível carregar o pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [antecipacaoId]);

  useEffect(() => {
    load();
  }, [load]);

  const paid = pagamento?.pagamento_status === 'paid';

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#0F2137" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Liquidação</Text>

          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroLabel}>NF {nfNumero} · {pagamento?.tomador ?? '—'}</Text>
              <View style={[styles.badge, paid ? styles.badgePaid : styles.badgePending]}>
                <Text style={styles.badgeText}>{paid ? 'Liquidada' : 'Pendente'}</Text>
              </View>
            </View>
            <Text style={styles.heroValue}>{pagamento ? formatBRL(pagamento.valor_bruto) : '—'}</Text>
            <Text style={styles.heroSub}>
              Vencimento em {pagamento ? formatDateBR(pagamento.data_vencimento) : '—'}
            </Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {paid && (
            <View style={styles.paidNotice}>
              <Text style={styles.paidNoticeText}>✓ Esta operação já foi liquidada.</Text>
            </View>
          )}

          {!paid && pagamento && !pagamento.pix_payload && (
            <View style={styles.infoNotice}>
              <Text style={styles.infoNoticeText}>
                A liquidação desta operação é feita diretamente pela plataforma do seu parceiro —
                nenhuma ação é necessária aqui. Esta tela será atualizada automaticamente quando
                for confirmada.
              </Text>
            </View>
          )}

          {!paid && pagamento?.pix_payload && pagamento?.linha_digitavel && (
            <>
              <Text style={styles.hint}>Escaneie o QR Code ou use o código de barras para acompanhar</Text>

              <View style={styles.qrWrap}>
                <MockQrCode value={pagamento.pix_payload} size={180} />
              </View>
              <View style={styles.copyLineBox}>
                <Text style={styles.copyLineText}>{pagamento.pix_payload}</Text>
              </View>
              <CopyButton value={pagamento.pix_payload} label="Copiar código Pix" />

              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Código de barras</Text>
                <View style={styles.barcodeWrap}>
                  <MockBarcode value={pagamento.linha_digitavel} width={280} height={90} />
                </View>
                <View style={styles.copyLineBox}>
                  <Text style={styles.copyLineText}>{pagamento.linha_digitavel}</Text>
                </View>
                <CopyButton value={pagamento.linha_digitavel} label="Copiar código de barras" />
              </View>
            </>
          )}

          {!paid && pagamento && (
            <TouchableOpacity style={styles.refreshBtn} onPress={load} activeOpacity={0.8}>
              <Text style={styles.refreshText}>Atualizar status da liquidação</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  back: {padding: 20},
  backText: {color: '#124B9A', fontSize: 15},
  loadingBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  content: {paddingHorizontal: 24, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '800', color: '#0F2137', marginBottom: 16},
  heroCard: {backgroundColor: '#0F2137', borderRadius: 16, padding: 20},
  heroTopRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  heroLabel: {color: '#d4d6d9', fontSize: 13, flex: 1, marginRight: 8},
  heroValue: {color: '#ffffff', fontSize: 28, fontWeight: '800'},
  heroSub: {color: '#d4d6d9', fontSize: 13, marginTop: 6},
  badge: {borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4},
  badgePending: {backgroundColor: 'rgba(255,255,255,0.15)'},
  badgePaid: {backgroundColor: '#15803d'},
  badgeText: {color: '#ffffff', fontSize: 12, fontWeight: '700'},
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 16},
  errorText: {color: '#b91c1c', fontSize: 13, lineHeight: 19},
  paidNotice: {backgroundColor: '#dcfce7', borderRadius: 10, padding: 14, marginTop: 16},
  paidNoticeText: {color: '#15803d', fontSize: 14, fontWeight: '600', textAlign: 'center'},
  infoNotice: {backgroundColor: '#eef3ff', borderRadius: 10, padding: 14, marginTop: 16},
  infoNoticeText: {color: '#124B9A', fontSize: 13, lineHeight: 19, textAlign: 'center'},
  hint: {fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 20, marginBottom: 12},
  qrWrap: {alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, padding: 16, alignSelf: 'center'},
  copyLineBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  copyLineText: {fontSize: 12, color: '#374151', fontFamily: 'monospace'},
  copyBtn: {borderWidth: 1.5, borderColor: '#124B9A', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8},
  copyBtnDone: {borderColor: '#16a34a', backgroundColor: '#dcfce7'},
  copyBtnText: {color: '#124B9A', fontSize: 14, fontWeight: '700'},
  copyBtnTextDone: {color: '#15803d'},
  card: {backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginTop: 16},
  fieldLabel: {fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4},
  barcodeWrap: {alignItems: 'center', marginTop: 10},
  refreshBtn: {padding: 14, alignItems: 'center', marginTop: 16},
  refreshText: {color: '#6b7280', fontSize: 13, fontWeight: '600'},
});
