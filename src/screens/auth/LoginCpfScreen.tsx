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
import {checkCpf} from '../../api/auth';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// RF-AUTH-01: CPF é sempre só numérico (sem variante alfanumérica, diferente
// do CNPJ da empresa — RF-CAD-01a) — máscara mais simples.
function formatCpf(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 11);
  if (clean.length <= 3) {
    return clean;
  }
  if (clean.length <= 6) {
    return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  }
  if (clean.length <= 9) {
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  }
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

export function LoginCpfScreen() {
  const navigation = useNavigation<Nav>();
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cpfClean = cpf.replace(/\D/g, '');
  const valid = /^\d{11}$/.test(cpfClean);

  function handleChange(v: string) {
    setError(null);
    setCpf(formatCpf(v));
  }

  async function handleSubmit() {
    if (!valid) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await checkCpf(cpf);
      const {possui_cadastro, kyc_status} = res.data;

      // RF-AUTH-05: nenhum cadastro encontrado para este CPF — não avança
      // pra tela de senha, oferece o caminho de "Novo cadastro".
      if (!possui_cadastro || kyc_status === 'none') {
        setError('Nenhum cadastro encontrado para este CPF. Procure "Novo cadastro" na tela anterior.');
        return;
      }

      // RF-AUTH-06 (empresa pendente/reprovada) é decidido depois do login em
      // si, a partir do `kyc_status` da sessão — aqui só confirma que existe
      // representante ativo pra pedir a senha.
      navigation.navigate('Senha', {cpf});
    } catch {
      setError('Não foi possível verificar o CPF. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Voltar">
          <Text style={styles.backText}>‹ Voltar</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Entrar</Text>
          <Text style={styles.subtitle}>Informe seu CPF. Em seguida, pedimos sua senha.</Text>

          <TextInput
            style={[styles.input, valid && !error && styles.inputValid, error && styles.inputError]}
            placeholder="000.000.000-00"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
            autoCorrect={false}
            value={cpf}
            onChangeText={handleChange}
            maxLength={14}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
            accessibilityLabel="CPF"
          />

          {error && (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, !valid && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!valid || loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continuar"
            accessibilityState={{disabled: !valid || loading, busy: loading}}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Continuar</Text>}
          </TouchableOpacity>

          <Text style={styles.hint}>O acesso é feito por CPF e senha.</Text>
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
  content: {flex: 1, paddingHorizontal: 24, paddingTop: 8},
  title: {fontSize: 26, fontWeight: '800', color: '#0F2137', marginBottom: 10},
  subtitle: {fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 28},
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    letterSpacing: 1,
    color: '#111827',
    marginBottom: 12,
  },
  inputValid: {borderColor: '#124B9A'},
  inputError: {borderColor: '#b91c1c'},
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 14},
  errorText: {color: '#b91c1c', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center'},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  hint: {color: '#6b7280', fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18},
});
