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
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {iniciarCadastro} from '../../api/cadastro';
import {useCadastroStore} from '../../store/cadastroStore';
import {DocCard} from '../../components/DocCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function CadastroCnpjDocsScreen() {
  const navigation = useNavigation<Nav>();
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contratoSocialAttached = useCadastroStore(s => s.contratoSocialAttached);
  const documentoIdentidadeAttached = useCadastroStore(s => s.documentoIdentidadeAttached);
  const procuracaoAttached = useCadastroStore(s => s.procuracaoAttached);
  const parceiroCodigo = useCadastroStore(s => s.parceiroCodigo);
  const setContratoSocialAttached = useCadastroStore(s => s.setContratoSocialAttached);
  const setDocumentoIdentidadeAttached = useCadastroStore(s => s.setDocumentoIdentidadeAttached);
  const setProcuracaoAttached = useCadastroStore(s => s.setProcuracaoAttached);
  const setParceiroCodigo = useCadastroStore(s => s.setParceiroCodigo);
  const setCnpjStore = useCadastroStore(s => s.setCnpj);
  const setCadastroId = useCadastroStore(s => s.setCadastroId);

  const cnpjDigits = cnpj.replace(/\D/g, '');
  const valid = cnpjDigits.length === 14 && contratoSocialAttached && documentoIdentidadeAttached;

  async function handleSubmit() {
    if (!valid) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await iniciarCadastro(cnpjDigits, parceiroCodigo.trim() || undefined);
      setCnpjStore(cnpjDigits);
      setCadastroId(res.data.cadastro_id);
      navigation.navigate('CadastroAiExtract');
    } catch {
      setError('Não foi possível enviar seu cadastro. Verifique sua conexão e tente novamente.');
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Novo cadastro</Text>
          <Text style={styles.subtitle}>
            Informe o CNPJ e envie o Contrato Social. Nossa IA lê o documento e identifica os
            dados da empresa automaticamente.
          </Text>

          <Text style={styles.label}>CNPJ</Text>
          <TextInput
            style={styles.input}
            placeholder="00.000.000/0000-00"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            value={cnpj}
            onChangeText={v => setCnpj(formatCnpj(v))}
            maxLength={18}
          />

          <Text style={[styles.label, styles.docsLabel]}>Documentos</Text>
          <DocCard
            title="Contrato Social"
            required
            attached={contratoSocialAttached}
            hint="Nossa IA lê o arquivo e identifica os dados da empresa"
            onToggle={() => setContratoSocialAttached(!contratoSocialAttached)}
          />
          <DocCard
            title="Documento de identidade do responsável (RG ou CNH)"
            required
            attached={documentoIdentidadeAttached}
            hint="Foto ou digitalização, com o rosto e os dados legíveis"
            onToggle={() => setDocumentoIdentidadeAttached(!documentoIdentidadeAttached)}
          />
          <DocCard
            title="Procuração"
            required={false}
            attached={procuracaoAttached}
            hint="Apenas se a assinatura da empresa for por procuração"
            onToggle={() => setProcuracaoAttached(!procuracaoAttached)}
          />

          <Text style={[styles.label, styles.docsLabel]}>Parceiro (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Código do parceiro/convênio, se houver"
            placeholderTextColor="#9ca3af"
            value={parceiroCodigo}
            onChangeText={setParceiroCodigo}
            autoCapitalize="characters"
          />
          <Text style={styles.hint}>
            Se sua empresa é vinculada ao Departamento de Convênios da ABM ou a outro parceiro,
            informe o código aqui. Deixe em branco se não se aplica.
          </Text>

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
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.btnText}>Enviar para análise</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  kav: {flex: 1},
  back: {padding: 20},
  backText: {color: '#124B9A', fontSize: 15},
  content: {paddingHorizontal: 24, paddingBottom: 40},
  title: {fontSize: 26, fontWeight: '800', color: '#0F2137', marginBottom: 10},
  subtitle: {fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 20},
  label: {fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6},
  docsLabel: {marginTop: 20, marginBottom: 8},
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#111827',
  },
  hint: {fontSize: 12, color: '#9ca3af', marginTop: 6, lineHeight: 17},
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 16},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
});
