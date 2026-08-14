import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Clipboard} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {PerfilStackParamList} from '../../navigation/EmpresaNavigator';

type Nav = NativeStackNavigationProp<PerfilStackParamList>;
type Route = RouteProp<PerfilStackParamList, 'PerfilConviteGerado'>;

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

// RF-REP-03: não há deep link automático — quem convidou precisa
// compartilhar este código por fora do app (WhatsApp, etc.).
export function PerfilConviteGeradoScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {conviteId, nome} = route.params;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>✓</Text>
        </View>
        <Text style={styles.title}>Convite criado</Text>
        <Text style={styles.subtitle}>
          Compartilhe este código com {nome} — ele vai usá-lo pra definir a senha, enviar seus
          documentos e concluir o próprio ingresso.
        </Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{conviteId}</Text>
        </View>
        <CopyButton value={conviteId} label="Copiar código" />

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Depois que {nome} concluir o ingresso, o acesso ainda passa pela revisão da equipe
            Fynvex antes de ficar ativo.
          </Text>
        </View>

        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('PerfilRepresentantes')} activeOpacity={0.85}>
          <Text style={styles.btnText}>Voltar para representantes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  content: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32},
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {fontSize: 28, color: '#15803d'},
  title: {fontSize: 20, fontWeight: '800', color: '#0F2137', textAlign: 'center', marginBottom: 8},
  subtitle: {fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 24},
  codeBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#124B9A',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  codeText: {fontSize: 26, fontWeight: '800', color: '#124B9A', letterSpacing: 2},
  copyBtn: {borderWidth: 1.5, borderColor: '#124B9A', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20},
  copyBtnDone: {borderColor: '#15803d', backgroundColor: '#dcfce7'},
  copyBtnText: {color: '#124B9A', fontSize: 14, fontWeight: '700'},
  copyBtnTextDone: {color: '#15803d'},
  infoBox: {backgroundColor: '#eff6ff', borderRadius: 10, padding: 14, marginTop: 24},
  infoText: {fontSize: 12, color: '#1e40af', lineHeight: 18, textAlign: 'center'},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, marginTop: 24, width: '100%', alignItems: 'center'},
  btnText: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
});
