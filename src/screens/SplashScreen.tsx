import React from 'react';
import {View, StyleSheet, ActivityIndicator} from 'react-native';
import {Text} from '../components/AppText';
import {FynvexLogo} from '../components/FynvexLogo';

// Só visual — quem decide pra onde ir (Welcome/app) é o RootNavigator
// reagindo ao authStore, não um timer local como no protótipo. Também cobre
// a retomada silenciosa da sessão (RF-AUTH-04a) quando ela precisa de uma
// chamada de rede — não é só leitura local de Keychain/AsyncStorage.
export function SplashScreen() {
  return (
    <View style={styles.container}>
      <FynvexLogo size={88} />
      <Text style={styles.wordmark}>FYNVEX</Text>
      <Text style={styles.tagline}>Antecipação de recebíveis para profissionais de saúde</Text>
      <ActivityIndicator color="#ffffff" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F2137',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  wordmark: {color: '#ffffff', fontSize: 24, fontWeight: '800', letterSpacing: 2, marginTop: 20},
  tagline: {color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 8, maxWidth: 260},
  spinner: {marginTop: 24},
});
