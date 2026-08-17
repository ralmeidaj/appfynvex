import React, {useEffect, useState} from 'react';
import {View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {getContratoMae} from '../../api/antecipacoes';
import {formatDateBR} from '../../utils/format';

// RF-PERF-05: histórico de termos/contratos assinados. Termo de Uso é
// sempre aceito no cadastro (RF-CAD-09) — não há data guardada pra ele hoje,
// só o Contrato-Mãe tem um endpoint com data (`GET /contrato-mae`). Termos
// de Cessão por operação (um por antecipação) ficam fora desta tela — cada
// antecipação já mostra o próprio na revisão dela.
export function PerfilHistoricoTermosScreen() {
  const navigation = useNavigation();
  const [assinadoEm, setAssinadoEm] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getContratoMae()
      .then(res => setAssinadoEm(res.data.assinado_em))
      .catch(() => setAssinadoEm(null));
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Termos e contratos</Text>

        <View style={styles.card}>
          <Text style={styles.itemTitle}>Termo de Uso e Política de Privacidade</Text>
          <Text style={styles.itemStatus}>Aceito no cadastro</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.itemTitle}>Contrato-Mãe</Text>
          {assinadoEm === undefined ? (
            <ActivityIndicator color="#124B9A" style={styles.spinner} />
          ) : assinadoEm ? (
            <Text style={styles.itemStatus}>Assinado em {formatDateBR(assinadoEm)}</Text>
          ) : (
            <Text style={styles.itemStatusPending}>Ainda não assinado</Text>
          )}
        </View>

        <Text style={styles.note}>
          O Termo de Cessão de cada antecipação fica disponível na revisão daquela solicitação
          específica.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  back: {padding: 20},
  backText: {color: '#124B9A', fontSize: 15},
  content: {paddingHorizontal: 24, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '800', color: '#0F2137', marginBottom: 20},
  card: {backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 12},
  itemTitle: {fontSize: 14, fontWeight: '700', color: '#0F2137'},
  itemStatus: {fontSize: 12, color: '#15803d', marginTop: 4, fontWeight: '600'},
  itemStatusPending: {fontSize: 12, color: '#6b7280', marginTop: 4},
  spinner: {alignSelf: 'flex-start', marginTop: 6},
  note: {fontSize: 12, color: '#6b7280', lineHeight: 18, marginTop: 8},
});
