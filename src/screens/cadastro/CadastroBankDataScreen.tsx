import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {salvarDadosBancarios} from '../../api/cadastro';
import {useCadastroStore} from '../../store/cadastroStore';
import type {BankDataDraft} from '../../store/cadastroStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BANKS = [
  'Banco do Brasil',
  'Bradesco',
  'Itaú Unibanco',
  'Santander',
  'Caixa Econômica Federal',
  'Nubank',
  'Inter',
  'C6 Bank',
  'Sicoob',
];

function Chip({label, selected, onPress}: {label: string; selected: boolean; onPress: () => void}) {
  return (
    <TouchableOpacity
      style={[chipStyles.chip, selected && chipStyles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.8}>
      <Text style={[chipStyles.chipText, selected && chipStyles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function CadastroBankDataScreen() {
  const navigation = useNavigation<Nav>();
  const cadastroId = useCadastroStore(s => s.cadastroId);
  const setBankDataStore = useCadastroStore(s => s.setBankData);

  const [bank, setBank] = useState('');
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [agency, setAgency] = useState('');
  const [account, setAccount] = useState('');
  const [accountType, setAccountType] = useState<BankDataDraft['accountType']>('corrente');
  const [transferType, setTransferType] = useState<BankDataDraft['transferType']>('pix');
  const [pix, setPix] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = Boolean(bank && agency.trim() && account.trim() && (transferType !== 'pix' || pix.trim()));

  async function handleSubmit() {
    if (!valid || !cadastroId) {
      setError('Preencha os dados bancários (e o Pix, se essa for a forma de recebimento) para continuar.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const bancoId = BANKS.indexOf(bank) + 1;
      await salvarDadosBancarios(cadastroId, {
        bancoId,
        agencia: agency.trim(),
        conta: account.trim(),
        tipoConta: accountType,
        tipoTransferencia: transferType,
        pix: pix.trim(),
      });
      setBankDataStore({bank, agency: agency.trim(), account: account.trim(), accountType, transferType, pix: pix.trim()});
      navigation.navigate('CadastroTerms');
    } catch {
      setError('Não foi possível salvar os dados bancários. Tente novamente.');
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
        <Text style={styles.title}>Dados para depósito</Text>
        <Text style={styles.subtitle}>Onde você quer receber os valores das antecipações?</Text>

        <Text style={styles.label}>Banco</Text>
        <TouchableOpacity style={styles.select} onPress={() => setBankPickerOpen(true)} activeOpacity={0.8}>
          <Text style={bank ? styles.selectValue : styles.selectPlaceholder}>{bank || 'Selecione o banco'}</Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Agência</Text>
            <TextInput style={styles.input} placeholder="0000" placeholderTextColor="#9ca3af" value={agency} onChangeText={setAgency} keyboardType="numeric" />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Conta</Text>
            <TextInput style={styles.input} placeholder="00000-0" placeholderTextColor="#9ca3af" value={account} onChangeText={setAccount} />
          </View>
        </View>

        <Text style={styles.label}>Tipo de conta</Text>
        <View style={styles.chipRow}>
          <Chip label="Conta corrente" selected={accountType === 'corrente'} onPress={() => setAccountType('corrente')} />
          <Chip label="Poupança" selected={accountType === 'poupanca'} onPress={() => setAccountType('poupanca')} />
        </View>

        <View style={styles.divider} />

        <Text style={styles.label}>Forma de recebimento</Text>
        <View style={styles.chipRow}>
          <Chip label="Pix" selected={transferType === 'pix'} onPress={() => setTransferType('pix')} />
          <Chip label="TED" selected={transferType === 'ted'} onPress={() => setTransferType('ted')} />
        </View>

        <Text style={[styles.label, styles.pixLabel]}>Pix</Text>
        <TextInput
          style={styles.input}
          placeholder="Sua chave ou código Pix"
          placeholderTextColor="#9ca3af"
          value={pix}
          onChangeText={setPix}
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
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Continuar</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={bankPickerOpen} animationType="slide" transparent onRequestClose={() => setBankPickerOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setBankPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Selecione o banco</Text>
            <FlatList
              data={BANKS}
              keyExtractor={item => item}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setBank(item);
                    setBankPickerOpen(false);
                  }}>
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#f8fafc'},
  back: {padding: 20},
  backText: {color: '#124B9A', fontSize: 15},
  content: {paddingHorizontal: 24, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '800', color: '#0F2137', marginBottom: 8},
  subtitle: {fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 20},
  label: {fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6},
  pixLabel: {marginTop: 14},
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
  select: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectValue: {fontSize: 15, color: '#111827'},
  selectPlaceholder: {fontSize: 15, color: '#9ca3af'},
  row: {flexDirection: 'row', gap: 12, marginTop: 14},
  rowItem: {flex: 1},
  chipRow: {flexDirection: 'row', gap: 10},
  divider: {height: 1, backgroundColor: '#e5e7eb', marginVertical: 16},
  errorBox: {backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 16},
  errorText: {color: '#dc3545', fontSize: 13, lineHeight: 19},
  btn: {backgroundColor: '#124B9A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20},
  btnDisabled: {backgroundColor: '#93c5fd'},
  btnText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  modalBackdrop: {flex: 1, backgroundColor: 'rgba(4,19,36,0.5)', justifyContent: 'flex-end'},
  modalSheet: {backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '60%', paddingBottom: 24},
  modalTitle: {fontSize: 16, fontWeight: '800', color: '#0F2137', padding: 20, paddingBottom: 8},
  modalItem: {paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f1f3'},
  modalItemText: {fontSize: 15, color: '#111827'},
});

const chipStyles = StyleSheet.create({
  chip: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  chipSelected: {backgroundColor: '#124B9A', borderColor: '#124B9A'},
  chipText: {fontSize: 14, fontWeight: '600', color: '#0F2137'},
  chipTextSelected: {color: '#ffffff'},
});
