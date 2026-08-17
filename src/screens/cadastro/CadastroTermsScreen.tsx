import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {aceitarTermos} from '../../api/cadastro';
import {useCadastroStore} from '../../store/cadastroStore';
import {useAuthStore} from '../../store/authStore';
import {saveSenhaToKeychain} from '../../hooks/useAuth';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// RF-TERM-02: versão do texto abaixo — subir este número junto de qualquer
// mudança de conteúdo dos termos.
const TERMOS_VERSAO = '1.0';

const TERMS_TEXT = `TERMOS DE USO E POLÍTICA DE PRIVACIDADE — FYNVEX (texto ilustrativo)

1. Objeto. Estes termos regulam o uso da plataforma Fynvex por profissionais de saúde (pessoa jurídica), representados por seu responsável legal, para consulta e antecipação de recebíveis, bem como para pagamento de valores devidos à Fynvex.

2. Cadastro. O usuário declara serem verdadeiras as informações e documentos enviados no cadastro, autorizando a Fynvex a realizar a análise e validação desses dados junto a bases públicas e privadas.

3. Dados bancários. Os dados de conta e/ou Pix informados serão utilizados exclusivamente para o crédito de valores de antecipação aprovados.

4. Privacidade. Os dados pessoais coletados serão tratados conforme a Lei Geral de Proteção de Dados (LGPD), utilizados apenas para as finalidades descritas neste termo.

5. Disposições gerais. Este é um texto ilustrativo utilizado apenas para fins de protótipo e não constitui documento legal válido.`;

export function CadastroTermsScreen() {
  const navigation = useNavigation<Nav>();
  const [accepted, setAccepted] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // RF-ANT-07a: o checkbox só fica interativo depois que o usuário rolar o
  // termo até o fim — não basta abrir a tela.
  function handleTermsScroll({nativeEvent}: NativeSyntheticEvent<NativeScrollEvent>) {
    const {layoutMeasurement, contentOffset, contentSize} = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
      setScrolledToEnd(true);
    }
  }

  const cadastroId = useCadastroStore(s => s.cadastroId);
  const cnpj = useCadastroStore(s => s.cnpj);
  const dados = useCadastroStore(s => s.dadosExtraidos);
  const representanteId = useCadastroStore(s => s.representanteId);
  const representanteNome = useCadastroStore(s => s.representanteNome);
  const senha = useCadastroStore(s => s.senha);
  const resetCadastro = useCadastroStore(s => s.reset);
  const setAuth = useAuthStore(s => s.setAuth);

  async function handleSubmit() {
    if (!accepted || !cadastroId || representanteId == null) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await aceitarTermos(cadastroId, TERMOS_VERSAO);
      const cpf = dados?.responsavelCpf ?? '';
      await setAuth({
        sessionToken: res.data.access_token,
        expiresAt: new Date(Date.now() + res.data.expires_in * 1000).toISOString(),
        empresaId: cadastroId,
        nomeFantasia: dados?.nomeFantasia ?? '',
        cnpj,
        cpf,
        kycStatus: res.data.kyc_status,
        // Cadastro recém-concluído nunca nasce rejeitado — só passa a existir
        // depois de uma análise da equipe Fynvex (RF-KYC-02/04).
        motivoRejeicao: null,
        representanteId,
        representanteNome,
        // RF-REP-01: quem conclui o cadastro original é sempre o primeiro
        // representante, sempre representante_legal — não é um palpite.
        perfilAcesso: 'representante_legal',
      });
      // RF-AUTH-04a: conclusão do cadastro conta como primeiro login bem-
      // sucedido no dispositivo — a senha definida em confirmar-dados
      // (RF-KYC-05) já vale de cara, sem exigir um login manual em seguida.
      await saveSenhaToKeychain(cpf, senha);
      resetCadastro();
      // RootNavigator reage à mudança de `auth` e leva pra KycPendingScreen.
    } catch {
      setError('Não foi possível concluir o cadastro. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ Voltar</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Termos de uso</Text>
        <ScrollView
          style={styles.termsBox}
          onScroll={handleTermsScroll}
          scrollEventThrottle={100}
          nestedScrollEnabled>
          <Text style={styles.termsText}>{TERMS_TEXT}</Text>
        </ScrollView>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => scrolledToEnd && setAccepted(!accepted)}
          disabled={!scrolledToEnd}
          activeOpacity={0.8}>
          <View style={[styles.checkbox, accepted && styles.checkboxChecked, !scrolledToEnd && styles.checkboxDisabled]}>
            {accepted && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Li e aceito os Termos de Uso e a Política de Privacidade da Fynvex.</Text>
        </TouchableOpacity>
        {!scrolledToEnd && <Text style={styles.scrollHint}>Role o texto acima até o final para habilitar o aceite.</Text>}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, !accepted && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!accepted || loading}
          activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Concluir cadastro</Text>}
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
  title: {fontSize: 22, fontWeight: '800', color: '#0F2137', marginBottom: 14},
  termsBox: {maxHeight: 380, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14},
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
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 16},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
});
