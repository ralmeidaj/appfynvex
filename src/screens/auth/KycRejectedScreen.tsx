import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {reenviarDocumentos} from '../../api/cadastro';
import {useAuthStore} from '../../store/authStore';
import {DocCard} from '../../components/DocCard';

// RF-KYC-04 — cadastro rejeitado: mostra o motivo e permite reenviar os
// documentos corrigidos, sem reiniciar o cadastro do zero e sem precisar
// deslogar/logar de novo (RootNavigator reage à mudança de kycStatus e leva
// direto pra KycPendingScreen depois do reenvio).
export function KycRejectedScreen() {
  const auth = useAuthStore(s => s.auth);
  const setAuth = useAuthStore(s => s.setAuth);
  const logout = useAuthStore(s => s.logout);

  const [contratoSocialAttached, setContratoSocialAttached] = useState(false);
  const [documentoIdentidadeAttached, setDocumentoIdentidadeAttached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = contratoSocialAttached && documentoIdentidadeAttached;

  async function handleReenviar() {
    if (!valid || !auth) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await reenviarDocumentos(auth.empresaId);
      await setAuth({...auth, kycStatus: 'pending', motivoRejeicao: null});
    } catch {
      setError('Não foi possível reenviar os documentos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>⚠️</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Cadastro rejeitado</Text>
          </View>
          <Text style={styles.title}>Seu cadastro precisa de correção</Text>
        </View>

        {auth?.motivoRejeicao && (
          <View style={styles.motivoBox}>
            <Text style={styles.motivoText}>{auth.motivoRejeicao}</Text>
          </View>
        )}

        <Text style={styles.subtitle}>
          Corrija e reenvie os documentos abaixo — não é preciso preencher o cadastro de novo.
        </Text>

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

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, !valid && styles.btnDisabled]}
          onPress={handleReenviar}
          disabled={!valid || loading}
          activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Reenviar documentos</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => logout()}>
          <Text style={styles.link}>Sair</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  content: {paddingHorizontal: 32, paddingVertical: 40},
  header: {alignItems: 'center', marginBottom: 16},
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {fontSize: 30},
  badge: {
    backgroundColor: '#fef2f2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
  },
  badgeText: {color: '#991b1b', fontSize: 12, fontWeight: '700'},
  title: {fontSize: 19, fontWeight: '800', color: '#0F2137', textAlign: 'center'},
  motivoBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 14, marginBottom: 16},
  motivoText: {color: '#991b1b', fontSize: 13, lineHeight: 19},
  subtitle: {fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 20},
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 12},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  link: {color: '#6b7280', fontSize: 14, marginTop: 20, textAlign: 'center'},
});
