import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// RF-REP-03: os dois fluxos de convite são bem diferentes (representante
// legal precisa de convite_id + revisão; visualizador é só código por
// e-mail, ativa na hora) — por isso a escolha explícita aqui, antes de
// pedir qualquer dado.
export function ConviteEscolhaScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.title}>Recebi um convite</Text>
        <Text style={styles.subtitle}>Qual tipo de convite você recebeu?</Text>

        <TouchableOpacity style={styles.optionCard} onPress={() => navigation.navigate('ConviteAceitar')} activeOpacity={0.8}>
          <Text style={styles.optionTitle}>Representante legal</Text>
          <Text style={styles.optionSubtitle}>Recebi um código de convite pra assinar antecipações por esta empresa.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => navigation.navigate('ConviteVisualizadorConfirmar')}
          activeOpacity={0.8}>
          <Text style={styles.optionTitle}>Visualizador</Text>
          <Text style={styles.optionSubtitle}>Recebi um código por e-mail pra só acompanhar as antecipações.</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  back: {padding: 20},
  backText: {color: '#124B9A', fontSize: 15},
  content: {flex: 1, paddingHorizontal: 24, paddingTop: 8},
  title: {fontSize: 26, fontWeight: '800', color: '#0F2137', marginBottom: 10},
  subtitle: {fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 24},
  optionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  optionTitle: {fontSize: 16, fontWeight: '700', color: '#0F2137', marginBottom: 4},
  optionSubtitle: {fontSize: 13, color: '#6b7280', lineHeight: 18},
});
