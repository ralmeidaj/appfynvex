import {create} from 'zustand';
import type {KycStatus} from '../types';

export interface DadosExtraidos {
  razaoSocial: string;
  nomeFantasia: string;
  endereco: string;
  responsavelNome: string;
  responsavelCpf: string;
  responsavelCargo: string;
}

export interface BankDataDraft {
  bank: string;
  agency: string;
  account: string;
  accountType: 'corrente' | 'poupanca';
  transferType: 'pix' | 'ted';
  pix: string;
}

// Rascunho do cadastro em andamento — vive só em memória (ao contrário do
// authStore, não precisa sobreviver a um fechamento do app: reiniciar o
// cadastro do zero é uma perda aceitável, é só um formulário de várias telas).
interface CadastroStore {
  cadastroId: number | null;
  cnpj: string;
  contratoSocialAttached: boolean;
  documentoIdentidadeAttached: boolean;
  procuracaoAttached: boolean;
  parceiroCodigo: string;
  dadosExtraidos: DadosExtraidos | null;
  kycStatus: KycStatus;
  bankData: BankDataDraft | null;
  // RF-REP-01: id do primeiro representante, devolvido por confirmar-dados —
  // guardado aqui só até aceite-termos poder autenticar (setAuth) com ele.
  representanteId: number | null;
  representanteNome: string;
  // RF-AUTH-01/RF-KYC-05: senha de login definida em confirmar-dados —
  // guardada aqui pelo mesmo motivo de representanteId, até aceite-termos
  // poder gravá-la como senha lembrada (RF-AUTH-04a), igual a um primeiro
  // login bem-sucedido.
  senha: string;
  setCnpj: (cnpj: string) => void;
  setContratoSocialAttached: (attached: boolean) => void;
  setDocumentoIdentidadeAttached: (attached: boolean) => void;
  setProcuracaoAttached: (attached: boolean) => void;
  setParceiroCodigo: (codigo: string) => void;
  setCadastroId: (id: number) => void;
  setDadosExtraidos: (dados: DadosExtraidos) => void;
  setBankData: (bankData: BankDataDraft) => void;
  setRepresentante: (id: number, nome: string) => void;
  setSenha: (senha: string) => void;
  reset: () => void;
}

const initialState = {
  cadastroId: null,
  cnpj: '',
  contratoSocialAttached: false,
  documentoIdentidadeAttached: false,
  procuracaoAttached: false,
  parceiroCodigo: '',
  dadosExtraidos: null,
  kycStatus: 'pending' as KycStatus,
  bankData: null,
  representanteId: null,
  representanteNome: '',
  senha: '',
};

export const useCadastroStore = create<CadastroStore>(set => ({
  ...initialState,
  setCnpj: cnpj => set({cnpj}),
  setContratoSocialAttached: attached => set({contratoSocialAttached: attached}),
  setDocumentoIdentidadeAttached: attached => set({documentoIdentidadeAttached: attached}),
  setProcuracaoAttached: attached => set({procuracaoAttached: attached}),
  setParceiroCodigo: codigo => set({parceiroCodigo: codigo}),
  setCadastroId: id => set({cadastroId: id}),
  setDadosExtraidos: dados => set({dadosExtraidos: dados}),
  setBankData: bankData => set({bankData}),
  setRepresentante: (id, nome) => set({representanteId: id, representanteNome: nome}),
  setSenha: senha => set({senha}),
  reset: () => set({...initialState}),
}));
