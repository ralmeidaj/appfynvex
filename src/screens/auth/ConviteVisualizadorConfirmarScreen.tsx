import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {confirmarConviteVisualizador} from '../../api/convites';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// RF-REP-03/RF-REP-08: código por e-mail (mesmo padrão de recuperação de
// conta), sem leitura facial — esse perfil não passa por biometria. O CPF
// já foi coletado por quem convidou (PerfilConvidarRepresentanteScreen),
// não precisa ser pedido de novo aqui. Sem token no retorno — a pessoa loga
// normalmente depois com CPF + a senha definida aqui.
export function ConviteVisualizadorConfirmarScreen() {
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const valid = /\S+@\S+\.\S+/.test(email) && codigo.length === 6 && senha.length > 0;

  async function handleSubmit() {
    if (!valid) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await confirmarConviteVisualizador(email.trim(), codigo, senha);
      setSucesso(true);
    } catch (e: any) {
      const code = e?.response?.data?.error_code;
      setError(code === 'CODIGO_INVALIDO' ? 'Código incorreto ou expirado.' : 'Não foi possível concluir. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (sucesso) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>✓</Text>
          </View>
          <Text style={styles.title}>Conta ativada!</Text>
          <Text style={styles.subtitle}>Faça login com seu CPF e a senha que você acabou de definir.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('LoginCpf')} activeOpacity={0.85}>
            <Text style={styles.btnText}>Ir para o login</Text>
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
          <Text style={styles.formTitle}>Confirmar convite</Text>
          <Text style={styles.formSubtitle}>
            Informe o e-mail que recebeu o convite, o código de 6 dígitos e defina sua senha.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor="#6b7280"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Código de 6 dígitos"
            placeholderTextColor="#6b7280"
            keyboardType="number-pad"
            maxLength={6}
            value={codigo}
            onChangeText={v => setCodigo(v.replace(/\D/g, ''))}
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
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Confirmar</Text>}
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
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {fontSize: 30, color: '#15803d'},
  title: {fontSize: 19, fontWeight: '800', color: '#0F2137', textAlign: 'center', marginBottom: 8},
  subtitle: {fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 24},
});
