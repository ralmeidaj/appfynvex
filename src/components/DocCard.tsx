import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import {Text} from './AppText';

// Card de anexo de documento — reusado entre o cadastro (Contrato Social/
// Procuração) e a solicitação de antecipação (Nota Fiscal), mesmo padrão de
// `renderDocsList()`/doc-card do protótipo (CLAUDE.md).
export function DocCard({
  title,
  required,
  attached,
  hint,
  onToggle,
}: {
  title: string;
  required: boolean;
  attached: boolean;
  hint: string;
  onToggle: () => void;
}) {
  return (
    <View style={[styles.card, attached && styles.cardAttached]}>
      <View style={styles.info}>
        <Text style={styles.title}>
          {title}
          {!required && ' (opcional)'}
        </Text>
        <Text style={attached ? styles.attachedHint : styles.hint}>{attached ? '✓ Anexado' : hint}</Text>
      </View>
      <TouchableOpacity
        style={styles.action}
        onPress={onToggle}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${attached ? 'Remover' : 'Selecionar'} anexo de ${title}`}
        accessibilityState={{selected: attached}}>
        <Text style={styles.actionText}>{attached ? 'Remover' : 'Selecionar'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardAttached: {borderColor: '#124B9A'},
  info: {flex: 1, paddingRight: 12},
  title: {fontSize: 14, fontWeight: '700', color: '#0F2137'},
  hint: {fontSize: 12, color: '#6b7280', marginTop: 2},
  attachedHint: {fontSize: 12, color: '#124B9A', fontWeight: '600', marginTop: 2},
  action: {borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8},
  actionText: {fontSize: 12, fontWeight: '700', color: '#0F2137'},
});
