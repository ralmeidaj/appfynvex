import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuthStore} from '../../store/authStore';

// RF-KYC-01 — sem polling: a atualização de status chega por push quando
// existir (RF-KYC-03); por ora, o usuário só reabre o app depois.
export function KycPendingScreen() {
  const logout = useAuthStore(s => s.logout);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>⏳</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Em análise</Text>
        </View>
        <Text style={styles.title}>
          Seus documentos estão sendo analisados pela equipe administrativa
        </Text>
        <Text style={styles.subtitle}>
          Isso costuma levar até 2 dias úteis. Assim que aprovado, seu acesso é liberado
          automaticamente na próxima vez que você abrir o app.
        </Text>
        <TouchableOpacity onPress={() => logout()}>
          <Text style={styles.link}>Sair</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  content: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32},
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {fontSize: 30},
  badge: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
  },
  badgeText: {color: '#92400e', fontSize: 12, fontWeight: '700'},
  title: {fontSize: 19, fontWeight: '800', color: '#0F2137', textAlign: 'center', marginBottom: 10},
  subtitle: {fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 24},
  link: {color: '#6b7280', fontSize: 14},
});
