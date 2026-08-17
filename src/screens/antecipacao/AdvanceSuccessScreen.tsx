import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {InicioStackParamList} from '../../navigation/EmpresaNavigator';
import {useAntecipacaoStore} from '../../store/antecipacaoStore';
import {formatBRL, formatDateBR} from '../../utils/format';

type Nav = NativeStackNavigationProp<InicioStackParamList>;

// RF-ANT-08 — solicitação criada com status inicial `solicitada`.
export function AdvanceSuccessScreen() {
  const navigation = useNavigation<Nav>();
  const simulacao = useAntecipacaoStore(s => s.simulacao);
  const reset = useAntecipacaoStore(s => s.reset);

  function handleDone() {
    reset();
    navigation.navigate('Home');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>✓</Text>
        </View>
        <Text style={styles.title}>Antecipação solicitada!</Text>
        <Text style={styles.subtitle}>Sua solicitação foi enviada para análise da equipe Fynvex.</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Valor líquido estimado</Text>
          <Text style={styles.heroValue}>{simulacao ? formatBRL(simulacao.valorLiquido) : '—'}</Text>
          <Text style={styles.muted}>
            Crédito previsto para{' '}
            <Text style={styles.bold}>{simulacao ? formatDateBR(simulacao.dataCreditoPrevista) : '—'}</Text>
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Solicitada</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleDone} activeOpacity={0.85}>
          <Text style={styles.btnText}>Voltar para o início</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  content: {flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 32},
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {fontSize: 30, color: '#16a34a', fontWeight: '800'},
  title: {fontSize: 20, fontWeight: '800', color: '#0F2137', textAlign: 'center', marginBottom: 8},
  subtitle: {fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20},
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 20,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  cardLabel: {fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4},
  heroValue: {fontSize: 26, fontWeight: '800', color: '#16a34a', marginTop: 6},
  muted: {fontSize: 13, color: '#6b7280', marginTop: 8},
  bold: {fontWeight: '700', color: '#0F2137'},
  badge: {backgroundColor: '#eef3ff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10},
  badgeText: {fontSize: 12, fontWeight: '700', color: '#124B9A'},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, width: '100%'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
});
