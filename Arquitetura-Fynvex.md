# Arquitetura — Fynvex App

Este documento descreve a arquitetura do app mobile de antecipação de recebíveis para
profissionais de saúde (PJ) e como ele se integra ao backend e aos serviços externos. Os
requisitos por trás de cada decisão estão em
[`Especificacao-Requisitos-Fynvex.md`](./Especificacao-Requisitos-Fynvex.md) — os identificadores
entre parênteses (`RF-...`, `RNF-...`, `RN-...`) apontam para lá.

---

## 1. Visão geral

O app mobile é o único ponto de contato do representante da empresa com a Fynvex. Ele fala com um
único backend — a mesma aplicação Laravel que já sustenta o back-office web (`sistema-fynvex` /
`antecipacao-develop`) — através de um grupo novo de rotas (`/api/v1/app/*`, seção 4 da
especificação). Esse backend concentra toda a comunicação com os serviços externos; o app nunca
fala diretamente com um provedor de terceiro.

```mermaid
graph TB
    subgraph Usuarios["Usuários"]
        REP["Representante da empresa<br/>administrador / operador"]
        GESTORA["Gestora / Hospital convenente"]
        STAFF["Equipe Fynvex<br/>(back-office)"]
    end

    APP["App Mobile<br/>React Native<br/>(este projeto)"]
    BACKOFFICE["Back-office Web<br/>sistema-fynvex (AdminLTE)"]
    BACKEND["Backend Fynvex<br/>Laravel 12 — antecipacao-develop<br/>+ rotas novas /api/v1/app/*"]

    REP -->|usa| APP
    STAFF -->|analisa KYC / Nota Fiscal| BACKOFFICE
    GESTORA -->|cadastra antecipação de terceiro RF-TER-01| BACKOFFICE

    APP -->|HTTPS + certificate pinning RNF-16| BACKEND
    BACKOFFICE --- BACKEND

    BACKEND --> BIOMETRIA["Provedor de biometria facial<br/>liveness + face match<br/>RF-BIO-08 — a contratar"]
    BACKEND --> OCR["OCR/IA de documentos<br/>já existe no código web,<br/>exposto via API própria"]
    BACKEND --> PAYPROXY["Payproxy<br/>boletos / split<br/>solução interna já usada"]
    BACKEND --> AUTENTIQUE["Autentique<br/>assinatura eletrônica formal"]
    BACKEND --> PUSH["FCM / APNs<br/>push notifications"]
    BACKEND --> WPP["WhatsApp Business API<br/>espelho de notificações"]
    BACKEND --> DC["Plataforma DC/ABM<br/>parceiros, gestoras,<br/>hospitais convenentes"]
    BACKEND --> REGISTRADORA["Registradora de recebíveis<br/>anti dupla-cessão RN-11"]
    BACKEND --> SMTP["Servidor SMTP próprio<br/>Fynvex — infra interna"]
```

---

## 2. Arquitetura interna do app mobile

O app segue a mesma stack e organização de pastas do `payproxy-app` (decisão já tomada,
ver `CLAUDE.md`): telas puras, estado em Zustand, uma camada `api/` por domínio sobre um único
cliente HTTP com interceptors.

```mermaid
graph TB
    subgraph Telas["src/screens"]
        AUTH_S["auth/"]
        CAD_S["cadastro/"]
        HOME_S["home/"]
        ANT_S["antecipacao/"]
        PERFIL_S["perfil/"]
    end

    subgraph Estado["Estado"]
        STORE["src/store<br/>Zustand — authStore, antecipacaoStore"]
        HOOKS["src/hooks<br/>useAuth, usePushNotifications"]
    end

    subgraph API["src/api"]
        DOMAIN["auth.ts / cadastro.ts /<br/>antecipacoes.ts / perfil.ts"]
        CLIENT["client.ts<br/>axios + interceptor Bearer<br/>+ interceptor de 401 RNF-18"]
    end

    KEYCHAIN["react-native-keychain<br/>token RNF-20 + senha lembrada RF-AUTH-04a"]
    ASYNC["AsyncStorage<br/>cache de perfil / offline"]
    MOCK["src/api/mocks/adapter.ts<br/>USE_MOCK_API=true"]
    REAL["Backend real<br/>/api/v1/app/*"]

    Telas --> Estado
    Telas --> API
    Estado --> API
    STORE --> KEYCHAIN
    STORE --> ASYNC
    API --> CLIENT
    CLIENT -->|USE_MOCK_API=true| MOCK
    CLIENT -->|USE_MOCK_API=false| REAL
```

`client.ts` é o único lugar que decide entre mock e backend real — nenhuma tela ou store sabe
disso. Quando o backend real existir, a troca é `USE_MOCK_API=false` e a remoção de
`src/api/mocks/`, sem tocar em `src/api/*.ts` (que já falam o contrato real da seção 4) nem em
telas.

---

## 3. Onde as rotas novas entram no backend

Não há um novo serviço de backend. As rotas que o app consome entram como um grupo novo de
rotas/controllers dentro da mesma aplicação Laravel que já opera o back-office, reaproveitando o
mesmo banco de dados e as mesmas regras de negócio (motor de deságio, taxa administrativa,
modelos de Empresa/Sócio/Antecipação).

```mermaid
graph LR
    subgraph LARAVEL["sistema-fynvex (Laravel 12 / PHP) — mesma aplicação"]
        WEBROUTES["Rotas web existentes<br/>back-office AdminLTE"]
        APIROUTES["Rotas novas<br/>/api/v1/app/*<br/>(seção 4 da especificação)"]
        DOMINIO["Domínio / banco compartilhado<br/>Empresa, Sócio, Antecipação,<br/>motor de deságio e taxa"]
    end

    WEBROUTES --> DOMINIO
    APIROUTES --> DOMINIO
    APPM["App Mobile"] --> APIROUTES
    STAFFM["Equipe Fynvex"] --> WEBROUTES
```

---

## 4. Fluxos detalhados

### 4.1 Autenticação (RF-AUTH-01 / RF-AUTH-04a)

Senha é pessoal (do representante) e, uma vez usada com sucesso num dispositivo, é lembrada — só a
leitura facial é pedida nos logins seguintes nesse mesmo dispositivo.

```mermaid
sequenceDiagram
    participant U as Representante
    participant App as App Mobile
    participant KC as Keychain
    participant BE as Backend
    participant BIO as Provedor Biometria

    U->>App: informa CNPJ
    App->>BE: POST /auth/cnpj
    BE-->>App: empresa encontrada
    alt Primeiro login no dispositivo
        U->>App: informa senha
    else Login seguinte no mesmo dispositivo
        App->>KC: lê senha lembrada
    end
    App->>BE: POST /auth/leitura-facial/iniciar (cnpj, senha)
    BE-->>App: session_id (representante já resolvido)
    App->>BIO: captura de liveness facial
    BIO-->>App: template válido
    App->>BE: POST /auth/leitura-facial/confirmar (session_id)
    BE-->>App: token de sessão
    App->>KC: grava token e, no 1º login, a senha
    App->>U: Home
```

### 4.2 Cadastro e KYC (RF-CAD, RF-BIO-09, RF-KYC)

```mermaid
sequenceDiagram
    participant U as Responsável legal
    participant App as App Mobile
    participant BE as Backend
    participant OCR as OCR/IA (API própria)
    participant BIO as Provedor Biometria
    participant Staff as Equipe Fynvex
    participant SMTP as Servidor SMTP

    App->>BE: POST /cadastro (cnpj)
    U->>App: envia Contrato Social + documento de identidade
    App->>BE: upload dos documentos
    BE->>OCR: extrai dados do Contrato Social
    OCR-->>BE: nome fantasia, responsável legal, CPF
    BE-->>App: dados extraídos, revisáveis
    U->>App: confirma dados e cria senha
    App->>BE: POST /cadastro/{id}/confirmar-dados
    BE->>BE: cria o 1º representante (administrador/ativo)
    U->>App: leitura facial de cadastro
    App->>BIO: captura + comparação com o documento de identidade RF-BIO-09
    BIO-->>BE: template e score de correspondência
    U->>App: dados bancários e aceite dos termos
    App->>BE: POST /cadastro/{id}/dados-bancarios, /aceite-termos
    BE->>Staff: entra na fila de análise (KYC)
    Staff->>BE: aprova ou rejeita
    BE->>SMTP: envia e-mail com o resultado RF-KYC-03/04
    BE->>App: push com o resultado do cadastro
```

### 4.3 Antecipação self-service (RF-ANT, RF-PAG)

```mermaid
sequenceDiagram
    participant U as Representante
    participant App as App Mobile
    participant BE as Backend
    participant OCR as OCR/IA
    participant BIO as Provedor Biometria
    participant PP as Payproxy
    participant REG as Registradora de recebíveis

    U->>App: envia foto/PDF da Nota Fiscal
    App->>BE: POST /antecipacoes/nota-fiscal
    BE->>OCR: extrai número, tomador, valor, vencimento
    OCR-->>BE: dados extraídos
    BE-->>App: dados extraídos, revisáveis
    U->>App: confirma/corrige os dados da NF
    App->>BE: POST /antecipacoes/nota-fiscal/{id}/confirmar-dados
    App->>BE: POST /antecipacoes/simular
    BE-->>App: valor líquido estimado (deságio + taxa)
    U->>App: solicita a antecipação
    App->>BE: POST /antecipacoes
    BE->>REG: registra a cessão RN-11
    U->>App: assina (leitura facial)
    App->>BIO: 2º fator biométrico
    App->>BE: POST /antecipacoes/{id}/assinar/confirmar
    BE->>PP: emite boleto / QR Pix, aplica split RN-13
    PP-->>BE: linha digitável, QR Code, webhook de confirmação
    BE-->>App: status aguardando_pagamento
    Note over BE,PP: liquidação RF-PAG chega por webhook do Payproxy
```

### 4.4 Antecipação originada por terceiro (RF-TER)

Uma gestora ou um hospital convenente cria a antecipação já preenchida no back-office; o
representante só revisa e decide.

```mermaid
sequenceDiagram
    participant GEST as Gestora / Hospital convenente
    participant BO as Back-office Fynvex
    participant BE as Backend
    participant Push as FCM / APNs
    participant App as App Mobile
    participant U as Representante
    participant BIO as Provedor Biometria

    GEST->>BO: cadastra antecipação já preenchida RF-TER-01
    BO->>BE: cria antecipação (origem=gestora ou hospital_convenio,<br/>status=aguardando_assinatura)
    BE->>Push: notifica o representante RF-TER-02
    Push-->>App: push recebido
    U->>App: abre a notificação, faz login completo
    App->>BE: GET /antecipacoes (o item aparece na lista, RF-TER-03)
    U->>App: revisa os dados, somente leitura RF-TER-04
    alt Aprova
        U->>App: assina, leitura facial RF-TER-05
        App->>BIO: 2º fator biométrico
        App->>BE: POST /antecipacoes/{id}/assinar/confirmar
        BE-->>App: aguardando_pagamento
    else Recusa RF-TER-07
        U->>App: toca "Recusar", sem leitura facial
        App->>BE: POST /antecipacoes/{id}/recusar
        BE-->>App: cancelada — definitivo, sem reversão
    end
```

### 4.5 Recuperação de conta (RF-AUTH-08)

```mermaid
sequenceDiagram
    participant U as Representante
    participant App as App Mobile
    participant BE as Backend
    participant SMTP as Servidor SMTP próprio
    participant BIO as Provedor Biometria

    U->>App: "Perdi meu acesso" — CNPJ + e-mail cadastrado
    App->>BE: POST /auth/recuperacao/iniciar
    BE->>SMTP: envia código de verificação
    SMTP-->>U: e-mail com o código
    U->>App: informa código + nova senha
    App->>BE: POST /auth/recuperacao/confirmar
    BE-->>App: senha atualizada
    U->>App: novo enrollment facial
    App->>BIO: captura facial
    App->>BE: leitura-facial/iniciar + confirmar
    BE-->>App: token de sessão
```

### 4.6 Convite de novo representante (RF-REP)

```mermaid
sequenceDiagram
    participant Admin as Administrador
    participant App as App Mobile
    participant BE as Backend
    participant Conv as Representante convidado
    participant Staff as Equipe Fynvex

    Admin->>App: "Convidar representante" (nome, cpf, cargo, perfil)
    App->>BE: POST /perfil/representantes
    BE-->>App: código de convite
    Admin->>Conv: compartilha o código, fora do app
    Conv->>App: informa código + define senha
    App->>BE: POST /convites/{id}/aceitar
    Conv->>App: documento de identidade + leitura facial
    App->>BE: leitura-facial/iniciar + confirmar (convite)
    BE->>Staff: entra na mesma fila de análise do cadastro original
    Staff->>BE: aprova — status=ativo
    BE-->>Conv: pode logar normalmente RF-AUTH-01
```

---

## 5. Modelo de dados essencial

```mermaid
erDiagram
    EMPRESA ||--o{ REPRESENTANTE : tem
    EMPRESA ||--o{ ANTECIPACAO : "solicita ou recebe"
    ANTECIPACAO ||--|| NOTA_FISCAL : "originada por"
    ANTECIPACAO ||--o| PAGAMENTO : gera
    REPRESENTANTE ||--o{ ANTECIPACAO : assina

    EMPRESA {
        int id
        string cnpj
        string nome_fantasia
        string kyc_status
        string contrato_mae_status
    }
    REPRESENTANTE {
        int id
        int empresa_id
        string nome
        string cpf
        string email
        string perfil_acesso "administrador ou operador"
        string status "ativo, pendente_analise ou inativo"
    }
    ANTECIPACAO {
        int id
        int empresa_id
        string origem "self, gestora ou hospital_convenio"
        string status
        int assinado_por_representante_id
        decimal valor_bruto
        decimal valor_liquido
    }
    NOTA_FISCAL {
        int id
        string numero
        string tomador
        decimal valor
        date data_vencimento
    }
    PAGAMENTO {
        int id
        string linha_digitavel
        string qr_code_pix
        string status
    }
```

O ponto que esse modelo resolve: representante é pessoa, não é empresa/CNPJ. Sessão, senha e
template biométrico são todos por `REPRESENTANTE`; `EMPRESA` é só o titular do CNPJ e das
antecipações. `origem` é o que diferencia uma antecipação self-service de uma originada por
terceiro, sem precisar de uma tabela ou status paralelo — reaproveita o mesmo ciclo de vida
(seção 1.9 da especificação) nos dois casos.

---

## 6. Segurança do cliente móvel (seção 2.5 da especificação)

```mermaid
graph TD
    APP["App Mobile"]
    APP --- A["Certificate pinning<br/>RNF-16"]
    APP --- E["Detecção de root / jailbreak / emulador<br/>RNF-17"]
    APP --- B["Interceptor central de 401<br/>RNF-18"]
    APP --- C["Timeout de sessão em background<br/>5 min → nova facial — RNF-19"]
    APP --- D["Keychain WHEN_UNLOCKED_THIS_DEVICE_ONLY<br/>RNF-20"]
    APP --- F["Build de release ofuscada e assinada<br/>RNF-21"]
    APP --- G["Redação de dados sensíveis em logs<br/>RNF-22"]
```

Cada um desses controles é independente dos demais — nenhum supre a ausência de outro. A seção 2.5
da especificação usa o `payproxy-app` como piso, não como teto: vários itens ali (biometria de app
implementada mas nunca acionada, timeout de sessão sem listener, build de release assinada com
keystore de debug) precisam ser corrigidos aqui, não só copiados.

---

## 7. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | React Native 0.86.2 |
| Linguagem | TypeScript |
| Navegação | React Navigation 7 (`native`, `bottom-tabs`, `native-stack`) |
| Estado global | Zustand |
| Armazenamento seguro | `react-native-keychain` |
| Cache offline | `@react-native-async-storage/async-storage` |
| Push notifications | `@react-native-firebase/messaging` (FCM HTTP v1) |
| Ícones | `react-native-vector-icons/MaterialCommunityIcons` |
| HTTP | Axios via `src/api/client.ts` |
| Estilos | `StyleSheet.create` puro, sem biblioteca de UI externa |
| Backend | Laravel 12 / PHP — `sistema-fynvex` (`antecipacao-develop`) |

---

## 8. Integrações externas — o que precisa ser contratado

| Integração | Finalidade | Situação |
|---|---|---|
| Provedor de biometria facial (candidato: AWS Rekognition Face Liveness) | Liveness no login, 2º fator de assinatura, face match do documento de identidade (RF-BIO-09) | **A contratar** — única decisão de fornecedor de fato aberta |
| OCR/IA de documentos | Extração de dados do Contrato Social e da Nota Fiscal | Já existe como código na aplicação web da Fynvex; exposto ao app via API do próprio backend |
| Payproxy | Boleto, QR Pix, split (Fynvex + cashback do parceiro), webhook de confirmação | Já é uma solução interna, usada por outros produtos da Fynvex |
| Autentique | Assinatura eletrônica formal do Termo de Cessão e do Contrato-Mãe | Já integrado ao backend, orquestrado sem etapa visível no app |
| Firebase Cloud Messaging / Apple Push Notification service | Push notifications, inclusive as que levam à aprovação de antecipação de terceiro (RF-TER-02) | Padrão de mercado, mesma stack do `payproxy-app` |
| WhatsApp Business API | Espelho de notificações de status e canal de suporte N2 | A confirmar contratação/escopo |
| Plataforma DC/ABM, parceiros, gestoras e hospitais convenentes | Vínculo de parceiro, deep links, origem de antecipações de terceiro | Já existe, inteiramente no back-office |
| Registradora de recebíveis | Registro da cessão para prevenção de dupla cessão (RN-11) | Nome genérico na especificação — fornecedor específico ainda não escolhido |
| Servidor SMTP próprio da Fynvex | Código de recuperação de conta (RF-AUTH-08), e-mails de resultado de KYC (RF-KYC-03/04) | Já existe — infraestrutura interna, não um provedor novo |

A tabela completa, com o sentido de cada integração (entrada/saída/bidirecional), está na seção 5
da especificação — este documento acrescenta a coluna "situação" para deixar claro o que
efetivamente falta contratar.
