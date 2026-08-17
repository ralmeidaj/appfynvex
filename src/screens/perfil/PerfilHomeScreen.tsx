import React, {useCallback, useState} from 'react';
import {View, TouchableOpacity, StyleSheet, ActivityIndicator} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {PerfilStackParamList} from '../../navigation/EmpresaNavigator';
import {useAuthStore} from '../../store/authStore';
import {getPerfil, type PerfilResponse} from '../../api/perfil';

type Nav = NativeStackNavigationProp<PerfilStackParamList>;

// RF-CAD-01a: CNPJ pode ser alfanumérico — a máscara só pontua por posição,
// não depende de dígito x letra.
function maskCnpj(cnpj: string): string {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

const PERFIL_ACESSO_LABEL: Record<string, string> = {
  representante_legal: 'Representante legal',
  visualizador: 'Visualizador',
};

const VINCULO_LABEL: Record<string, string> = {
  nao_vinculado: 'Sem vínculo de parceiro',
  pendente: 'Vínculo pendente de confirmação',
  confirmado: 'Vínculo confirmado',
};

// RF-PERF-01/04/05: dados da empresa + representante logado, e as entradas
// pro resto do Perfil. "Gerenciar representantes" aparece pros dois perfis
// (GET /perfil/representantes é aberto a qualquer perfil ativo, RF-REP-02) —
// só as AÇÕES dentro daquela tela ficam restritas a representante_legal.
export function PerfilHomeScreen() {
  const navigation = useNavigation<Nav>();
  const authPerfilAcesso = useAuthStore(s => s.auth?.perfilAcesso);
  const logout = useAuthStore(s => s.logout);
  const [perfil, setPerfil] = useState<PerfilResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getPerfil()
        .then(res => {
          if (active) {
            setPerfil(res.data);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const isRepresentanteLegal = authPerfilAcesso === 'representante_legal';

  if (loading || !perfil) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#0F2137" style={styles.loadingSpinner} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Perfil</Text>
        <Text style={styles.subtitle}>Seus dados cadastrais</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.companyName}>{perfil.nome_fantasia}</Text>
          <Text style={styles.muted}>CNPJ {maskCnpj(perfil.cnpj)}</Text>
          <Text style={styles.muted}>{VINCULO_LABEL[perfil.vinculo_parceiro.status]}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Representante logado</Text>
          <Text style={styles.fieldValue}>{perfil.representante_logado.nome}</Text>
          <Text style={styles.muted}>
            {perfil.representante_logado.cargo} ·{' '}
            {PERFIL_ACESSO_LABEL[perfil.representante_logado.perfil_acesso]}
          </Text>
        </View>

        {isRepresentanteLegal && (
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => navigation.navigate('PerfilDadosBancarios')}
            activeOpacity={0.7}>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Meus dados bancários</Text>
              <Text style={styles.actionSubtitle}>Conta e chave Pix para receber antecipações</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => navigation.navigate('PerfilRepresentantes')}
          activeOpacity={0.7}>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Gerenciar representantes</Text>
            <Text style={styles.actionSubtitle}>Quem tem acesso a esta empresa no app</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => navigation.navigate('PerfilHistoricoTermos')}
          activeOpacity={0.7}>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Termos e contratos assinados</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => navigation.navigate('PerfilSuporte')}
          activeOpacity={0.7}>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Suporte</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => logout()} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  loadingSpinner: {flex: 1},
  header: {paddingHorizontal: 20, paddingTop: 12},
  title: {fontSize: 19, fontWeight: '800', color: '#0F2137'},
  subtitle: {fontSize: 13, color: '#6b7280', marginTop: 2},
  content: {flex: 1, paddingHorizontal: 20, paddingTop: 16},
  card: {backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 12},
  companyName: {fontSize: 16, fontWeight: '700', color: '#0F2137'},
  muted: {fontSize: 12, color: '#6b7280', marginTop: 3},
  fieldLabel: {fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4},
  fieldValue: {fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 2},
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 10,
  },
  actionInfo: {flex: 1},
  actionTitle: {fontSize: 14, fontWeight: '600', color: '#0F2137'},
  actionSubtitle: {fontSize: 12, color: '#6b7280', marginTop: 2},
  chevron: {fontSize: 20, color: '#9ca3af'},
  logoutBtn: {borderWidth: 1.5, borderColor: '#dc3545', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 12},
  logoutText: {color: '#dc3545', fontSize: 15, fontWeight: '700'},
});
