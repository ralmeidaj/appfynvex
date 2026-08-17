import React, {useState} from 'react';
import {View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {PerfilStackParamList} from '../../navigation/EmpresaNavigator';
import {convidarRepresentante} from '../../api/perfil';
import type {PerfilAcesso} from '../../types';

type Nav = NativeStackNavigationProp<PerfilStackParamList>;

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

// RF-REP-03: o corpo varia por perfil — representante_legal precisa de
// cargo (aparece na Procuração/nos documentos), visualizador não. CPF é
// comum aos dois (login é sempre CPF+senha, RF-AUTH-01 — sem CPF aqui, o
// visualizador convidado nunca conseguiria logar depois).
export function PerfilConvidarRepresentanteScreen() {
  const navigation = useNavigation<Nav>();
  const [perfilAcesso, setPerfilAcesso] = useState<PerfilAcesso>('representante_legal');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [cargo, setCargo] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cpfClean = cpf.replace(/\D/g, '');
  const valid =
    nome.trim().length > 0 &&
    /^\d{11}$/.test(cpfClean) &&
    /\S+@\S+\.\S+/.test(email) &&
    (perfilAcesso === 'visualizador' || cargo.trim().length > 0);

  async function handleSubmit() {
    if (!valid) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await convidarRepresentante({
        nome: nome.trim(),
        cpf,
        cargo: cargo.trim(),
        email: email.trim(),
        perfilAcesso,
      });
      if (perfilAcesso === 'representante_legal' && res.data.convite_id) {
        navigation.replace('PerfilConviteGerado', {conviteId: res.data.convite_id, nome: nome.trim()});
      } else {
        Alert.alert('Convite enviado', `Enviamos um código de acesso por e-mail para ${email.trim()}.`);
        navigation.goBack();
      }
    } catch {
      setError('Não foi possível enviar o convite. Tente novamente.');
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
        <Text style={styles.title}>Convidar representante</Text>
        <Text style={styles.subtitle}>Quem você quer convidar pra acessar esta empresa no app?</Text>

        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, perfilAcesso === 'representante_legal' && styles.chipSelected]}
            onPress={() => setPerfilAcesso('representante_legal')}
            activeOpacity={0.8}>
            <Text style={[styles.chipText, perfilAcesso === 'representante_legal' && styles.chipTextSelected]}>
              Representante legal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, perfilAcesso === 'visualizador' && styles.chipSelected]}
            onPress={() => setPerfilAcesso('visualizador')}
            activeOpacity={0.8}>
            <Text style={[styles.chipText, perfilAcesso === 'visualizador' && styles.chipTextSelected]}>Visualizador</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.chipHint}>
          {perfilAcesso === 'representante_legal'
            ? 'Pode solicitar/assinar antecipações e convidar outros representantes — passa por revisão da equipe Fynvex.'
            : 'Só acompanha a lista de antecipações — acesso liberado na hora, sem revisão.'}
        </Text>

        <Text style={styles.label}>Nome completo</Text>
        <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Nome do convidado" placeholderTextColor="#9ca3af" />

        <Text style={styles.label}>CPF</Text>
        <TextInput
          style={styles.input}
          value={cpf}
          onChangeText={v => setCpf(formatCpf(v))}
          placeholder="000.000.000-00"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          maxLength={14}
        />

        {perfilAcesso === 'representante_legal' && (
          <>
            <Text style={styles.label}>Cargo</Text>
            <TextInput style={styles.input} value={cargo} onChangeText={setCargo} placeholder="Ex.: Sócio" placeholderTextColor="#9ca3af" />
          </>
        )}

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="email@exemplo.com.br"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
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
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Enviar convite</Text>}
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
  chipRow: {flexDirection: 'row', gap: 10},
  chip: {borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16},
  chipSelected: {backgroundColor: '#124B9A', borderColor: '#124B9A'},
  chipText: {fontSize: 14, fontWeight: '600', color: '#0F2137'},
  chipTextSelected: {color: '#ffffff'},
  chipHint: {fontSize: 12, color: '#6b7280', lineHeight: 17, marginTop: 8, marginBottom: 16},
  label: {fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12},
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 16},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
});
