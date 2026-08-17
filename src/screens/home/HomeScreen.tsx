import React, {useCallback, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {InicioStackParamList} from '../../navigation/EmpresaNavigator';
import {useAuthStore} from '../../store/authStore';
import {listAntecipacoes, cancelarAntecipacao, getContratoMae, type AntecipacaoListItem} from '../../api/antecipacoes';
import {formatBRL, formatDateBR} from '../../utils/format';
import type {AntecipacaoStatus} from '../../types';

type Nav = NativeStackNavigationProp<InicioStackParamList>;

const STATUS_BADGE: Record<AntecipacaoStatus, {bg: string; text: string; label: string}> = {
  // RF-TER-03: só ocorre para antecipação de terceiro (origem !== 'self') —
  // a própria Home decide se mostra badge ou ação de aprovar/recusar.
  aguardando_assinatura: {bg: '#ede9fe', text: '#6d28d9', label: 'Aguardando assinatura'},
  solicitada: {bg: '#eef3ff', text: '#124B9A', label: 'Solicitada'},
  em_analise: {bg: '#fef3c7', text: '#92400e', label: 'Em análise'},
  aprovada: {bg: '#dbeafe', text: '#1e40af', label: 'Aprovada'},
  recusada: {bg: '#fee2e2', text: '#991b1b', label: 'Recusada'},
  credito_efetuado: {bg: '#dcfce7', text: '#15803d', label: 'Crédito efetuado'},
  aguardando_liquidacao: {bg: '#fef3c7', text: '#92400e', label: 'Aguardando liquidação'},
  liquidada: {bg: '#dcfce7', text: '#15803d', label: 'Liquidada'},
  em_atraso: {bg: '#fee2e2', text: '#991b1b', label: 'Em atraso'},
  cancelada: {bg: '#f1f5f9', text: '#64748b', label: 'Cancelada'},
};

function ItemSeparator() {
  return <View style={styles.separator} />;
}

// RF-HOME — lista de solicitações da empresa autenticada, mais recentes
// primeiro. "+ Nova solicitação" passa primeiro pelo Contrato-Mãe se ainda
// não assinado (RF-MAE-01), consultado de novo a cada vez (RN-09).
export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const auth = useAuthStore(s => s.auth);

  const [items, setItems] = useState<AntecipacaoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingMae, setCheckingMae] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAntecipacoes();
      setItems(res.data.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleNewRequest() {
    setCheckingMae(true);
    try {
      const res = await getContratoMae();
      navigation.navigate(res.data.status === 'assinado' ? 'AdvanceNew' : 'AdvanceMaeContract');
    } catch {
      Alert.alert('Erro', 'Não foi possível verificar o Contrato-Mãe. Tente novamente.');
    } finally {
      setCheckingMae(false);
    }
  }

  async function handleCancel(id: number) {
    try {
      await cancelarAntecipacao(id);
      load();
    } catch {
      Alert.alert('Erro', 'Esta solicitação não pode mais ser cancelada.');
      load();
    }
  }

  function handleViewCreditoComprovante(item: AntecipacaoListItem) {
    Alert.alert(
      'Crédito efetuado',
      `${formatBRL(item.valor_liquido)} líquidos da NF ${item.nf_numero} foram creditados na sua conta/Pix cadastrada em ${formatDateBR(item.data_credito)}.`,
    );
  }

  function handleOpenPayment(item: AntecipacaoListItem) {
    navigation.navigate('AdvancePayment', {antecipacaoId: item.id, nfNumero: item.nf_numero});
  }

  function renderItem({item}: {item: AntecipacaoListItem}) {
    const badge = STATUS_BADGE[item.status];
    // RF-HOME-04: aguardando_liquidacao/em_atraso/liquidada abrem a tela de
    // liquidação (ela mesma decide mostrar QR/código ou aviso de confirmado,
    // conforme o vínculo de parceiro — RF-PAG-01).
    const canOpenLiquidacao =
      item.status === 'aguardando_liquidacao' || item.status === 'em_atraso' || item.status === 'liquidada';
    const canCancel = item.status === 'solicitada' || item.status === 'em_analise';
    // RF-TER-05: só representante_legal pode aprovar/recusar uma antecipação
    // originada por terceiro — visualizador só vê o badge, sem ação nenhuma.
    const canApproveTerceiro =
      item.status === 'aguardando_assinatura' && item.origem !== 'self' && auth?.perfilAcesso === 'representante_legal';
    const cardTappable = canOpenLiquidacao || canApproveTerceiro;

    function handlePressCard() {
      if (canOpenLiquidacao) {
        handleOpenPayment(item);
      } else if (canApproveTerceiro) {
        navigation.navigate('AdvanceTerceiroReview', {antecipacao: item});
      }
    }

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={cardTappable ? handlePressCard : undefined}
        disabled={!cardTappable}
        activeOpacity={cardTappable ? 0.7 : 1}>
        <View style={styles.cardTop}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTomador}>{item.tomador}</Text>
            <Text style={styles.cardMuted}>
              NF {item.nf_numero} · Líquido {formatBRL(item.valor_liquido)}
            </Text>
            <Text style={styles.cardMuted}>Crédito em {formatDateBR(item.data_credito)}</Text>
            {item.status === 'recusada' && item.motivo_recusa && (
              <Text style={styles.motivo}>{item.motivo_recusa}</Text>
            )}
            {item.status === 'em_atraso' && (
              <Text style={styles.motivo}>O tomador não liquidou a operação no vencimento.</Text>
            )}
          </View>
          <View style={[styles.badge, {backgroundColor: badge.bg}]}>
            <Text style={[styles.badgeText, {color: badge.text}]}>{badge.label}</Text>
          </View>
        </View>
        {canOpenLiquidacao && (
          <Text style={styles.actionLink}>
            {item.status === 'liquidada' ? 'Ver comprovante ›' : 'Ver detalhes da liquidação ›'}
          </Text>
        )}
        {canApproveTerceiro && <Text style={styles.actionLink}>Revisar e aprovar ›</Text>}
        {item.status === 'credito_efetuado' && (
          <TouchableOpacity onPress={() => handleViewCreditoComprovante(item)}>
            <Text style={styles.actionLink}>Ver comprovante ›</Text>
          </TouchableOpacity>
        )}
        {canCancel && (
          <TouchableOpacity onPress={() => handleCancel(item.id)}>
            <Text style={styles.cancelLink}>Cancelar solicitação</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, {auth?.nomeFantasia || 'profissional'}!</Text>
        <Text style={styles.subtitle}>Suas antecipações</Text>
      </View>

      <View style={styles.body}>
        <TouchableOpacity style={styles.newBtn} onPress={handleNewRequest} disabled={checkingMae} activeOpacity={0.85}>
          {checkingMae ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.newBtnText}>+ Nova solicitação</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Simulador')}>
          <Text style={styles.simularLink}>Simular uma nova antecipação</Text>
        </TouchableOpacity>

        <Text style={styles.listLabel}>Minhas antecipações</Text>

        {loading ? (
          <ActivityIndicator color="#0F2137" style={styles.loadingSpinner} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => String(item.id)}
            renderItem={renderItem}
            ItemSeparatorComponent={ItemSeparator}
            ListEmptyComponent={<Text style={styles.empty}>Você ainda não solicitou nenhuma antecipação.</Text>}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  greeting: {fontSize: 19, fontWeight: '800', color: '#0F2137'},
  subtitle: {fontSize: 13, color: '#6b7280', marginTop: 2},
  body: {flex: 1, paddingHorizontal: 20, paddingTop: 16},
  newBtn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 15, alignItems: 'center', marginBottom: 16},
  newBtnText: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  simularLink: {color: '#124B9A', fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 20},
  listLabel: {fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10},
  loadingSpinner: {marginTop: 40},
  listContent: {paddingBottom: 24},
  separator: {height: 10},
  empty: {color: '#9ca3af', fontSize: 14, textAlign: 'center', marginTop: 32},
  card: {backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14},
  cardTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  cardInfo: {flex: 1, paddingRight: 10},
  cardTomador: {fontSize: 15, fontWeight: '700', color: '#0F2137'},
  cardMuted: {fontSize: 12, color: '#6b7280', marginTop: 2},
  motivo: {fontSize: 12, color: '#dc3545', marginTop: 6, lineHeight: 17},
  badge: {borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4},
  badgeText: {fontSize: 11, fontWeight: '700'},
  actionLink: {color: '#124B9A', fontSize: 13, fontWeight: '600', marginTop: 10},
  cancelLink: {color: '#dc3545', fontSize: 13, fontWeight: '600', marginTop: 10},
});
