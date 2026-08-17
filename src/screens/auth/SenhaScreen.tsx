import React, {useState} from 'react';
import {View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {login} from '../../api/auth';
import {saveSenhaToKeychain} from '../../hooks/useAuth';
import {useAuthStore} from '../../store/authStore';
import type {EmpresaAuthState} from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Senha'>;

// RF-AUTH-01/03: login por CPF + senha só — chama o token direto, sem
// nenhuma sessão de leitura facial (RF-BIO-03). Um login bem-sucedido não
// envolve leitura facial nenhuma.
export function SenhaScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {cpf} = route.params;
  const setAuth = useAuthStore(s => s.setAuth);
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = senha.length > 0;

  async function handleSubmit() {
    if (!valid) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await login(cpf, senha);
      const {access_token, expires_in, empresa, representante} = res.data;
      const auth: EmpresaAuthState = {
        sessionToken: access_token,
        expiresAt: new Date(Date.now() + expires_in * 1000).toISOString(),
        empresaId: empresa.id,
        nomeFantasia: empresa.nome_fantasia,
        cnpj: empresa.cnpj,
        cpf,
        kycStatus: empresa.kyc_status,
        motivoRejeicao: empresa.motivo_rejeicao ?? null,
        representanteId: representante.id,
        representanteNome: representante.nome,
        perfilAcesso: representante.perfil_acesso as EmpresaAuthState['perfilAcesso'],
      };
      await setAuth(auth);
      // RF-AUTH-04a: primeiro login bem-sucedido salva a senha — logins
      // seguintes no dispositivo entram sem pedir nada ao usuário.
      await saveSenhaToKeychain(cpf, senha);
      // RootNavigator reage à mudança de `auth`.
    } catch {
      // Mensagem genérica deliberada — não diferencia CPF errado de senha errada.
      setError('CPF ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Voltar</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Sua senha</Text>
          <Text style={styles.subtitle}>Informe a senha do seu acesso.</Text>

          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={senha}
            onChangeText={v => {
              setError(null);
              setSenha(v);
            }}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
            autoFocus
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

          <TouchableOpacity onPress={() => navigation.navigate('RecuperarConta')}>
            <Text style={styles.link}>Perdi meu acesso</Text>
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
    fontSize: 18,
    color: '#111827',
    marginBottom: 12,
  },
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 14},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center'},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  link: {color: '#124B9A', fontSize: 14, textAlign: 'center', marginTop: 20},
});
