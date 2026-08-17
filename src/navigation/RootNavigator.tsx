import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuthStore} from '../store/authStore';
import {checkDeviceIntegrity} from '../hooks/useDeviceIntegrity';
import {SplashScreen} from '../screens/SplashScreen';
import {WelcomeScreen} from '../screens/auth/WelcomeScreen';
import {LoginCpfScreen} from '../screens/auth/LoginCpfScreen';
import {SenhaScreen} from '../screens/auth/SenhaScreen';
import {KycPendingScreen} from '../screens/auth/KycPendingScreen';
import {KycRejectedScreen} from '../screens/auth/KycRejectedScreen';
import {RecuperarContaScreen} from '../screens/auth/RecuperarContaScreen';
import {RecuperarCodigoScreen} from '../screens/auth/RecuperarCodigoScreen';
import {RecuperarFacialScreen} from '../screens/auth/RecuperarFacialScreen';
import {ConviteEscolhaScreen} from '../screens/auth/ConviteEscolhaScreen';
import {ConviteAceitarScreen} from '../screens/auth/ConviteAceitarScreen';
import {ConviteVisualizadorConfirmarScreen} from '../screens/auth/ConviteVisualizadorConfirmarScreen';
import {CadastroCnpjDocsScreen} from '../screens/cadastro/CadastroCnpjDocsScreen';
import {CadastroAiExtractScreen} from '../screens/cadastro/CadastroAiExtractScreen';
import {CadastroAiReviewScreen} from '../screens/cadastro/CadastroAiReviewScreen';
import {CadastroFacialEnrollScreen} from '../screens/cadastro/CadastroFacialEnrollScreen';
import {CadastroBankDataScreen} from '../screens/cadastro/CadastroBankDataScreen';
import {CadastroTermsScreen} from '../screens/cadastro/CadastroTermsScreen';
import {SimuladorScreen} from '../screens/simulador/SimuladorScreen';
import {EmpresaNavigator} from './EmpresaNavigator';

export type RootStackParamList = {
  Welcome: undefined;
  LoginCpf: undefined;
  Senha: {cpf: string};
  KycPending: undefined;
  KycRejected: undefined;
  EmpresaApp: undefined;
  CadastroCnpjDocs: undefined;
  CadastroAiExtract: undefined;
  CadastroAiReview: undefined;
  CadastroFacialEnroll: undefined;
  CadastroBankData: undefined;
  CadastroTerms: undefined;
  Simulador: undefined;
  RecuperarConta: undefined;
  RecuperarCodigo: {cpf: string; email: string};
  RecuperarFacial: {representanteId: number; cpf: string; novaSenha: string};
  ConviteEscolha: undefined;
  ConviteAceitar: undefined;
  ConviteVisualizadorConfirmar: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const {auth, isLoading, restoreSession} = useAuthStore();

  useEffect(() => {
    restoreSession();
    checkDeviceIntegrity();
  }, [restoreSession]);

  if (isLoading) {
    return <SplashScreen />;
  }

  // Cascata de decisão, nesta ordem — reativa ao estado da store, sem
  // navigation.reset() em lugar nenhum:
  //   sem sessão -> stack de login + cadastro
  //   sessão (restaurada do cache ou reautenticada com a senha lembrada,
  //     RF-AUTH-04a) mas cadastro não aprovado -> KycPending
  //   senão -> app
  // Não existe mais um passo de confirmação intermediário: retomar sessão é
  // 100% silencioso (RF-AUTH-04a/RNF-19), sem tela nem leitura facial.
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {auth === null ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="LoginCpf" component={LoginCpfScreen} />
            <Stack.Screen name="Senha" component={SenhaScreen} />
            <Stack.Screen name="RecuperarConta" component={RecuperarContaScreen} />
            <Stack.Screen name="RecuperarCodigo" component={RecuperarCodigoScreen} />
            <Stack.Screen name="RecuperarFacial" component={RecuperarFacialScreen} />
            <Stack.Screen name="ConviteEscolha" component={ConviteEscolhaScreen} />
            <Stack.Screen name="ConviteAceitar" component={ConviteAceitarScreen} />
            <Stack.Screen name="ConviteVisualizadorConfirmar" component={ConviteVisualizadorConfirmarScreen} />
            <Stack.Screen name="CadastroCnpjDocs" component={CadastroCnpjDocsScreen} />
            <Stack.Screen name="CadastroAiExtract" component={CadastroAiExtractScreen} />
            <Stack.Screen name="CadastroAiReview" component={CadastroAiReviewScreen} />
            <Stack.Screen name="CadastroFacialEnroll" component={CadastroFacialEnrollScreen} />
            <Stack.Screen name="CadastroBankData" component={CadastroBankDataScreen} />
            <Stack.Screen name="CadastroTerms" component={CadastroTermsScreen} />
            <Stack.Screen name="Simulador" component={SimuladorScreen} />
          </>
        ) : auth.kycStatus === 'rejected' ? (
          <Stack.Screen name="KycRejected" component={KycRejectedScreen} />
        ) : auth.kycStatus !== 'approved' ? (
          <Stack.Screen name="KycPending" component={KycPendingScreen} />
        ) : (
          <Stack.Screen name="EmpresaApp" component={EmpresaNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
