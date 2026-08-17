import React from 'react';
import {View, TouchableOpacity, StyleSheet, ScrollView, Linking} from 'react-native';
import {Text} from '../../components/AppText';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';

const WHATSAPP_URL = 'https://wa.me/5500000000000';

const FAQ = [
  {
    pergunta: 'Quanto tempo leva pra receber o crédito da antecipação?',
    resposta: 'A previsão de crédito é mostrada na simulação, antes de você confirmar a solicitação — normalmente em até 24h úteis após a aprovação.',
  },
  {
    pergunta: 'Quem paga o boleto de liquidação?',
    resposta: 'Se sua empresa tem vínculo confirmado com um parceiro (gestora/convênio), o tomador liquida pela plataforma do parceiro. Sem vínculo confirmado, é a própria empresa quem paga.',
  },
  {
    pergunta: 'Posso ter mais de um representante com acesso ao app?',
    resposta: 'Sim — em "Gerenciar representantes" você convida quantos precisar, com dois níveis de acesso (representante legal ou visualizador).',
  },
];

// RF-SUP-01: N2 Fynvex via WhatsApp Business + FAQ embutido. Pra PJ com
// vínculo confirmado, o N1 é feito pelo próprio parceiro fora do app — a UI
// não precisa distinguir isso, o canal N2 fica sempre disponível.
export function PerfilSuporteScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Suporte</Text>

        <TouchableOpacity style={styles.whatsappBtn} onPress={() => Linking.openURL(WHATSAPP_URL)} activeOpacity={0.85}>
          <Text style={styles.whatsappBtnText}>Falar no WhatsApp</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Perguntas frequentes</Text>
        {FAQ.map(item => (
          <View key={item.pergunta} style={styles.faqCard}>
            <Text style={styles.faqPergunta}>{item.pergunta}</Text>
            <Text style={styles.faqResposta}>{item.resposta}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  back: {padding: 20},
  backText: {color: '#124B9A', fontSize: 15},
  content: {paddingHorizontal: 24, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '800', color: '#0F2137', marginBottom: 20},
  whatsappBtn: {backgroundColor: '#15803d', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 28},
  whatsappBtnText: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  sectionTitle: {fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12},
  faqCard: {backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 10},
  faqPergunta: {fontSize: 14, fontWeight: '700', color: '#0F2137', marginBottom: 6},
  faqResposta: {fontSize: 13, color: '#6b7280', lineHeight: 19},
});
