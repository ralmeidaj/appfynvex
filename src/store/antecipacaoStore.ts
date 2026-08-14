import {create} from 'zustand';

export interface NfDados {
  numero: string;
  tomador: string;
  cnpjTomador: string;
  valor: number;
  // RF-ANT-04: distinto de `valor` — o que o usuário efetivamente quer
  // antecipar nesta operação, pré-preenchido com o saldo disponível da NF.
  valorSolicitado: number;
  dataEmissao: string;
  dataVencimento: string;
}

export interface SimulacaoDados {
  valorBruto: number;
  desagioPct: number;
  desagio: number;
  taxaAdministrativa: number;
  valorLiquido: number;
  dataCreditoPrevista: string;
}

// Ephemeral, igual cadastroStore — rascunho de UMA solicitação em andamento,
// não é persistido (não há necessidade de retomar depois de fechar o app).
interface AntecipacaoStore {
  nfLeituraId: number | null;
  nfDados: NfDados | null;
  simulacao: SimulacaoDados | null;
  antecipacaoId: number | null;
  setNfLeituraId: (id: number) => void;
  setNfDados: (dados: NfDados) => void;
  setSimulacao: (simulacao: SimulacaoDados) => void;
  setAntecipacaoId: (id: number) => void;
  reset: () => void;
}

const initialState = {
  nfLeituraId: null,
  nfDados: null,
  simulacao: null,
  antecipacaoId: null,
};

export const useAntecipacaoStore = create<AntecipacaoStore>(set => ({
  ...initialState,
  setNfLeituraId: id => set({nfLeituraId: id}),
  setNfDados: dados => set({nfDados: dados}),
  setSimulacao: simulacao => set({simulacao}),
  setAntecipacaoId: id => set({antecipacaoId: id}),
  reset: () => set({...initialState}),
}));
