import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {FynvexLogo} from '../../components/FynvexLogo';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function WelcomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <FynvexLogo size={80} />
        <Text style={styles.wordmark}>FYNVEX</Text>
        <Text style={styles.tagline}>Antecipe seus recebíveis com rapidez e segurança</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => navigation.navigate('CadastroCnpjDocs')}
          activeOpacity={0.85}>
          <Text style={styles.btnText}>Novo cadastro</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnOutline}
          onPress={() => navigation.navigate('LoginCpf')}
          activeOpacity={0.85}>
          <Text style={styles.btnOutlineText}>Já sou cadastrado</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Simulador')} activeOpacity={0.7}>
          <Text style={styles.simulatorLink}>Simular sem cadastro</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('ConviteEscolha')} activeOpacity={0.7}>
          <Text style={styles.simulatorLink}>Recebi um convite</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0F2137'},
  content: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32},
  wordmark: {color: '#ffffff', fontSize: 26, fontWeight: '800', letterSpacing: 2, marginTop: 20},
  tagline: {color: '#cbd5e1', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 20},
  actions: {paddingHorizontal: 24, paddingBottom: 40, gap: 12},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  btnOutline: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  btnOutlineText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  simulatorLink: {color: '#cbd5e1', fontSize: 14, textAlign: 'center', marginTop: 4},
});
