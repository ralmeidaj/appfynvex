import React, {useCallback, useState} from 'react';
import {View, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {PerfilStackParamList} from '../../navigation/EmpresaNavigator';
import {useAuthStore} from '../../store/authStore';
import {listarRepresentantes, alterarRepresentante, removerRepresentante, type RepresentanteResumoPerfil} from '../../api/perfil';

type Nav = NativeStackNavigationProp<PerfilStackParamList>;

const STATUS_LABEL: Record<string, string> = {
  convidado: 'Convidado',
  pendente_analise: 'Em análise',
  ativo: 'Ativo',
  rejeitado: 'Rejeitado',
  inativo: 'Inativo',
};

const PERFIL_LABEL: Record<string, string> = {
  representante_legal: 'Representante legal',
  visualizador: 'Visualizador',
};

function ItemSeparator() {
  return <View style={styles.separator} />;
}

// RF-REP-02/04/05/06: qualquer perfil pode ver a lista — só representante_legal
// convida/altera/remove (RN-15/RN-16). Calcula no cliente quem é o único
// representante_legal ativo pra desabilitar essas ações nessa linha antes
// de bater no 409 do backend.
export function PerfilRepresentantesScreen() {
  const navigation = useNavigation<Nav>();
  const isRepresentanteLegal = useAuthStore(s => s.auth?.perfilAcesso === 'representante_legal');
  const [representantes, setRepresentantes] = useState<RepresentanteResumoPerfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listarRepresentantes();
      setRepresentantes(res.data.representantes);
    } catch {
      setRepresentantes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const representantesLegaisAtivos = representantes.filter(
    r => r.perfil_acesso === 'representante_legal' && r.status === 'ativo',
  );

  function isUnicoRepresentanteLegalAtivo(r: RepresentanteResumoPerfil): boolean {
    return r.perfil_acesso === 'representante_legal' && r.status === 'ativo' && representantesLegaisAtivos.length === 1;
  }

  function handleErroAcao(e: any) {
    const code = e?.response?.data?.error_code;
    const message = e?.response?.data?.message;
    if (code === 'ULTIMO_REPRESENTANTE_LEGAL' && message) {
      Alert.alert('Não é possível concluir', message);
    } else {
      Alert.alert('Erro', 'Não foi possível completar a ação. Tente novamente.');
    }
  }

  async function handleTornarVisualizador(r: RepresentanteResumoPerfil) {
    setActingId(r.id);
    try {
      await alterarRepresentante(r.id, {perfilAcesso: 'visualizador'});
      load();
    } catch (e) {
      handleErroAcao(e);
    } finally {
      setActingId(null);
    }
  }

  async function handleTornarRepresentanteLegal(r: RepresentanteResumoPerfil) {
    setActingId(r.id);
    try {
      await alterarRepresentante(r.id, {perfilAcesso: 'representante_legal'});
      load();
    } catch (e) {
      handleErroAcao(e);
    } finally {
      setActingId(null);
    }
  }

  function handleRemover(r: RepresentanteResumoPerfil) {
    Alert.alert('Remover representante', `Remover o acesso de ${r.nome}? A sessão ativa dele é encerrada imediatamente.`, [
      {text: 'Cancelar', style: 'cancel'},
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setActingId(r.id);
          try {
            await removerRepresentante(r.id);
            load();
          } catch (e) {
            handleErroAcao(e);
          } finally {
            setActingId(null);
          }
        },
      },
    ]);
  }

  function renderItem({item}: {item: RepresentanteResumoPerfil}) {
    const disabledPorUnico = isUnicoRepresentanteLegalAtivo(item);
    const acting = actingId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardInfo}>
            <Text style={styles.nome}>{item.nome}</Text>
            <Text style={styles.muted}>{item.cargo}</Text>
            <Text style={styles.muted}>
              {PERFIL_LABEL[item.perfil_acesso]} · {STATUS_LABEL[item.status]}
            </Text>
          </View>
        </View>

        {isRepresentanteLegal && item.status === 'ativo' && (
          <View style={styles.actions}>
            {disabledPorUnico ? (
              <Text style={styles.avisoUnico}>
                Única pessoa com poder de assinar — convide outra antes de remover ou rebaixar.
              </Text>
            ) : acting ? (
              <ActivityIndicator color="#124B9A" />
            ) : (
              <>
                {item.perfil_acesso === 'representante_legal' ? (
                  <TouchableOpacity onPress={() => handleTornarVisualizador(item)}>
                    <Text style={styles.actionLink}>Tornar visualizador</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => handleTornarRepresentanteLegal(item)}>
                    <Text style={styles.actionLink}>Tornar representante legal</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleRemover(item)}>
                  <Text style={styles.removeLink}>Remover</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Representantes</Text>
        <View style={styles.backSpacer} />
      </View>

      {!isRepresentanteLegal && (
        <Text style={styles.readonlyNotice}>
          Somente representantes legais podem convidar ou alterar representantes.
        </Text>
      )}

      {isRepresentanteLegal && (
        <TouchableOpacity
          style={styles.inviteBtn}
          onPress={() => navigation.navigate('PerfilConvidarRepresentante')}
          activeOpacity={0.85}>
          <Text style={styles.inviteBtnText}>+ Convidar representante</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color="#0F2137" style={styles.loadingSpinner} />
      ) : (
        <FlatList
          data={representantes}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={ItemSeparator}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4},
  backText: {color: '#124B9A', fontSize: 15, minWidth: 64},
  backSpacer: {minWidth: 64},
  title: {flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: '#0F2137'},
  readonlyNotice: {fontSize: 13, color: '#6b7280', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, lineHeight: 18},
  inviteBtn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 14, alignItems: 'center', marginHorizontal: 20, marginTop: 12},
  inviteBtnText: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  loadingSpinner: {marginTop: 40},
  listContent: {paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24},
  separator: {height: 10},
  card: {backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14},
  cardTop: {flexDirection: 'row'},
  cardInfo: {flex: 1},
  nome: {fontSize: 15, fontWeight: '700', color: '#0F2137'},
  muted: {fontSize: 12, color: '#6b7280', marginTop: 2},
  actions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 10},
  actionLink: {color: '#124B9A', fontSize: 13, fontWeight: '600'},
  removeLink: {color: '#dc3545', fontSize: 13, fontWeight: '600'},
  avisoUnico: {fontSize: 12, color: '#9ca3af', marginTop: 4, lineHeight: 17, textAlign: 'right'},
});
