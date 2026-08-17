import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {HomeScreen} from '../screens/home/HomeScreen';
import {AdvanceMaeContractScreen} from '../screens/antecipacao/AdvanceMaeContractScreen';
import {AdvanceMaeFacialConfirmScreen} from '../screens/antecipacao/AdvanceMaeFacialConfirmScreen';
import {AdvanceNewScreen} from '../screens/antecipacao/AdvanceNewScreen';
import {AdvanceNfExtractScreen} from '../screens/antecipacao/AdvanceNfExtractScreen';
import {AdvanceNfReviewScreen} from '../screens/antecipacao/AdvanceNfReviewScreen';
import {AdvanceSimulateScreen} from '../screens/antecipacao/AdvanceSimulateScreen';
import {AdvanceReviewScreen} from '../screens/antecipacao/AdvanceReviewScreen';
import {AdvanceTerceiroReviewScreen} from '../screens/antecipacao/AdvanceTerceiroReviewScreen';
import {AdvanceFacialConfirmScreen} from '../screens/antecipacao/AdvanceFacialConfirmScreen';
import {AdvanceSuccessScreen} from '../screens/antecipacao/AdvanceSuccessScreen';
import {AdvancePaymentScreen} from '../screens/antecipacao/AdvancePaymentScreen';
import {SimuladorAutenticadoScreen} from '../screens/simulador/SimuladorAutenticadoScreen';
import type {AntecipacaoListItem} from '../api/antecipacoes';
import {PerfilHomeScreen} from '../screens/perfil/PerfilHomeScreen';
import {PerfilDadosBancariosScreen} from '../screens/perfil/PerfilDadosBancariosScreen';
import {PerfilRepresentantesScreen} from '../screens/perfil/PerfilRepresentantesScreen';
import {PerfilConvidarRepresentanteScreen} from '../screens/perfil/PerfilConvidarRepresentanteScreen';
import {PerfilConviteGeradoScreen} from '../screens/perfil/PerfilConviteGeradoScreen';
import {PerfilSuporteScreen} from '../screens/perfil/PerfilSuporteScreen';
import {PerfilHistoricoTermosScreen} from '../screens/perfil/PerfilHistoricoTermosScreen';

// Sub-stack da aba "Início" — Home como raiz e o fluxo de antecipação
// empilhado por cima. Era `EmpresaStackParamList` antes de Perfil existir
// (nome ficou errado quando a área logada ganhou uma segunda aba).
export type InicioStackParamList = {
  Home: undefined;
  AdvanceMaeContract: undefined;
  AdvanceMaeFacialConfirm: undefined;
  AdvanceNew: undefined;
  AdvanceNfExtract: undefined;
  AdvanceNfReview: undefined;
  AdvanceSimulate: undefined;
  AdvanceReview: undefined;
  AdvanceTerceiroReview: {antecipacao: AntecipacaoListItem};
  AdvanceFacialConfirm: undefined;
  AdvanceSuccess: undefined;
  AdvancePayment: {antecipacaoId: number; nfNumero: string};
  Simulador: undefined;
};

// Sub-stack da aba "Perfil" (RF-PERF-01, RF-REP-02/03/04/05/06).
export type PerfilStackParamList = {
  PerfilHome: undefined;
  PerfilDadosBancarios: undefined;
  PerfilRepresentantes: undefined;
  PerfilConvidarRepresentante: undefined;
  PerfilConviteGerado: {conviteId: string; nome: string};
  PerfilSuporte: undefined;
  PerfilHistoricoTermos: undefined;
};

export type EmpresaTabParamList = {
  Inicio: undefined;
  Perfil: undefined;
};

const Tab = createBottomTabNavigator<EmpresaTabParamList>();
const InicioStack = createNativeStackNavigator<InicioStackParamList>();
const PerfilStack = createNativeStackNavigator<PerfilStackParamList>();

function InicioNavigator() {
  return (
    <InicioStack.Navigator screenOptions={{headerShown: false}}>
      <InicioStack.Screen name="Home" component={HomeScreen} />
      <InicioStack.Screen name="AdvanceMaeContract" component={AdvanceMaeContractScreen} />
      <InicioStack.Screen name="AdvanceMaeFacialConfirm" component={AdvanceMaeFacialConfirmScreen} />
      <InicioStack.Screen name="AdvanceNew" component={AdvanceNewScreen} />
      <InicioStack.Screen name="AdvanceNfExtract" component={AdvanceNfExtractScreen} />
      <InicioStack.Screen name="AdvanceNfReview" component={AdvanceNfReviewScreen} />
      <InicioStack.Screen name="AdvanceSimulate" component={AdvanceSimulateScreen} />
      <InicioStack.Screen name="AdvanceReview" component={AdvanceReviewScreen} />
      <InicioStack.Screen name="AdvanceTerceiroReview" component={AdvanceTerceiroReviewScreen} />
      <InicioStack.Screen name="AdvanceFacialConfirm" component={AdvanceFacialConfirmScreen} />
      <InicioStack.Screen name="AdvanceSuccess" component={AdvanceSuccessScreen} />
      <InicioStack.Screen name="AdvancePayment" component={AdvancePaymentScreen} />
      <InicioStack.Screen name="Simulador" component={SimuladorAutenticadoScreen} />
    </InicioStack.Navigator>
  );
}

function PerfilNavigator() {
  return (
    <PerfilStack.Navigator screenOptions={{headerShown: false}}>
      <PerfilStack.Screen name="PerfilHome" component={PerfilHomeScreen} />
      <PerfilStack.Screen name="PerfilDadosBancarios" component={PerfilDadosBancariosScreen} />
      <PerfilStack.Screen name="PerfilRepresentantes" component={PerfilRepresentantesScreen} />
      <PerfilStack.Screen name="PerfilConvidarRepresentante" component={PerfilConvidarRepresentanteScreen} />
      <PerfilStack.Screen name="PerfilConviteGerado" component={PerfilConviteGeradoScreen} />
      <PerfilStack.Screen name="PerfilSuporte" component={PerfilSuporteScreen} />
      <PerfilStack.Screen name="PerfilHistoricoTermos" component={PerfilHistoricoTermosScreen} />
    </PerfilStack.Navigator>
  );
}

export function EmpresaNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#124B9A',
        tabBarInactiveTintColor: '#6b7280',
      }}>
      <Tab.Screen
        name="Inicio"
        component={InicioNavigator}
        options={{
          title: 'Início',
          tabBarIcon: ({color, size}) => <Icon name="home-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilNavigator}
        options={{
          title: 'Perfil',
          tabBarIcon: ({color, size}) => <Icon name="account-circle-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
