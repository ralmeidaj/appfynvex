import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {InicioStackParamList} from '../../navigation/EmpresaNavigator';

type Nav = NativeStackNavigationProp<InicioStackParamList>;

const CONTRATO_MAE_TEXT = `CONTRATO-MÃE — ADESÃO AO PROGRAMA DE ANTECIPAÇÃO FYNVEX (texto ilustrativo)

1. Objeto. Este instrumento formaliza a adesão da CONTRATANTE ao programa de antecipação de recebíveis da Fynvex, estabelecendo as condições gerais sob as quais operações futuras de antecipação (cada uma formalizada por seu próprio Termo de Cessão de Recebíveis) serão realizadas.

2. Assinatura única. Este Contrato-Mãe é assinado uma única vez, na primeira solicitação de antecipação da CONTRATANTE. Solicitações seguintes não exigem nova assinatura deste termo — apenas do Termo de Cessão específico de cada operação.

3. Condições gerais. Aplicam-se a toda operação futura as regras de deságio, taxa administrativa e prazos vigentes no momento de cada solicitação, informadas previamente à CONTRATANTE na tela de simulação de cada operação.

4. Confirmação. A assinatura deste Contrato-Mãe é validada por meio de segundo fator de autenticação (leitura facial). Em produção, a assinatura eletrônica ocorre por meio de plataforma especializada de assinatura digital.

5. Disposições gerais. Este é um texto ilustrativo utilizado apenas para fins de protótipo e não constitui documento legal válido.`;

// RF-MAE-01/02 — assinado uma única vez, antes da 1ª solicitação da empresa.
export function AdvanceMaeContractScreen() {
  const navigation = useNavigation<Nav>();
  const [accepted, setAccepted] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  // RF-ANT-07a: o checkbox só fica interativo depois que o usuário rolar o
  // termo até o fim — não basta abrir a tela.
  function handleTermsScroll({nativeEvent}: NativeSyntheticEvent<NativeScrollEvent>) {
    const {layoutMeasurement, contentOffset, contentSize} = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
      setScrolledToEnd(true);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Contrato-Mãe</Text>
        <Text style={styles.subtitle}>
          Antes da sua primeira solicitação, é preciso aceitar o acordo-quadro do programa de
          antecipação da Fynvex. Isso é feito uma única vez.
        </Text>
        <ScrollView
          style={styles.textBox}
          onScroll={handleTermsScroll}
          scrollEventThrottle={100}
          nestedScrollEnabled>
          <Text style={styles.termsText}>{CONTRATO_MAE_TEXT}</Text>
        </ScrollView>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => scrolledToEnd && setAccepted(!accepted)}
          disabled={!scrolledToEnd}
          activeOpacity={0.8}>
          <View style={[styles.checkbox, accepted && styles.checkboxChecked, !scrolledToEnd && styles.checkboxDisabled]}>
            {accepted && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Li e aceito o Contrato-Mãe do programa de antecipação.</Text>
        </TouchableOpacity>
        {!scrolledToEnd && <Text style={styles.scrollHint}>Role o texto acima até o final para habilitar o aceite.</Text>}

        <TouchableOpacity
          style={[styles.btn, !accepted && styles.btnDisabled]}
          onPress={() => navigation.navigate('AdvanceMaeFacialConfirm')}
          disabled={!accepted}
          activeOpacity={0.85}>
          <Text style={styles.btnText}>Continuar</Text>
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
  title: {fontSize: 22, fontWeight: '800', color: '#0F2137', marginBottom: 10},
  subtitle: {fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 16},
  textBox: {maxHeight: 380, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14},
  termsText: {fontSize: 13, lineHeight: 20, color: '#374151'},
  checkboxRow: {flexDirection: 'row', alignItems: 'flex-start', marginTop: 16, gap: 10},
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {backgroundColor: '#124B9A', borderColor: '#124B9A'},
  checkboxDisabled: {backgroundColor: '#f3f4f6'},
  checkboxMark: {color: '#ffffff', fontSize: 14, fontWeight: '800'},
  checkboxLabel: {flex: 1, fontSize: 13, color: '#374151', lineHeight: 19},
  scrollHint: {fontSize: 12, color: '#9ca3af', marginTop: 6, marginLeft: 32},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
});
