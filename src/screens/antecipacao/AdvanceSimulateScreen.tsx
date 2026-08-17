import React, {useEffect, useState} from 'react';
import {View, TouchableOpacity, StyleSheet, ActivityIndicator} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {InicioStackParamList} from '../../navigation/EmpresaNavigator';
import {simularAntecipacao} from '../../api/antecipacoes';
import {useAntecipacaoStore} from '../../store/antecipacaoStore';
import {formatBRL, formatDateBR} from '../../utils/format';

type Nav = NativeStackNavigationProp<InicioStackParamList>;

// RF-ANT-05 — valor bruto, deságio, taxa administrativa, líquido e data
// prevista de crédito, antes da revisão final.
export function AdvanceSimulateScreen() {
  const navigation = useNavigation<Nav>();
  const nfLeituraId = useAntecipacaoStore(s => s.nfLeituraId);
  const simulacao = useAntecipacaoStore(s => s.simulacao);
  const setSimulacao = useAntecipacaoStore(s => s.setSimulacao);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nfLeituraId) {
      navigation.goBack();
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await simularAntecipacao(nfLeituraId);
        if (!active) {
          return;
        }
        setSimulacao({
          valorBruto: res.data.valor_bruto,
          desagioPct: res.data.desagio_pct,
          desagio: res.data.desagio,
          taxaAdministrativa: res.data.taxa_administrativa,
          valorLiquido: res.data.valor_liquido,
          dataCreditoPrevista: res.data.data_credito_prevista,
        });
      } catch {
        if (active) {
          setError('Não foi possível calcular a simulação. Tente novamente.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [nfLeituraId, navigation, setSimulacao]);

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
        <View style={styles.content}>
          <Text style={styles.title}>Simulação</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {simulacao && (
            <>
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.muted}>Valor bruto</Text>
                  <Text style={styles.bold}>{formatBRL(simulacao.valorBruto)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.muted}>
                    Deságio ({simulacao.desagioPct.toLocaleString('pt-BR')}%)
                  </Text>
                  <Text style={styles.negative}>- {formatBRL(simulacao.desagio)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.muted}>Taxa administrativa</Text>
                  <Text style={styles.negative}>- {formatBRL(simulacao.taxaAdministrativa)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.bold}>Valor líquido estimado</Text>
                  <Text style={styles.netValue}>{formatBRL(simulacao.valorLiquido)}</Text>
                </View>
              </View>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Previsão de crédito em{' '}
                  <Text style={styles.bold}>{formatDateBR(simulacao.dataCreditoPrevista)}</Text>, na
                  conta ou chave Pix cadastrada.
                </Text>
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.btn}
            onPress={() => navigation.navigate('AdvanceReview')}
            disabled={!simulacao}
            activeOpacity={0.85}>
            <Text style={styles.btnText}>Continuar</Text>
          </TouchableOpacity>
        </View>
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
  card: {backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 16},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  muted: {fontSize: 14, color: '#6b7280'},
  bold: {fontSize: 14, fontWeight: '700', color: '#0F2137'},
  negative: {fontSize: 14, color: '#dc3545'},
  divider: {height: 1, backgroundColor: '#f0f1f3', marginVertical: 4},
  netValue: {fontSize: 18, fontWeight: '800', color: '#16a34a'},
  infoBox: {backgroundColor: '#eef3ff', borderRadius: 10, padding: 14, marginTop: 12},
  infoText: {fontSize: 13, color: '#374151', lineHeight: 19},
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 16},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
});
