import React from 'react';
import {Text as RNText, StyleSheet, type TextProps} from 'react-native';

// RNF-23 — tipografia de marca é Poppins em todo o app. Em vez de editar
// fontFamily em cada StyleSheet, este wrapper substitui o `Text` nativo:
// olha o `fontWeight` já declarado no estilo (que toda tela já usa pra
// hierarquia visual) e escolhe o arquivo de fonte Poppins correspondente,
// já carregado em android/app/src/main/assets/fonts.
function poppinsFamilyFor(fontWeight: string | number | undefined): string {
  if (fontWeight === undefined || fontWeight === 'normal') {
    return 'Poppins-Regular';
  }
  const weight = fontWeight === 'bold' ? 700 : Number(fontWeight);
  if (weight >= 700) {
    return 'Poppins-Bold';
  }
  if (weight >= 600) {
    return 'Poppins-SemiBold';
  }
  if (weight >= 500) {
    return 'Poppins-Medium';
  }
  return 'Poppins-Regular';
}

export function Text({style, ...rest}: TextProps) {
  const flat = StyleSheet.flatten(style) as {fontWeight?: string | number} | undefined;
  const fontFamily = poppinsFamilyFor(flat?.fontWeight);
  return <RNText {...rest} style={[{fontFamily}, style]} />;
}
