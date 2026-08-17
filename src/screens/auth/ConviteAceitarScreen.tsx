import React, {useState} from 'react';
import {View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {aceitarConvite} from '../../api/convites';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// RF-REP-03: aceite do convite de representante_legal — só até onde o mock
// já vai (senha). Leitura facial + documento de identidade + Procuração
// (RF-BIO-01/09) ficam pra uma rodada futura — o mock já tem os endpoints
// de facial prontos (mockIniciarLeituraFacialConvite/mockConfirmarLeitura-
// FacialConvite), mas nenhuma tela os consome ainda. Sem eles, o fluxo já
// fica completo até "pendente de análise", que é o que a equipe Fynvex
// revisa antes de liberar (mesmo gate de RF-KYC-02).
export function ConviteAceitarScreen() {
  const navigation = useNavigation<Nav>();
  const [conviteId, setConviteId] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const valid = conviteId.trim().length > 0 && senha.length > 0;

  async function handleSubmit() {
    if (!valid) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await aceitarConvite(conviteId.trim().toUpperCase(), senha);
      setSucesso(true);
    } catch (e: any) {
      const code = e?.response?.data?.error_code;
      setError(
        code === 'CONVITE_NAO_ENCONTRADO'
          ? 'Código de convite inválido ou já utilizado.'
          : 'Não foi possível concluir. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (sucesso) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>⏳</Text>
          </View>
          <Text style={styles.title}>Aguardando análise</Text>
          <Text style={styles.subtitle}>
            Sua senha foi definida. Seu acesso como representante legal ainda passa pela revisão
            da equipe Fynvex antes de ficar liberado — isso costuma levar até 2 dias úteis.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Welcome')} activeOpacity={0.85}>
            <Text style={styles.btnText}>Voltar ao início</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Voltar</Text>
        </TouchableOpacity>

        <View style={styles.formContent}>
          <Text style={styles.formTitle}>Aceitar convite</Text>
          <Text style={styles.formSubtitle}>Informe o código de convite que você recebeu e defina sua senha.</Text>

          <TextInput
            style={styles.input}
            placeholder="Código de convite"
            placeholderTextColor="#6b7280"
            autoCapitalize="characters"
            value={conviteId}
            onChangeText={v => setConviteId(v.toUpperCase())}
          />
          <TextInput
            style={styles.input}
            placeholder="Defina sua senha"
            placeholderTextColor="#6b7280"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
          />

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, !valid && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!valid || loading}
            activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Continuar</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  kav: {flex: 1},
  back: {padding: 20},
  backText: {color: '#124B9A', fontSize: 15},
  formContent: {flex: 1, paddingHorizontal: 24, paddingTop: 8},
  formTitle: {fontSize: 26, fontWeight: '800', color: '#0F2137', marginBottom: 10},
  formSubtitle: {fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 24},
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 14},
  errorText: {color: '#b91c1c', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
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
  title: {fontSize: 19, fontWeight: '800', color: '#0F2137', textAlign: 'center', marginBottom: 8},
  subtitle: {fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 24},
});
