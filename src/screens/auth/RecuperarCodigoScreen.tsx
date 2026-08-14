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
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {confirmarRecuperacao} from '../../api/auth';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'RecuperarCodigo'>;

// RF-AUTH-08: código de verificação (2º fator, mesmo peso que a leitura
// facial) + nova senha. Em caso de sucesso, segue para a leitura facial —
// não repete a revisão de documento/KYC, só restabelece a credencial.
export function RecuperarCodigoScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {cpf, email} = route.params;
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = codigo.length === 6 && novaSenha.length > 0;

  async function handleSubmit() {
    if (!valid) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await confirmarRecuperacao(cpf, email, codigo, novaSenha);
      navigation.navigate('RecuperarFacial', {representanteId: res.data.representante_id, cpf, novaSenha});
    } catch (e: any) {
      const code = e?.response?.data?.error_code;
      setError(
        code === 'CODIGO_INVALIDO' ? 'Código incorreto ou expirado.' : 'Não foi possível concluir a recuperação.',
      );
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
          <Text style={styles.title}>Confirme o código</Text>
          <Text style={styles.subtitle}>Enviamos um código de 6 dígitos para {email}. Informe-o abaixo e defina uma nova senha.</Text>

          <TextInput
            style={styles.input}
            placeholder="Código de 6 dígitos"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            maxLength={6}
            value={codigo}
            onChangeText={v => setCodigo(v.replace(/\D/g, ''))}
          />
          <TextInput
            style={styles.input}
            placeholder="Nova senha"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={novaSenha}
            onChangeText={setNovaSenha}
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
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 14},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
});
