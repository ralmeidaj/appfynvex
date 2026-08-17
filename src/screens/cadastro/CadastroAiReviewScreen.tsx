import React, {useState} from 'react';
import {View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {confirmarDados} from '../../api/cadastro';
import {useCadastroStore} from '../../store/cadastroStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function EditableField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.fieldInput} value={value} onChangeText={onChangeText} />
    </View>
  );
}

// RF-CAD-07: os dados extraídos pela IA são editáveis — o usuário pode
// corrigir qualquer campo identificado incorretamente antes de confirmar.
export function CadastroAiReviewScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cadastroId = useCadastroStore(s => s.cadastroId);
  const cnpj = useCadastroStore(s => s.cnpj);
  const dadosExtraidos = useCadastroStore(s => s.dadosExtraidos);
  const setDadosExtraidos = useCadastroStore(s => s.setDadosExtraidos);
  const setRepresentante = useCadastroStore(s => s.setRepresentante);
  const setSenhaCadastro = useCadastroStore(s => s.setSenha);

  const [razaoSocial, setRazaoSocial] = useState(dadosExtraidos?.razaoSocial ?? '');
  const [nomeFantasia, setNomeFantasia] = useState(dadosExtraidos?.nomeFantasia ?? '');
  const [endereco, setEndereco] = useState(dadosExtraidos?.endereco ?? '');
  const [responsavelNome, setResponsavelNome] = useState(dadosExtraidos?.responsavelNome ?? '');
  const [responsavelCpf, setResponsavelCpf] = useState(dadosExtraidos?.responsavelCpf ?? '');
  const [responsavelCargo, setResponsavelCargo] = useState(dadosExtraidos?.responsavelCargo ?? '');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // RF-AUTH-01/RF-KYC-05: a senha de login é criada aqui, uma única vez —
  // não há tela de login separada pedindo pra criar senha depois.
  const senhaValida = senha.length > 0 && senha === confirmarSenha;

  async function handleConfirm() {
    if (!cadastroId || !senhaValida) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await confirmarDados(
        cadastroId,
        {
          razao_social: razaoSocial,
          nome_fantasia: nomeFantasia,
          endereco,
          responsavel_legal: {nome: responsavelNome, cpf: responsavelCpf, cargo: responsavelCargo},
        },
        senha,
      );
      setRepresentante(res.data.representante_id, responsavelNome);
      setSenhaCadastro(senha);
      setDadosExtraidos({
        razaoSocial,
        nomeFantasia,
        endereco,
        responsavelNome,
        responsavelCpf,
        responsavelCargo,
      });
      navigation.navigate('CadastroFacialEnroll');
    } catch {
      setError('Não foi possível confirmar os dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Dados identificados</Text>
        <Text style={styles.subtitle}>
          Confira e corrija, se precisar, os dados que nossa IA encontrou no Contrato Social
          enviado.
        </Text>

        <View style={styles.card}>
          <EditableField label="Razão social" value={razaoSocial} onChangeText={setRazaoSocial} />
          <View style={styles.divider} />
          <EditableField label="Nome fantasia" value={nomeFantasia} onChangeText={setNomeFantasia} />
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>CNPJ</Text>
            <Text style={styles.fieldReadOnly}>{cnpj}</Text>
          </View>
          <View style={styles.divider} />
          <EditableField label="Endereço" value={endereco} onChangeText={setEndereco} />
          <View style={styles.divider} />
          <EditableField label="Responsável — nome" value={responsavelNome} onChangeText={setResponsavelNome} />
          <View style={styles.divider} />
          <EditableField label="Responsável — CPF" value={responsavelCpf} onChangeText={setResponsavelCpf} />
          <View style={styles.divider} />
          <EditableField label="Responsável — cargo" value={responsavelCargo} onChangeText={setResponsavelCargo} />
        </View>

        <Text style={styles.sectionTitle}>Crie sua senha de acesso</Text>
        <Text style={styles.subtitle}>
          Você vai usar CPF + esta senha para entrar no app depois — não é preciso criar senha de
          novo mais tarde.
        </Text>
        <View style={[styles.card, styles.cardSpaced]}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Senha</Text>
            <TextInput
              style={styles.fieldInput}
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              placeholder="Sua senha"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Confirmar senha</Text>
            <TextInput
              style={styles.fieldInput}
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              secureTextEntry
              placeholder="Repita a senha"
            />
          </View>
        </View>
        {confirmarSenha.length > 0 && senha !== confirmarSenha && (
          <Text style={styles.senhaMismatch}>As senhas não coincidem.</Text>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, !senhaValida && styles.btnDisabled]}
          onPress={handleConfirm}
          disabled={loading || !senhaValida}
          activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Confirmar e continuar</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  back: {padding: 20},
  backText: {color: '#124B9A', fontSize: 15},
  content: {paddingHorizontal: 24, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '800', color: '#0F2137', marginBottom: 8},
  subtitle: {fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 16},
  card: {backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 16},
  cardSpaced: {marginTop: 8},
  sectionTitle: {fontSize: 16, fontWeight: '800', color: '#0F2137', marginTop: 24, marginBottom: 6},
  field: {paddingVertical: 4},
  fieldLabel: {fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4},
  fieldInput: {fontSize: 15, color: '#111827', marginTop: 4, fontWeight: '600', paddingVertical: 4},
  fieldReadOnly: {fontSize: 15, color: '#6b7280', marginTop: 4, fontWeight: '600'},
  divider: {height: 1, backgroundColor: '#f0f1f3', marginVertical: 6},
  senhaMismatch: {color: '#dc3545', fontSize: 12, marginTop: 6},
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 16},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
});
