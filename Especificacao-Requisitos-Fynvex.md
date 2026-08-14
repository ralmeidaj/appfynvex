# Especificação de Requisitos — App Fynvex (Cadastro e Antecipação para Profissionais de Saúde)

## Contexto

A Fynvex opera hoje a antecipação de recebíveis de profissionais de saúde por meio de
um back-office administrativo (sistema `antecipacao`, Laravel), operado inteiramente pela equipe
interna. Não existe hoje um canal self-service para a empresa se cadastrar, enviar documentos ou
solicitar uma antecipação sem intervenção manual da equipe Fynvex.

Este documento especifica os requisitos de um **aplicativo móvel self-service para profissionais
de saúde (pessoa jurídica)** — cadastro simplificado com leitura automática de documentos por IA,
autenticação por senha (lembrada pelo dispositivo) + leitura facial, suporte a múltiplos
representantes por empresa (RF-REP), solicitação de antecipação a partir de Nota Fiscal (própria
ou originada por uma gestora/hospital convenente, RF-TER) e acompanhamento da liquidação — bem
como os **endpoints de integração** que precisam ser criados no backend existente da Fynvex para
sustentar essas funcionalidades. O escopo cobre exclusivamente pessoa jurídica: não há cadastro de
médico autônomo como pessoa física.

O aplicativo é também o canal de originação da parceria estratégica entre a Fynvex e a
Associação Bahiana de Medicina (ABM): PJs médicas vinculadas ao Departamento de Convênios (DC)
da ABM podem se cadastrar declarando esse vínculo, e a plataforma do DC pode originar
solicitações diretamente (deep link para o app). A parte operacional dessa parceria que roda
inteiramente no backoffice — cadastro de parceiros/gestoras, split de pagamento, cashback,
dashboard e prestação de contas do DC — é mencionada aqui apenas nos pontos em que afeta o
contrato de API ou o comportamento do app; o restante é responsabilidade exclusiva do backend
(ver "Fora de Escopo").

---

## 1. Requisitos Funcionais

### 1.1 Autenticação e Sessão

> **Nota de arquitetura**: a autenticação é por **CPF + senha** — não pelo CNPJ da empresa. O CPF
> é pessoal e já identifica **qual** representante está entrando, mesmo numa empresa com mais de
> um (RF-REP-01/02) — não há tela adicional de seleção, nem é preciso informar o CNPJ da empresa
> antes da senha. A leitura facial **não faz parte do login nem da retomada de sessão** — ela é
> exclusiva do momento de assinar algo: solicitar/assinar uma antecipação (RF-ANT-07), assinar o
> Contrato-Mãe (RF-MAE-02) ou aprovar uma antecipação de terceiro (RF-TER-05). O CNPJ continua
> existindo no app, só que exclusivamente no cadastro (RF-CAD-01) — nunca no login.

**RF-AUTH-01** O sistema deve autenticar o usuário por **CPF + senha**. A senha é criada uma
única vez por representante (no cadastro original, RF-CAD-01, ou no aceite de convite,
RF-REP-03) — não há um formulário de "criar senha" recorrente nem tela de troca de senha no dia
a dia.

**RF-AUTH-02** Ao informar o CPF na tela de login, o sistema deve verificar se existe um
representante ativo com esse CPF e retornar o status do cadastro da empresa vinculada a ele
(`none` / `pending` / `approved` / `rejected`) antes de solicitar a senha. Esta consulta é
limitada a 5 tentativas por 15 minutos por dispositivo (RNF-08), para não servir de ferramenta de
enumeração de CPFs cadastrados.

**RF-AUTH-03** A senha informada é comparada contra a senha cadastrada do representante
identificado pelo CPF (RF-AUTH-02). Falha na verificação deve permitir nova tentativa sem
bloqueio, exceto após 5 tentativas consecutivas malsucedidas em 15 minutos (ver RNF-08). Um login
bem-sucedido não envolve leitura facial nenhuma — ela é exclusiva do momento de assinar algo
(RF-BIO-03).

**RF-AUTH-04** Autenticação bem-sucedida emite um **token de sessão (JWT)** com validade
configurável (padrão: 7 dias), armazenado de forma segura no dispositivo (keychain/keystore).

**RF-AUTH-04a Senha lembrada por dispositivo**: no primeiro login bem-sucedido num dispositivo, o
app salva a senha usada — preferencialmente através do **gerenciador de senhas nativo do sistema
operacional** (Autofill/Credential Manager no Android, Keychain no iOS), não só num
armazenamento próprio do app, para que o teclado já sugira a senha salva em logins futuros — além
de guardá-la também no mesmo local seguro do token (RNF-20), nunca em texto claro, nunca
sincronizada em backup de nuvem. Em logins seguintes nesse mesmo dispositivo (seja por reabertura
do app, seja porque o token de sessão expirou), o app reenvia essa senha automaticamente e entra
**sem pedir nada ao usuário** — nem CPF, nem senha, nem leitura facial. Digitar CPF e senha só
volta a ser exigido após logout explícito (RF-AUTH-07), troca/reinstalação do app, ou uso do
fluxo "Entrar com outro usuário" no mesmo aparelho.

**RF-AUTH-05** Se o CPF não pertencer a nenhum representante (`kyc_status = none`), o app deve
informar claramente que nenhum cadastro foi encontrado e oferecer o caminho para "Novo cadastro",
sem permitir acesso ao restante do app.

**RF-AUTH-06** Se o cadastro da empresa existir mas ainda estiver em análise (`kyc_status =
pending`), o login autenticado deve direcionar à tela de acompanhamento de análise, não à tela
principal.

**RF-AUTH-07** O logout deve invalidar o token de sessão no backend (blacklist/revogação) **e**
apagar a senha lembrada localmente (RF-AUTH-04a) — não apenas remover o token do dispositivo. Um
logout incompleto (só o token) deixaria o próximo "login" reenviar a senha lembrada
silenciosamente e abrir direto no app sem pedir nada, mesmo depois do usuário ter pedido
explicitamente para saír.

**RF-AUTH-08 Recuperação de conta**: cobre tanto senha esquecida quanto o cenário de perda/troca
do aparelho (a senha lembrada, RF-AUTH-04a, só existe no dispositivo antigo). Não é um novo
cadastro — a pessoa já passou pela verificação de documento e revisão da equipe Fynvex
(RF-KYC-02) uma vez; recuperar conta não repete isso, só restabelece a credencial.

Fluxo: a partir da tela de login, uma opção "Perdi meu acesso" pede **CPF + e-mail cadastrado** do
representante (RF-REP-07). O backend confirma que aquele e-mail pertence a um representante
`ativo` e envia um **código de verificação por e-mail, válido por 15 minutos** — segundo fator
equivalente ao facial, não um substituto mais fraco (por isso a existência de senha, RF-AUTH-01,
não resolve isso por conta própria: permitir login só por senha sem nenhum segundo fator abriria
mão da autenticação forte pra sempre, não só pro caso de recuperação). Confirmado o código, o app
permite **definir uma nova senha e refazer a leitura facial** (novo template, substituindo o
antigo) — diferente do login do dia a dia, recuperar conta é sensível o bastante pra justificar a
facial de novo, no mesmo espírito de RF-BIO-03. O código de e-mail segue o mesmo limite de
tentativas de RNF-08 (5 tentativas/15 min) para não abrir uma segunda porta de força bruta.

Diferença deliberada em relação ao convite de um novo representante (RF-REP-03): ali é uma
identidade nova entrando, por isso passa pela revisão da equipe Fynvex; aqui é a **mesma pessoa
já verificada** restabelecendo acesso — não há uma segunda revisão manual.

---

### 1.2 Cadastro da Empresa (Onboarding)

#### 1.2.1 CNPJ e Documentos

**RF-CAD-01** O cadastro inicial deve coletar: CNPJ, **e-mail do responsável legal** (obrigatório
— único uso hoje é a recuperação de conta, RF-AUTH-08; não há newsletter/marketing por e-mail
neste documento), upload do **Contrato Social** (obrigatório) e upload de **documento de
identidade com foto do responsável legal** — RG ou CNH (obrigatório). O upload de **Procuração**
é opcional, aplicável somente quando a assinatura da empresa ocorrer
por procurador. Não é exigido upload separado de Cartão CNPJ — o CNPJ já é extraído do Contrato
Social pela leitura automática (RF-CAD-05).

**RF-CAD-01a Formato alfanumérico de CNPJ**: o campo de CNPJ do cadastro inicial aceita tanto o
formato numérico (14 dígitos) quanto o formato alfanumérico da Receita Federal (12 caracteres
alfanuméricos + 2 dígitos verificadores numéricos, em vigor desde julho de 2026) — o teclado do
campo não é restrito a numérico, e a checagem de "campo completo" passa a ser 14 caracteres
(dígito ou letra nas 12 primeiras posições, dígito nas 2 últimas), não mais "14 dígitos". A
máscara visual (`XX.XXX.XXX/XXXX-XX`) não muda, só os caracteres aceitos em cada posição.

> **Nota de implementação (backend)**: o backend real (`sistema-fynvex`) tem hoje uma função de
> validação de dígito verificador de CNPJ (`Utils::validaCPF`, `app/Helpers/Utils.php`) que
> descarta caracteres não numéricos antes de calcular o dígito verificador — ela não reconhece o
> formato alfanumérico. Não é chamada em nenhum lugar do código hoje (função morta), mas a
> validação de CNPJ escrita para o endpoint `POST /cadastro` (o único da seção 4 que ainda lida
> com CNPJ — o login usa CPF, RF-AUTH-01) precisa implementar o algoritmo de dígito verificador do
> formato novo — não reaproveitar essa função como está.

**RF-CAD-02** Nenhum outro dado deve ser solicitado manualmente nesta etapa (sem formulário de
razão social, endereço ou responsável legal digitado pelo usuário) — as únicas exceções são o
e-mail (RF-CAD-01, digitado porque não existe em nenhum documento pra extrair) e o vínculo com
parceiro (opcional), ver 1.2.4.

**RF-CAD-03** Arquivos aceitos para Contrato Social, documento de identidade e Procuração: PDF,
JPG ou PNG, até 10 MB por arquivo.

**RF-CAD-04** O botão de envio só é habilitado quando o CNPJ estiver preenchido e o Contrato
Social e o documento de identidade estiverem anexados.

#### 1.2.2 Leitura Automática por IA

**RF-CAD-05** Após o envio, o sistema deve processar o Contrato Social por um serviço de
extração de dados (OCR/IA) e identificar automaticamente: razão social, nome fantasia, endereço
e dados do responsável legal (nome, CPF, cargo).

**RF-CAD-06** O tempo de processamento da leitura deve ser comunicado ao usuário com indicador de
carregamento; o app deve consultar o status periodicamente até a conclusão (polling) ou receber
atualização assíncrona.

**RF-CAD-07** Os dados extraídos devem ser exibidos ao usuário para **revisão e confirmação**
antes de seguir no fluxo. O usuário pode corrigir qualquer campo identificado incorretamente
antes de confirmar.

**RF-CAD-08** Falha na extração (documento ilegível, formato inválido) deve permitir reenvio do
documento sem reiniciar o cadastro do zero.

**RF-CAD-08a** O documento de identidade do responsável (RF-CAD-01) não passa por **extração de
texto** automática (OCR) — nesse sentido é anexado como a Procuração. Ele passa, sim, por
**validação facial automática** contra a leitura facial do cadastro (RF-BIO-09); o resultado
dessa comparação é insumo para a análise manual da equipe Fynvex (RF-KYC-02), não a substitui.

#### 1.2.3 Conclusão do Cadastro

**RF-CAD-09** O cadastro só é enviado para análise da equipe Fynvex após: dados extraídos
confirmados (RF-CAD-07) + leitura facial cadastrada (RF-BIO) + dados bancários informados
(RF-BANK) + termos de uso aceitos (RF-TERM).

**RF-CAD-10** Ao concluir as etapas acima, o status do cadastro muda para `pending` e o usuário é
direcionado à tela de acompanhamento de análise (RF-KYC-01). A resposta de `aceite-termos` (seção
4.2) já inclui um token de sessão — o app autentica o usuário nesse momento, sem exigir uma chamada
de login separada logo após o cadastro.

#### 1.2.4 Vínculo com Parceiro (opcional)

**RF-CAD-11** Durante o cadastro, a PJ pode **autodeclarar** vínculo com um parceiro de
originação — hoje o Departamento de Convênios (DC) da Associação Bahiana de Medicina (ABM);
futuramente outras gestoras/contabilidades parceiras. O campo é um texto/código de parceiro,
opcional, exibido junto aos dados bancários (RF-BANK) e não é validado de forma síncrona pelo
app. Uma PJ (médico) só pode ter vínculo com **uma** gestora/convênio por vez — o campo é um
único texto/código, não uma lista; declarar um novo código substitui o anterior.

**RF-CAD-12** A autodeclaração de vínculo é validada pelo backend contra a base de PJs do
parceiro de forma assíncrona. Enquanto a validação estiver pendente (`vinculo_status = pendente`),
a operação da PJ segue normalmente, sem qualquer benefício ou restrição associada ao parceiro
(RN-12). Se a validação falhar (PJ não encontrada na base do parceiro), o vínculo passa para
`nao_vinculado` e a PJ é tratada como sem parceiro a partir de então.

**RF-CAD-13** O status do vínculo (`nao_vinculado` / `pendente` / `confirmado`) é exibido no
Perfil (RF-PERF-01) e determina o comportamento da tela de liquidação (RF-PAG-01): PJs com
vínculo `confirmado` têm a liquidação processada pela plataforma do parceiro, sem tela de
pagamento no app; as demais (`nao_vinculado` ou `pendente`) veem a tela de pagamento por
QR/boleto (RF-PAG-02).

**RF-CAD-14** A originação de uma solicitação também pode partir de fora do app: um deep link
vindo da plataforma do parceiro (ex.: botão de antecipação no dashboard do DC) abre o app já
autenticado (ou no login, se a sessão tiver expirado) diretamente na tela de nova solicitação
(RF-ANT-01), atribuindo o vínculo de parceiro automaticamente — sem depender da autodeclaração
de RF-CAD-11. O tratamento de deep link em si (esquema de URL, parâmetros) é detalhe de
implementação do app, não normatizado por este documento.

---

### 1.3 Leitura Facial (Biometria)

**RF-BIO-01** Durante o cadastro, o app deve capturar uma leitura facial do responsável, para uso
exclusivo como segundo fator de assinatura (RF-BIO-03) — não como credencial do login em si
(RF-AUTH-01, que usa só CPF + senha).

**RF-BIO-02** A leitura facial é armazenada como **template biométrico** (não como imagem crua)
no backend, criptografado em repouso (ver RNF-06).

**RF-BIO-03** A leitura facial é **exclusiva do momento de assinar algo** — nunca do login
(RF-AUTH-01) nem da retomada de sessão (RF-AUTH-04a/RNF-19). Ocorre em três momentos: assinatura
de uma solicitação de antecipação (RF-ANT-07), assinatura do Contrato-Mãe (RF-MAE-02) e aprovação
de uma antecipação originada por terceiro (RF-TER-05) — os três reaproveitam o mesmo mecanismo de
captura e verificação. Também é refeita ao final da recuperação de conta (RF-AUTH-08), por ser um
momento sensível equivalente.

**RF-BIO-04** Cada representante de perfil `representante_legal` (RF-REP-01/02) tem seu próprio
template biométrico — não é um template único "da empresa". Uma empresa com múltiplos
representantes desse perfil tem múltiplos templates, um por pessoa; a senha (RF-AUTH-01) é o que
identifica, no momento do login, qual representante está entrando — é esse representante cujo
template será usado quando uma leitura facial for de fato necessária (RF-BIO-03), num momento
posterior e separado do login. Um representante de perfil `visualizador` não tem template
nenhum — ele nunca passa por leitura facial (RF-REP-08).

**RF-BIO-05** O app não deve reter a imagem facial capturada além do tempo necessário para
enviar ao backend; nenhuma imagem biométrica é persistida localmente no dispositivo.

**RF-BIO-06** A captura deve ser uma prova de vivacidade **ativa** (ex.: vídeo curto seguindo um
desafio na tela — virar a cabeça, olhar para um ponto), não uma única foto estática, para
dificultar ataques por foto ou vídeo pré-gravado.

**RF-BIO-07** A decisão de correspondência entre a captura e o template cadastrado deve ser
tomada no backend (diretamente ou via serviço de biometria terceirizado) — o app nunca reporta,
por conta própria, um resultado de correspondência que o backend aceite sem verificação própria.

**RF-BIO-08** O fornecedor de liveness/correspondência facial é uma decisão técnica ainda em
aberto, de responsabilidade de quem implementa o backend (candidato principal: AWS Rekognition
Face Liveness — ver seção 5). Os endpoints da seção 4.1 refletem o fluxo conceitual de um
fornecedor baseado em sessão; nomes de campo exatos podem mudar quando o fornecedor for
confirmado, mas o formato de interação com o app (criar sessão → app captura o desafio
**diretamente com o fornecedor** → backend confirma o resultado) não deve mudar — é o que
preserva a garantia de anti-spoofing da captura ativa (RF-BIO-06).

**RF-BIO-09 Validação facial do documento de identidade**: além de servir como credencial de
login e segundo fator de assinatura (RF-BIO-03), a leitura facial do cadastro (RF-BIO-01) é
comparada (**face match**, capacidade distinta da prova de vivacidade de RF-BIO-06) contra a
foto do documento de identidade enviado (RF-CAD-01) — o resultado (score de correspondência) fica
disponível para a análise da equipe Fynvex (RF-KYC-02) junto dos demais dados do cadastro. Uma
correspondência baixa **não rejeita o cadastro automaticamente** — sinaliza a operação para
revisão manual mais atenta, já que fotos de documento antigas ou de baixa qualidade produzem
falsos negativos com frequência; é a mesma filosofia de "sinaliza para revisão, não bloqueia
sozinho" já aplicada à leitura de Nota Fiscal (RF-ANT-04).

---

### 1.4 Dados Bancários

**RF-BANK-01** O sistema deve coletar: banco (selecionado de lista), agência, conta, tipo de
conta (`corrente` / `poupanca`) e forma de recebimento (`pix` / `ted`).

**RF-BANK-02** Quando a forma de recebimento for `pix`, o campo de chave/código Pix é
obrigatório. O campo aceita **texto livre** (chave CPF/CNPJ, e-mail, telefone ou aleatória) —
não há seletor de tipo de chave.

**RF-BANK-03** Os dados bancários informados no cadastro são os mesmos exibidos e editáveis
posteriormente em Perfil (RF-PERF-03), sem duplicação de cadastro.

**RF-BANK-04** Os dados bancários são utilizados exclusivamente para o crédito dos valores de
antecipação aprovados — não para envio ou recebimento de cobranças.

---

### 1.5 Termos de Uso

**RF-TERM-01** O usuário deve visualizar o texto integral dos Termos de Uso e marcar
explicitamente uma caixa de confirmação ("Li e aceito") antes de poder concluir o cadastro.

**RF-TERM-02** O sistema deve registrar a versão do termo aceito, data/hora do aceite e CNPJ
associado, de forma imutável.

---

### 1.6 Análise e Aprovação do Cadastro (KYC)

**RF-KYC-01** Enquanto o cadastro estiver com status `pending`, o app exibe tela informativa
("Seus documentos estão sendo analisados pela equipe administrativa") sem acesso às demais
funcionalidades.

**RF-KYC-02** A análise dos documentos (Contrato Social, Procuração, dados extraídos) é
realizada pela equipe Fynvex no backoffice existente — este documento não especifica a interface
interna de análise, apenas o contrato de API que ela deve respeitar (ver seção 4).

**RF-KYC-03** A aprovação do cadastro (`kyc_status = approved`) deve disparar uma notificação
push ao dispositivo do usuário informando que o acesso foi liberado.

**RF-KYC-04** A rejeição do cadastro (`kyc_status = rejected`) deve informar ao usuário o motivo
e permitir reenvio de documentos corrigidos, sem necessidade de reiniciar o cadastro do zero.

**RF-KYC-05** A aprovação do cadastro **não gera senha nem credencial adicional** — o próprio
CPF + senha já cadastrados no cadastro original passam a valer como credencial de login (ver
RF-AUTH-01).

---

### 1.7 Tela Início — Lista de Antecipações

**RF-HOME-01** A tela inicial pós-login é a lista de solicitações de antecipação da empresa
("Minhas antecipações"), não um dashboard genérico.

**RF-HOME-02** Cada item da lista exibe: origem/tomador da Nota Fiscal, número da NF, valor
líquido, data prevista de crédito e status atual (ver RF-STATUS-01).

**RF-HOME-03** A tela inicial deve exibir botão de destaque **"+ Nova solicitação"**, sempre
visível, levando ao fluxo de solicitação de antecipação (RF-ANT-01) — passando primeiro pela
assinatura do Contrato-Mãe, caso ainda não tenha sido realizada (RF-MAE-01).

**RF-HOME-04** Itens com status `aguardando_liquidacao` abrem a tela de liquidação (RF-PAG-01).
Itens com status `credito_efetuado` ou `liquidada` abrem uma tela de comprovante (somente
leitura). Os demais status têm sua própria interação especificada em RF-HOME-05 e RF-TER-03 —
nenhum item da lista fica sem nenhuma reação ao toque.

**RF-HOME-05** Itens com status `solicitada` ou `em_analise` exibem ação de
**"Cancelar solicitação"**, disponível diretamente na lista. Itens com status `recusada` exibem
o motivo da recusa (RF-STATUS-06). Itens com status `em_atraso` exibem aviso de atraso do
pagador, sem ação disponível ao usuário (RF-STATUS-08).

---

### 1.8 Solicitar Antecipação — Nota Fiscal

#### 1.8.1 Contrato-Mãe (assinatura única)

**RF-MAE-01** Antes da **primeira** solicitação de antecipação de uma empresa, o app deve
verificar se o **Contrato-Mãe** — acordo-quadro que formaliza a adesão da empresa ao programa de
antecipação de recebíveis da Fynvex — já foi assinado. Se não, o fluxo de nova solicitação começa
por essa tela em vez do envio da Nota Fiscal (RF-ANT-01).

**RF-MAE-02** A assinatura do Contrato-Mãe segue o mesmo mecanismo de RF-ANT-07: exibição do
texto completo (renderizado pelo app como texto nativo, RF-ANT-07a — não o PDF formal), aceite
por checkbox habilitado só após rolar o texto até o fim, e confirmação por segundo fator de
leitura facial.

**RF-MAE-03** Uma vez assinado, o Contrato-Mãe não é solicitado novamente para a mesma empresa —
toda solicitação seguinte (desta ou de outra Nota Fiscal) segue direto para RF-ANT-01. O app não
deve assumir esse estado como permanente sem confirmação do backend (ver RN-09).

#### 1.8.2 Envio da Nota Fiscal

**RF-ANT-01** A solicitação de antecipação é sempre iniciada pelo envio de **uma Nota Fiscal**
— não há seleção a partir de uma lista pré-existente de recebíveis.

**RF-ANT-02** Arquivos aceitos para a Nota Fiscal: PDF, JPG ou PNG, até 10 MB.

**RF-ANT-02a Consentimento para leitura por IA**: antes do envio, o app exibe um termo de
consentimento explícito para o processamento da Nota Fiscal por IA/OCR (checkbox + texto curto,
mesmo padrão visual de outros aceites do app) — sem marcar o aceite, o botão de envio permanece
desabilitado. Cobre especificamente a leitura automática (RF-ANT-03), distinto do Termo de Uso
geral (seção 1.5) e do termo de cessão de cada operação (RF-ANT-07).

**RF-ANT-03** Após o envio, o sistema processa a Nota Fiscal por IA e extrai: número da NF,
tomador/convênio, **CNPJ do tomador**, **link/URL de consulta** (quando a NF for uma NFS-e
eletrônica com esse recurso), valor e datas de emissão e vencimento — mesmo padrão de RF-CAD-05.
O CNPJ do tomador (ou o link, quando disponível) é o que RF-ANT-10/RN-11 usam para identificar
quando duas solicitações se referem à mesma NF (pra somar o saldo já usado contra ela) — sem eles
extraídos e confirmados, a checagem não teria como distinguir tomadores diferentes com o mesmo
número de nota.

**RF-ANT-04** Os dados extraídos da Nota Fiscal devem ser exibidos para **revisão e correção
manual** do usuário antes de seguir para a simulação — mesmo padrão de RF-CAD-07: qualquer campo
identificado incorretamente pela IA pode ser editado antes de confirmar. Se o usuário chegou
aqui a partir do simulador autenticado (RF-SIM-04), valor bruto e vencimento já vêm
pré-preenchidos com o que foi simulado — a extração da IA (quando disponível) prevalece como
sugestão mais nova, mas o campo continua editável do mesmo jeito.

Esta tela distingue dois valores: o **valor total da NF** (extraído/corrigido, campo `valor`) e o
**valor que o usuário quer antecipar nesta operação** (`valor_solicitado`) — que já nasce
pré-preenchido com o **saldo ainda disponível** dessa NF (o valor total, se for a primeira
solicitação contra ela; o valor total menos o que já foi antecipado, se não for — RF-ANT-10),
e continua editável para um valor menor. O usuário nunca precisa calcular a subtração de cabeça
— o campo já chega descontado.

**RF-ANT-05** A simulação exibe: valor bruto, percentual e valor do deságio (RN-01), valor da
taxa administrativa e valor líquido estimado, além da data prevista de crédito. O percentual de
deságio varia com o prazo da Nota Fiscal (RN-01) — não é um valor fixo exibido antes do envio da
NF.

**RF-ANT-06** A tela de revisão final deve exibir todos os valores da simulação mais a
identificação da Nota Fiscal e o destino do crédito (conta bancária ou Pix cadastrado), antes da
assinatura.

**RF-ANT-07** A confirmação da solicitação exige aceite do termo de cessão (checkbox + texto)
seguido de **segundo fator por leitura facial** — mesmo mecanismo de RF-BIO-03. No backend real, o
termo de cessão de cada operação corresponde ao "Contrato Borderô" (`TipoArquivoEnum::CONTRATO_BORDERO`,
assinado via Autentique junto com o Contrato-Mãe) — não existe um terceiro documento além desses
dois; o nome "termo de cessão" usado neste documento é o mesmo instrumento.

**RF-ANT-07a Renderização do texto para leitura, não o PDF final**: o texto completo exigido em
RF-ANT-07 (e, por RF-MAE-02, também no Contrato-Mãe) é renderizado pelo próprio app como texto
nativo, no tamanho de fonte da interface — nunca embutindo o PDF formal gerado para a assinatura
via Autentique (RN-10), cuja diagramação (fonte pequena, texto justificado, margens de impressão)
é pensada para papel/PDF, não para a tela de um celular. O checkbox de aceite só fica habilitado
depois que o usuário rolar o texto até o fim — não basta o texto estar visível na tela. O PDF
formal assinado (o que de fato tramita no Autentique) fica disponível para consulta posterior no
histórico de termos e contratos do Perfil (RF-PERF-05), fora desse momento de leitura.

**RF-ANT-08** Após confirmada a assinatura, a solicitação é criada com status inicial
`solicitada` e o usuário retorna à tela Início (RF-HOME-01), onde a nova solicitação já aparece
na lista.

**RF-ANT-09** Uma solicitação de antecipação está sempre vinculada a exatamente uma Nota Fiscal;
não há solicitação de antecipação sem Nota Fiscal associada.

**RF-ANT-10** A mesma Nota Fiscal (mesmo número + CNPJ do tomador) **pode** lastrear mais de uma
solicitação ativa da mesma empresa — desde que a soma dos valores solicitados (`valor_solicitado`,
RF-ANT-04) não supere o valor total da NF (RN-11). Exemplo: uma NF de R$ 10.000 com R$ 5.000 já
antecipados em outra solicitação ativa tem R$ 5.000 de saldo disponível para uma nova. Uma
tentativa de solicitar mais do que esse saldo é rejeitada na criação da solicitação, informando o
saldo restante e a(s) solicitação(ões) já ativas contra a mesma NF.

**RF-ANT-11** Quem efetivamente paga o boleto de liquidação da operação depende do vínculo de
parceiro da empresa (RF-CAD-11/RN-12): com vínculo `confirmado`, a liquidação é feita pela
plataforma do parceiro — é o tomador quem paga por lá, e o app apenas reflete o status. **Sem
vínculo confirmado, é a própria PJ (o médico) quem paga o boleto de liquidação** — o app expõe a
tela de pagamento (RF-PAG-01/02) pra isso, não só para acompanhar. Nem toda PJ tem vínculo com um
parceiro da Fynvex (RF-CAD-11 é uma autodeclaração opcional); esse é o caminho padrão para quem
não tem.

---

### 1.9 Ciclo de Status da Antecipação

**RF-STATUS-01** Toda solicitação de antecipação segue um dos dez status, mutuamente
exclusivos:

| Status | Significado | Ação do usuário |
|---|---|---|
| `aguardando_assinatura` | Só ocorre para antecipação originada por terceiro (RF-TER-01) — já criada, aguardando o representante assinar | Aprovar (RF-TER-05) ou recusar (RF-TER-07) |
| `solicitada` | Enviada pelo usuário, aguardando início da análise | Cancelar solicitação |
| `em_analise` | Análise de crédito em curso pela equipe Fynvex (SLA: RN-08) | Cancelar solicitação |
| `aprovada` | Resultado positivo da análise; crédito em processamento | — |
| `recusada` | Resultado negativo da análise, com motivo (RF-STATUS-06) | — |
| `credito_efetuado` | Valor líquido pago na conta/Pix da PJ (RN-07) | Ver comprovante |
| `aguardando_liquidacao` | Boleto de liquidação emitido; aguardando pagamento pelo tomador/parceiro | Ver pagamento (RF-PAG-01), quando aplicável |
| `liquidada` | Boleto pago; operação encerrada com sucesso | Ver comprovante |
| `em_atraso` | Tomador não liquidou no vencimento | — (RF-STATUS-08) |
| `cancelada` | Cancelada pelo próprio usuário | — |

**RF-STATUS-02** As transições válidas são:
`aguardando_assinatura → solicitada` (RF-TER-05, aprovação) `|cancelada` (RF-TER-07, recusa);
`solicitada → em_analise → aprovada|recusada`;
`aprovada → credito_efetuado → aguardando_liquidacao → liquidada|em_atraso`;
`em_atraso → liquidada` (liquidação recuperada fora do prazo);
`solicitada|em_analise → cancelada` (cancelamento pelo usuário).
Nenhuma outra transição é permitida.

**RF-STATUS-03** As transições `em_analise → aprovada|recusada` e `aguardando_liquidacao →
liquidada|em_atraso` são realizadas pela equipe Fynvex/backoffice ou por webhook do provedor de
boletos (RF-PAG-04) — nunca por ação direta do app, que apenas reflete o status corrente. A
transição `aprovada → credito_efetuado → aguardando_liquidacao` é automática, disparada pelo
próprio backend ao processar o crédito (RN-03: até 1 dia útil após aprovação).

**RF-STATUS-04** A transição para `aprovada`/`credito_efetuado` e para `aguardando_liquidacao`
deve disparar notificação push ao usuário — ver RF-PUSH-02 para a lista completa de eventos.

**RF-STATUS-05** O usuário só pode cancelar (`→ cancelada`) enquanto o status for `solicitada`
ou `em_analise`. A partir de `aprovada`, a solicitação é irrevogável pelo usuário — apenas os
estados terminais (`recusada`, `liquidada`, `cancelada`) não têm mais transição possível. O
status `aguardando_assinatura` não é cancelável por essa ação — a decisão ali é aprovar ou
recusar (RF-TER-05/07), não cancelar.

**RF-STATUS-06** O status `recusada` deve ser acompanhado de motivo, visível ao usuário na
lista/detalhe da solicitação.

**RF-STATUS-07** O status de liquidação (`aguardando_liquidacao` → `liquidada`) é uma
propriedade da própria solicitação (não uma entidade de cobrança separada). Reflete o pagamento
do boleto — pelo tomador, via plataforma do parceiro, quando há vínculo `confirmado`; pela
própria PJ, quando não há (RF-ANT-11, RF-PAG).

**RF-STATUS-08** O status `em_atraso` é apenas informativo para o usuário no MVP — a tratativa
de cobrança do tomador em atraso ocorre fora do app (backoffice/parceiro), conforme RN-09.

---

### 1.10 Liquidação da Operação

> **Nota de arquitetura**: a taxa administrativa é **exclusivamente** descontada do valor líquido
> na simulação (RF-ANT-05) — não há cobrança avulsa dela ao usuário, em nenhum momento. Já o
> boleto de liquidação desta seção é outra coisa: resgata o valor bruto que a Fynvex adiantou, e
> quem o paga depende do vínculo de parceiro da empresa (RF-ANT-11) — o tomador da Nota Fiscal,
> através da plataforma do parceiro, quando o vínculo é `confirmado`; a própria PJ (médico)
> diretamente, quando não é.

**RF-PAG-01** Uma solicitação com status `aguardando_liquidacao` expõe uma tela de
acompanhamento específica daquela solicitação, exibindo: valor da Nota Fiscal, tomador, data de
vencimento e status de liquidação (`pending` / `paid`). O conteúdo exibido depende do vínculo de
parceiro da empresa (RF-CAD-13):
- Vínculo `confirmado`: apenas o status — a liquidação corre pela plataforma do parceiro
  (RF-ANT-11), sem ação disponível no app.
- Vínculo `nao_vinculado` ou `pendente`: a tela exibe também o QR Code/boleto (RF-PAG-02) — não é
  só acompanhamento, é o boleto que a própria PJ paga, já que não há parceiro para fazer isso por
  ela (RF-ANT-11).

**RF-PAG-02** Quando exibido (RF-PAG-01), o boleto de liquidação deve ser oferecido em **dois
formatos simultâneos**: QR Code Pix e código de barras, ambos com opção de cópia do respectivo
código (copia-e-cola / linha digitável) para a área de transferência.

**RF-PAG-03** O QR Code e o código de barras devem ser gerados/obtidos a partir do provedor de
boletos/split integrado (ver seção 4) — o app não gera esses códigos localmente.

**RF-PAG-04** A confirmação efetiva da liquidação ocorre por **webhook do provedor de
boletos/split** ao backend, nunca por ação direta do app. O app apenas exibe o status mais
recente retornado pelo backend e é notificado (push) quando a liquidação é confirmada. O mesmo
webhook aciona o split automático: parcela da Fynvex e cashback do parceiro (quando houver
vínculo `confirmado`) creditado diretamente na conta do parceiro — sem trânsito pela Fynvex nem
visibilidade no app (RN-13).

**RF-PAG-05** Após a liquidação confirmada, a tela passa a exibir aviso de confirmação em vez
das opções de QR Code/código de barras (ou do status pendente, quando o vínculo for
`confirmado`).

**RF-PAG-06** O status de liquidação (`pending`/`paid`) é uma propriedade da própria solicitação
de antecipação (RF-STATUS-07), não uma entidade de cobrança separada.

---

### 1.11 Perfil

**RF-PERF-01** A tela de Perfil exibe: nome (razão social/nome fantasia), CNPJ, status de cada
documento do cadastro (Contrato Social, documento de identidade, Procuração, Leitura facial) e
o status do vínculo com parceiro (RF-CAD-13), quando declarado.

**RF-PERF-02** A tela de Perfil oferece acesso a "Meus dados bancários", reaproveitando os
mesmos campos de RF-BANK-01, em modo de edição.

**RF-PERF-03** Alteração dos dados bancários no Perfil deve valer para futuras antecipações,
sem afetar solicitações já criadas (snapshot — ver RN-06).

**RF-PERF-04** O Perfil oferece ação de "Sair", que executa o logout (RF-AUTH-07).

**RF-PERF-05** O Perfil oferece acesso ao suporte (RF-SUP-01) e ao histórico de termos/contratos
assinados (Termo de Uso, Contrato-Mãe, Termos de Cessão de cada operação).

---

### 1.12 Notificações Push

**RF-PUSH-01** O app deve registrar o token de notificação push do dispositivo junto ao backend
imediatamente após o primeiro login bem-sucedido.

**RF-PUSH-02** Eventos que disparam notificação push ao usuário:
- Cadastro aprovado (RF-KYC-03)
- Cadastro rejeitado (RF-KYC-04)
- Solicitação aprovada / crédito efetuado (RF-STATUS-04)
- Solicitação recusada, com motivo (RF-STATUS-06)
- Boleto de liquidação emitido (`aguardando_liquidacao`)
- Liquidação confirmada (RF-PAG-04)
- Nova antecipação originada por gestora ou hospital convenente, aguardando aprovação (RF-TER-02)

**RF-PUSH-03** A falha no registro do token de push não deve impedir o uso do app — é uma
funcionalidade de melhor esforço.

**RF-PUSH-04** Todo evento de RF-PUSH-02 deve também ser espelhado no WhatsApp oficial da
Fynvex (número/conta cadastrado no perfil do usuário), como canal complementar ao push — ver
integração na seção 5. A falha no espelhamento por WhatsApp não deve impedir ou atrasar o envio
do push (RF-PUSH-03 aplica-se igualmente aqui).

---

### 1.13 Suporte

**RF-SUP-01** O app deve oferecer acesso direto ao suporte via **WhatsApp Business** (N2 Fynvex)
e um FAQ embutido, acessível a partir do Perfil (RF-PERF-01). Para PJs com vínculo de parceiro
`confirmado` (RF-CAD-13), a orientação de primeiro nível (N1) é feita pelo próprio parceiro
(ex.: Departamento de Convênios), fora do app — o app não precisa distinguir esse caso na UI,
apenas manter o canal N2 sempre disponível como alternativa.

---

### 1.14 Simulador Aberto (Pré-login)

**RF-SIM-01** O app deve oferecer um simulador acessível **sem cadastro e sem login**, a partir
da tela de entrada (RF-AUTH-05 aplica-se apenas ao fluxo autenticado — este é um fluxo paralelo,
não um substituto). O usuário informa valor bruto da Nota Fiscal e data de vencimento; o app
exibe o valor líquido estimado com os mesmos componentes de RF-ANT-05 (deságio, taxa
administrativa), calculados pelo mesmo motor de RN-14 — nunca uma cópia/aproximação local da
fórmula.

**RF-SIM-02** Ao final da simulação, o app exibe uma chamada para ação ("Cadastre-se e receba em
até 24h úteis") que leva ao fluxo de novo cadastro (RF-CAD-01), sem perder os valores já
simulados.

**RF-SIM-03** O resultado do simulador não é persistido nem vinculado a nenhuma Nota Fiscal real
— é puramente ilustrativo até que o usuário efetivamente envie uma Nota Fiscal (RF-ANT-01) já
autenticado.

**RF-SIM-04 Simulador também para usuário autenticado**: o mesmo simulador (RF-SIM-01) é
acessível a partir da Home, já logado — não só pré-login. Autenticado, o botão final muda de
"Cadastre-se" (RF-SIM-02) para "Solicitar com estes valores", que leva a RF-ANT-01 (upload da
Nota Fiscal) levando valor bruto e data de vencimento simulados como **preenchimento inicial**
da revisão (RF-ANT-04) — nunca uma substituição da Nota Fiscal real: a leitura por IA
(RF-ANT-03) e a correção manual do usuário sempre podem sobrescrever esses valores. A simulação
não deixa de precisar de uma NF real por trás (RN-02) — só evita que o usuário digite os mesmos
números duas vezes.

---

### 1.15 Perfis de Acesso e Múltiplos Representantes

Uma empresa pode ter mais de uma pessoa com acesso próprio ao app. O que cada uma pode fazer
depende do seu **perfil de acesso**, e os dois perfis existem por um critério jurídico, não
administrativo: quem pode comprometer a empresa financeiramente (solicitar, assinar, mover dados
bancários) versus quem só acompanha.

**RF-REP-01** O primeiro representante de uma empresa é quem conclui o cadastro original
(RF-CAD-01) — o responsável legal identificado no Contrato Social. Nasce com perfil de acesso
`representante_legal`, sem convite nem etapa adicional além da já exigida pelo cadastro
(RF-KYC-02).

**RF-REP-02** Existem dois perfis de acesso: `representante_legal` e `visualizador`.
- `representante_legal`: solicita e assina antecipações (RF-ANT-01/07), edita dados bancários
  (RF-PERF-02), declara/altera vínculo de parceiro (RF-CAD-11) e convida novos representantes de
  qualquer um dos dois perfis (RF-REP-03). Tem senha própria e leitura facial cadastrada
  (RF-BIO-04) — entra pelo mesmo login de RF-AUTH-01.
- `visualizador`: só acompanha a lista de antecipações já feitas (mesma tela de RF-HOME-01, sem
  nenhuma ação de solicitar/assinar/recusar disponível) e não vê dados bancários. Entra pelo
  mesmo login de CPF + senha de RF-AUTH-01 — nunca passa por leitura facial, não porque seu login
  seja diferente, mas porque nunca chega a uma ação que a exija (RF-BIO-03/RF-REP-08).

**RF-REP-03** Só um `representante_legal` pode convidar um novo representante, de qualquer um dos
dois perfis — o convite se ramifica em dois fluxos bem diferentes conforme o perfil escolhido:

- **Convite de `representante_legal`** (ex.: um sócio com procuração própria, que vai também
  poder solicitar/assinar): o convidado passa pelo mesmo cadastro biométrico de qualquer
  representante_legal — define senha, faz sua própria leitura facial (RF-BIO-01), envia seu
  documento de identidade (mesma validação facial de RF-BIO-09) e **anexa sua Procuração**
  (mesmo tipo de documento de RF-CAD-01, aplicável por procurador) — e só fica `ativo` após
  revisão da equipe Fynvex, o **mesmo gate de RF-KYC-02** do cadastro original. Isso é
  deliberado: sem essa revisão, um representante_legal comprometido poderia criar outros com
  poder idêntico sem nenhuma checagem externa.
- **Convite de `visualizador`** (um sócio que só quer acompanhar): quem convida já informa o
  **CPF** do convidado no próprio convite (é o identificador de login, RF-AUTH-01 — sem isso a
  pessoa nunca conseguiria entrar depois). O convidado recebe um código por e-mail (mesmo
  mecanismo de RF-AUTH-08), define sua senha a partir dele, e fica `ativo` **imediatamente** —
  sem leitura facial, sem envio de documento, sem revisão da equipe Fynvex. Isso também é
  deliberado, na direção oposta: como esse perfil não pode mover dinheiro nem alterar nada, o
  gate pesado do outro fluxo não se justifica aqui.

**RF-REP-04** Nunca deixar a empresa sem nenhum representante `representante_legal` ativo.
Qualquer ação que resultaria nisso (remover o último, ou rebaixá-lo a `visualizador`, ou
desativá-lo) deve ser bloqueada com mensagem clara, independente de quem a solicitou.

**RF-REP-05** Remover ou desativar um representante invalida imediatamente a sessão ativa dele
(mesmo mecanismo de revogação de RF-AUTH-07) — a pessoa removida não deve manter acesso pelo
resto da validade do token só porque já estava logada.

**RF-REP-06** O Perfil (RF-PERF-01) exibe os dados do representante logado (nome, cargo, perfil
de acesso) além dos dados já existentes da empresa. A entrada "Gerenciar representantes" aparece
para os dois perfis — listar quem tem acesso à empresa não é uma ação restrita (a consulta
correspondente é aberta a qualquer perfil ativo). O que fica restrito a `representante_legal` são
as ações dentro dessa tela: convidar, alterar perfil de acesso e remover/desativar um
representante — um `visualizador` só acompanha a lista, sem nenhum desses botões disponíveis.

**RF-REP-07** Todo representante tem um e-mail próprio — coletado no cadastro original (RF-CAD-01,
primeiro representante) ou no convite (RF-REP-03, demais). Serve à recuperação de conta
(RF-AUTH-08) e, no convite de `visualizador`, ao código que ativa a conta (RF-REP-03) — não é o
identificador de login em nenhum dos dois perfis, que é sempre o **CPF** (RF-AUTH-01). Não há
envio de comunicação de marketing em nenhum caso.

**RF-REP-08 Não existe um login separado para o visualizador**: os dois perfis entram pelo mesmo
CPF + senha (RF-AUTH-01) — não há tela de login alternativa nem campo de e-mail na entrada. A
diferença entre eles está inteiramente em quais ações ficam disponíveis depois (RF-REP-02): um
`visualizador` nunca vê leitura facial simplesmente porque nunca chega a uma ação que a exija
(RF-BIO-03), não porque seu CPF leve a um fluxo de autenticação diferente. Isso é proporcional ao
risco de cada perfil: um `visualizador` não pode mover dinheiro nem alterar nada, só visualizar —
exigir dele o mesmo padrão de segurança forte de quem assina antecipações não faria sentido.

> Nota de simplificação: como o login é por CPF (RF-AUTH-01), que já é pessoal por natureza, nunca
> existe uma tela adicional para "escolher quem é você" — o próprio CPF já identifica exatamente
> qual representante está entrando, mesmo numa empresa com vários. Isso também evita ter que
> expor, antes da autenticação, uma lista de nomes de quem trabalha em determinada empresa a
> partir só do CNPJ — informação que, aliás, o login nem usa mais (RF-AUTH-01).

---

### 1.16 Antecipação Originada por Terceiro (Gestora ou Hospital Convenente)

Além da solicitação self-service (RF-ANT-01, o representante sobe a Nota Fiscal e revisa os
dados), uma antecipação pode ser **originada por um terceiro autorizado**, que já preenche todos
os dados da operação num sistema à parte — fora deste app. Dois terceiros possíveis:
- uma **gestora** que administra a empresa (mesmo vínculo de parceiro de RF-CAD-11), pelo próprio
  sistema web já usado por gestoras hoje;
- um **hospital/tomador com convênio próprio com a Fynvex** — aqui o hospital é ao mesmo tempo o
  tomador da NF (RF-ANT) *e* quem originou a solicitação, papel que RF-CAD-11/RN-12 não cobrem
  (lá o parceiro só atribui cashback; aqui ele efetivamente cria a operação).

A administração desses convênios/vínculos (cadastro do terceiro, credenciais do sistema que
cria a operação) é inteiramente backoffice — fora do escopo deste app, mesmo critério já
aplicado à administração de parceiros/gestoras (ver Fora de Escopo).

**RF-TER-01** Uma antecipação originada por terceiro chega ao app já com todos os dados
preenchidos (NF, tomador, valor, vencimento, deságio) — o representante da empresa não faz
upload nem simula nada; ele **revisa e decide**: aprovar (RF-TER-05) ou recusar (RF-TER-07).

**RF-TER-02** Ao ser originada, a operação nasce no mesmo estado interno que uma solicitação
self-service atinge depois da simulação, antes da assinatura (`aguardando_assinatura`, ver
RF-ANT-06) — não existe um status separado de "aguardando aprovação de terceiro"; a aprovação
**é** a assinatura de RF-ANT-07/08, reaproveitada sem alteração.

**RF-TER-03** O representante recebe uma notificação push (RF-PUSH-02 ganha este evento) e,
adicionalmente, a operação aparece na lista de "Minhas antecipações" (RF-HOME-02) mesmo antes de
aprovada — nunca depender só do push chegar/ser tocado para o representante saber que existe algo
pendente.

**RF-TER-04** A tela de revisão dessa operação (mesmo layout de RF-ANT-06) é **somente leitura**
quanto aos dados da NF — vieram do terceiro, não do representante, então não há o que corrigir
manualmente aqui (diferente de RF-ANT-04, que trata dados extraídos pela própria IA a partir do
que o representante enviou). A decisão em si (aprovar/recusar) é o que o representante controla.

**RF-TER-05** A aprovação exige o mesmo segundo fator de leitura facial de qualquer assinatura
(RF-ANT-07) — não existe aprovação sem esse gesto, independentemente da operação ter sido
originada fora do app. Só um `representante_legal` ativo pode aprovar (mesmo critério de
RF-REP-02 para assinatura de solicitações próprias) — um `visualizador` nem vê a ação de
aprovar/recusar, só o resultado depois de decidido.

**RF-TER-06** Se o app não tiver sessão ativa quando a notificação chegar, tocá-la deve levar
primeiro ao login completo (RF-AUTH-01/04a) e só então à tela de revisão/aprovação — nunca abrir
uma tela de aprovação sem autenticação plena, mesmo que o destino pretendido seja conhecido pelo
payload da notificação.

**RF-TER-07 Recusa simples**: ao lado de "Aprovar",
a tela de revisão oferece "Recusar". Diferente da aprovação, recusar **não exige leitura facial**
— não movimenta dinheiro nem compromete a empresa, é só a decisão de não seguir com aquela
operação especificamente; pode ter uma confirmação simples ("tem certeza?"), nunca o segundo
fator biométrico. Ao recusar, o status muda direto de `aguardando_assinatura` para `cancelada`
(RF-STATUS-01) — reaproveita o status já existente em vez de criar um novo, já que o significado
é o mesmo: a operação não segue adiante, por decisão da própria empresa. **A recusa é definitiva**
— não há caminho de "reconsiderar" ou aceitar depois uma operação já recusada; se o terceiro
quiser tentar de novo, precisa originar uma nova operação (sujeita ao limite de saldo de RN-11,
se for a mesma NF).

---

## 2. Requisitos Não Funcionais

### 2.1 Segurança

**RNF-01** O template biométrico (leitura facial) é dado pessoal sensível conforme LGPD — deve
ser armazenado criptografado em repouso e nunca transmitido ou logado em texto claro.

**RNF-02** Toda comunicação entre app e backend deve ocorrer sobre HTTPS/TLS 1.2 ou superior.

**RNF-03** O token de sessão (JWT) deve ter validade máxima de 7 dias e ser revogável no logout
(RF-AUTH-07) e pela equipe Fynvex em caso de suspeita de comprometimento.

**RNF-04** Uploads de documentos (Contrato Social, Procuração, Nota Fiscal) devem ser
armazenados em local não publicamente acessível, com URLs de acesso assinadas e temporárias.

**RNF-05** Arquivos enviados são validados por tipo MIME e tamanho antes do processamento pela
IA de extração, rejeitando extensões não permitidas independentemente do nome do arquivo.

**RNF-06** Dados bancários e Pix armazenados devem seguir o mesmo padrão de proteção em repouso
já aplicado pelo backend existente aos dados de `medico`/`empresa`.

**RNF-07** Endpoints autenticados devem validar o token JWT em toda requisição, retornando
`401 Unauthorized` para token ausente, inválido ou expirado.

**RNF-08** Os seguintes endpoints devem aplicar rate limiting de 5 tentativas por CPF/CNPJ (o que
for a chave de busca) a cada 15 minutos, retornando `429 Too Many Requests` com tempo de espera ao
exceder o limite: verificação de CPF no login (RF-AUTH-02), validação de senha (RF-AUTH-03),
verificação de CNPJ no cadastro (RF-CAD-01), leitura facial em qualquer momento de assinatura
(RF-ANT-07/RF-MAE-02/RF-TER-05) e código de recuperação de conta (RF-AUTH-08).

### 2.2 Desempenho

**RNF-09** A leitura por IA (Contrato Social ou Nota Fiscal) deve concluir em até **15 segundos**
em condições normais; o app deve comunicar tempos maiores sem travar a interface.

**RNF-10** O cálculo de simulação (deságio/taxa administrativa/valor líquido) deve responder em
até 2 segundos.

**RNF-11** A geração/consulta do QR Code e código de barras de pagamento deve responder em até
3 segundos.

### 2.3 Conformidade LGPD

**RNF-12** Dados pessoais do responsável legal (nome, CPF) extraídos do Contrato Social devem
ter a mesma base legal e finalidade já aplicadas pelo backend a dados de `socio`/`medico`.

**RNF-13** O usuário deve ser informado, na tela de cadastro da leitura facial, da finalidade do
uso do dado biométrico (autenticação e assinatura), antes da captura.

### 2.4 Disponibilidade e Operação

**RNF-14** Os novos endpoints devem expor código de erro estruturado (`error_code` +
`message`) em respostas de erro, permitindo tratamento específico pelo app sem depender de
parsing de texto livre.

**RNF-15** Falhas do serviço de leitura por IA (indisponibilidade, timeout) devem retornar erro
identificável, permitindo ao app oferecer nova tentativa sem perda dos dados já enviados
(CNPJ/documento).

### 2.5 Segurança do Aplicativo (Cliente Móvel)

Requisitos de segurança do cliente móvel (app React Native) que protegem três superfícies
distintas: o canal de comunicação com o backend (certificate pinning, RNF-16), o dispositivo em
si quando comprometido por root/jailbreak (RNF-17), e a integridade da sessão e dos dados
sensíveis mantidos ou registrados localmente — invalidação de token, timeout em segundo plano,
armazenamento do token/senha, build de produção e redação de logs (RNF-18 a RNF-22). Nenhum item
abaixo é opcional: o app autentica por biometria, assina operações financeiras em nome da empresa
e trafega dados bancários — uma lacuna em qualquer um desses controles (certificado não validado,
sessão que nunca expira em segundo plano, log que grava um token em texto claro) expõe a operação
financeira da PJ, não apenas dados do app.

**RNF-16** O app deve validar o certificado TLS do backend por **certificate pinning**,
rejeitando a conexão se o certificado apresentado não corresponder ao(s) pinado(s), mesmo que a
cadeia seja válida para o sistema operacional.

**RNF-17** O app deve detectar dispositivos com root/jailbreak ou em execução sobre emulador. No
mínimo, deve alertar o usuário e sinalizar o evento ao backend junto da sessão (para escrutínio
adicional); bloquear totalmente o uso nesses dispositivos é decisão de produto/risco a confirmar
antes da implementação.

**RNF-18** O tratamento de `401 Unauthorized` deve ser **centralizado no interceptor de resposta
do cliente HTTP** (não replicado tela a tela): ao receber 401 em qualquer requisição autenticada,
o app deve limpar o token do keychain/keystore e redirecionar para o login imediatamente.

**RNF-19** O app não exige nenhuma verificação adicional (senha ou leitura facial) só por causa
de tempo em segundo plano — retomar a sessão depois de qualquer período em background segue
exatamente o mesmo caminho silencioso de RF-AUTH-04a. O único momento em que a leitura facial é
exigida é a assinatura de algo (RF-BIO-03), independentemente de quanto tempo o app ficou em
segundo plano antes disso.

**RNF-20** A gravação do token de sessão no keychain/keystore deve usar controle de acesso
explícito equivalente a `WHEN_UNLOCKED_THIS_DEVICE_ONLY` — nunca incluído em backup/sincronização
de nuvem do dispositivo, acessível somente com o aparelho desbloqueado.

**RNF-21** A build de produção (release) deve ter ofuscação/minificação de código habilitada
(ProGuard/R8 no Android, equivalente no iOS) e ser assinada com uma chave de release dedicada —
nunca com o keystore/certificado de debug.

**RNF-22** Nenhum log, ferramenta de crash reporting ou analytics pode registrar, em texto claro,
token de sessão, template biométrico, CPF/CNPJ completo ou dados bancários; qualquer ferramenta
de observabilidade adotada deve ter redação desses campos configurada antes de ir a produção.

### 2.6 Identidade Visual e Acessibilidade

**RNF-23** Paleta de marca do app: navy `#0F2137`, ciano `#00A3E4`, azul `#124B9A`; tipografia
Poppins. Esta é a paleta de produto/marketing — distinta da paleta do backoffice administrativo
existente (AdminLTE, não customizada) e também distinta das cores até então aplicadas no
protótipo/app (`#041324`/`#095dc1`/`#1d98e5`, herdadas do CSS do site institucional legado). Ao
divergirem, esta paleta prevalece para telas voltadas ao usuário final da PJ médica.

**RNF-24** Fontes com escala ajustável pelo sistema operacional, contraste mínimo AA (WCAG) em
texto e ícones, e suporte a leitor de tela nas jornadas principais (login, nova solicitação,
acompanhamento).

### 2.7 Conectividade

Praticamente toda tela do app depende de uma chamada de rede (login, leitura facial, simulação,
assinatura, pagamento) — não há, nem deve haver, um modo "offline" que permita concluir essas
ações sem conexão e sincronizar depois. Para uma operação financeira (assinatura de cessão,
solicitação de antecipação), enfileirar a ação offline para reenvio automático é um risco, não
uma conveniência: pode gerar duplicidade ou assinar num momento diferente do que o usuário
efetivamente confirmou. O tratamento correto é detectar e comunicar a falta de conexão
claramente, nunca tentar reenviar em segundo plano.

**RNF-25** O app deve detectar a falta de conectividade com a internet (não apenas erros de
resposta do backend) e, ao detectar, exibir uma mensagem específica ("Sem conexão com a
internet") e retornar à tela de login — mesmo padrão de RNF-18 (401 centralizado no
interceptor), aplicado à ausência de rede em vez de à sessão expirada. Isso evita deixar o
usuário parado no meio de um fluxo (ex.: leitura facial, assinatura) sem conseguir prosseguir
nem voltar: login é o único ponto da jornada que não depende de estado em andamento, então é o
destino seguro para retomar quando a conexão voltar.

---

## 3. Regras de Negócio

**RN-01 Unicidade de cadastro por CNPJ**: Um CNPJ só pode ter um cadastro ativo na plataforma.
Nova tentativa de cadastro com CNPJ já existente deve reconduzir ao cadastro existente (e seu
status atual), não criar um segundo registro.

**RN-02 Antecipação vinculada a uma única Nota Fiscal**: Cada solicitação de antecipação
corresponde a exatamente uma Nota Fiscal informada; não há antecipação combinando múltiplas
notas em uma única solicitação.

**RN-03 Cancelamento restrito por status**: Uma solicitação só pode ser cancelada pelo usuário
enquanto estiver `solicitada` ou `em_analise` (RF-STATUS-05).

**RN-04 Senha pessoal lembrada por dispositivo, leitura facial nunca dispensada**: a senha
(RF-AUTH-01) é vinculada ao representante, não à empresa, e criada uma única vez. No primeiro
login bem-sucedido num dispositivo, o app a armazena em local seguro (mesmo controle de acesso do
token, RNF-20) para reenvio automático em logins seguintes nesse mesmo dispositivo — mas a
leitura facial nunca é dispensada por causa disso; ela é obrigatória tanto para login quanto para
confirmar uma solicitação de antecipação (RF-ANT-07), sempre. Falha repetida da biometria ou
perda do dispositivo tem um caminho próprio — recuperação de conta por e-mail (RF-AUTH-08) — que
também sempre exige um segundo fator (o código por e-mail); login só por senha, sem nenhum
segundo fator, nunca é um caminho válido, nem como recuperação.

**RN-05 Confirmação de liquidação apenas via canal oficial**: O status de liquidação
(`aguardando_liquidacao` → `liquidada`/`em_atraso`) só é alterado mediante webhook validado do
provedor de boletos/split (RF-PAG-04). Nenhuma ação do app altera esse status diretamente.

**RN-06 Snapshot de valores na solicitação**: Deságio, taxa administrativa e valor líquido são
calculados e gravados no momento da criação da solicitação (RF-ANT-08). Alterações posteriores
na taxa padrão da plataforma não afetam solicitações já criadas.

**RN-07 Dados bancários vigentes no momento do crédito**: O crédito de uma antecipação aprovada
utiliza os dados bancários vigentes no cadastro da empresa no momento da aprovação, não os
vigentes no momento da solicitação, caso tenham sido alterados entre uma etapa e outra.

**RN-08 SLA de análise de crédito**: A análise de crédito (`em_analise`) tem meta de conclusão em
até **24 horas úteis** a partir da criação da solicitação; o crédito à PJ, quando aprovada, em
até **1 dia útil** após a aprovação (RF-STATUS-03). Ambos são metas operacionais da equipe
Fynvex, não um limite técnico imposto pelo app — o app não bloqueia nem rejeita nada com base
neles, apenas reflete o status corrente.

**RN-09 Contrato-Mãe assinado uma única vez por empresa**: O app não deve cachear localmente,
de forma permanente, que o Contrato-Mãe já foi assinado (RF-MAE-03) — o status deve ser
confirmado pelo backend a cada nova solicitação, pois apenas ele tem autoridade sobre esse estado.

**RN-10 Autentique permanece no backend como assinatura formal**: A confirmação por checkbox +
leitura facial no app (RF-ANT-07, RF-MAE-02) é o gesto de consentimento do usuário — ela não
substitui a assinatura eletrônica formal. O backend é responsável por gerar e processar essa
assinatura via Autentique (mesmo mecanismo já usado pelo backoffice existente), sem exigir do
usuário nenhuma ação adicional fora do app.

**RN-11 Limite de cessão por Nota Fiscal (antifraude)**: A mesma Nota Fiscal (identificada por
número + CNPJ do tomador, ou pelo link/URL da nota — quando se tratar de uma NFS-e eletrônica com
link de consulta próprio) pode lastrear mais de uma solicitação
simultaneamente ativa — isto é, com status diferente de `recusada` ou `cancelada` — mas a soma dos
`valor_solicitado` de todas as solicitações ativas contra essa NF nunca pode superar o valor total
da nota, nem da mesma empresa, nem de empresas diferentes (RF-ANT-10). O saldo disponível é
sempre `valor total da NF` menos a soma já comprometida por solicitações ativas — **incluindo as
já `liquidada`**: uma vez que a solicitação é criada (RF-ANT-08), a cessão daquele valor já
ocorreu, o boleto ter sido pago depois não devolve saldo. Quando aplicável ao tipo de ativo, cada
cessão é registrada em registradora de recebíveis (seção 5) como camada adicional de prevenção
contra dupla cessão, além desse limite de valor.

**RN-12 Atribuição de vínculo de parceiro**: uma solicitação originada por deep link da
plataforma do parceiro (RF-CAD-14) tem o vínculo atribuído automaticamente, sem depender de
autodeclaração. Uma solicitação originada dentro do próprio app com autodeclaração (RF-CAD-11)
só recebe o vínculo `confirmado` após validação contra a base do parceiro (RF-CAD-12); enquanto
`pendente` ou se a validação falhar (`nao_vinculado`), a operação segue normalmente, sem
cashback nem alteração na tela de liquidação (RF-PAG-01).

**RN-13 Cashback do parceiro via split**: quando o vínculo da empresa é `confirmado`, o
percentual de cashback do parceiro sobre o deságio cobrado (hoje 10% a 15%, parametrizável por
parceiro) é executado via split automático no pagamento do boleto de liquidação, direto na conta
do parceiro — nunca transita pela Fynvex nem é exposto ao usuário do app (RF-PAG-04).

**RN-14 Cálculo do deságio**: o percentual de deságio (RF-ANT-05) é de **3,95% aplicado
integralmente** para Notas Fiscais com prazo de até 30 dias corridos entre a data da solicitação
e a data de vencimento; a partir do 31º dia, incide um **acréscimo pro rata die** sobre esse
percentual-base. O fator-base e a fórmula de acréscimo são parametrizáveis no backoffice por
perfil, parceiro e campanha (ex.: condição promocional na semana do Dia do Médico) — o app nunca
assume um valor fixo, sempre exibe o que a simulação (RF-ANT-05, RF-SIM-01) retornar. Não há
prazo mínimo que bloqueie a criação da solicitação — uma NF com vencimento mais próximo apenas
resulta em deságio maior, nunca em rejeição.

**RN-15 Unicidade de representante legal ativo**: nenhuma empresa pode ficar sem nenhum
representante `representante_legal` `ativo` (RF-REP-04). Remoção, desativação ou rebaixamento de
perfil que resultaria nisso é sempre bloqueado, independentemente de quem executa a ação —
inclusive o próprio representante_legal tentando se auto-rebaixar/remover sendo o último.

**RN-16 Revogação de sessão por remoção de representante**: remover ou desativar um representante
(RF-REP-05) invalida a sessão ativa dele no backend imediatamente (mesma revogação de RF-AUTH-07)
— nunca só um bloqueio de login futuro, já que o token de sessão (padrão 7 dias, RF-AUTH-04)
continuaria válido até expirar naturalmente se não fosse revogado.

**RN-17 Aprovação de operação originada por terceiro equivale a assinatura própria**: uma
antecipação originada por gestora ou hospital convenente (RF-TER-01) segue exatamente as mesmas
regras de uma solicitação self-service a partir do momento em que é criada — mesma máquina de
status (RF-STATUS-01), mesmo requisito de segundo fator facial (RN-04), mesma elegibilidade de
quem pode assinar (RF-REP-02: só `representante_legal`). A origem da operação (self-service,
gestora ou hospital convenente) não cria uma trilha de aprovação separada.

---

## 4. Endpoints de Integração — Backend Fynvex

Todos os endpoints abaixo são **novos**, a serem criados no backend existente
(`sistema-fynvex/antecipacao-develop`), sob o prefixo `/api/v1/app/`, para uso exclusivo do
aplicativo móvel — distintos da API JWT administrativa já existente (`/api/login`, `/api/me`
etc.). Convenção de dados: `snake_case`, valores monetários em `decimal` (BRL), datas em
`YYYY-MM-DD`. Endpoints marcados **🔒** exigem `Authorization: Bearer <token>`.

Alguns campos (`kyc_status`, `pagamento_status`, `origem`) usam valores em inglês (`pending`,
`approved`, `rejected`, `paid`, `self`) por convenção de contrato de API — são códigos internos
trocados entre app e backend, nunca exibidos como texto na tela. Cada tela do app mostra uma frase
fixa em português para cada valor (ex.: `kyc_status = pending` → "Cadastro em análise"); o
usuário final nunca vê o literal em inglês.

### 4.1 Autenticação

#### `POST /api/v1/app/auth/cpf`
Verifica existência de representante ativo para o CPF informado.

**Request**
```json
{ "cpf": "123.456.789-00" }
```
**Response 200**
```json
{
  "empresa_id": 123,
  "possui_cadastro": true,
  "kyc_status": "approved"
}
```
`kyc_status`: `none` | `pending` | `approved` | `rejected` — status do cadastro da **empresa**
vinculada ao representante desse CPF, não do CPF em si. `empresa_id` vem `null` quando
`possui_cadastro` é `false`.

**Response 429** (rate limit — RNF-08)
```json
{ "error_code": "TOO_MANY_ATTEMPTS", "message": "Muitas tentativas. Tente novamente em 12 minutos.", "retry_after": 720 }
```

---

#### `POST /api/v1/app/auth/login`
Valida CPF + senha e, se corretos, emite o token de sessão diretamente — **sem** sessão de
leitura facial nenhuma (RF-AUTH-01/03). A leitura facial não faz parte do login (RF-BIO-03).

**Request**
```json
{ "cpf": "123.456.789-00", "senha": "••••••••" }
```
`senha` é enviada da mesma forma tanto num login digitado manualmente quanto num login com senha
lembrada pelo dispositivo (RF-AUTH-04a) — o backend não distingue os dois casos, é o app que
decide se mostra o campo ou reenvia o valor guardado no keychain/keystore ou no gerenciador de
senhas do sistema.

**Response 200**
```json
{
  "access_token": "eyJ0eXAiOiJKV1Qi...",
  "token_type": "bearer",
  "expires_in": 604800,
  "empresa": {
    "id": 123,
    "nome_fantasia": "Bem Estar Serviços Médicos",
    "cnpj": "11.222.333/0001-99",
    "kyc_status": "approved"
  },
  "representante": {
    "id": 1,
    "nome": "Ana Ferreira",
    "perfil_acesso": "representante_legal"
  }
}
```
**Response 401** (CPF ou senha incorretos)
```json
{ "error_code": "SENHA_INVALIDA", "message": "CPF ou senha incorretos." }
```
Mensagem deliberadamente genérica (não diferencia "CPF não encontrado" de "senha errada") para
não confirmar a existência de um cadastro a quem só tem o CPF.

**Response 429** (rate limit — RNF-08)
```json
{ "error_code": "TOO_MANY_ATTEMPTS", "message": "Muitas tentativas. Tente novamente em 12 minutos.", "retry_after": 720 }
```

> A leitura facial só aparece mais adiante, no momento de assinar algo — ela usa um par próprio
> **criar sessão → confirmar**, repetido em cada um desses momentos: assinatura de antecipação e
> do Contrato-Mãe (seção 4.3), leitura facial do cadastro (seção 4.2), e a leitura facial de
> recuperação de conta (abaixo). Não existe mais um par de leitura facial "de login" — o login em
> si (`.../login`, acima) não usa esse padrão.

---

#### `POST /api/v1/app/auth/logout` 🔒
Revoga o token de sessão atual **e** instrui o app a apagar a senha lembrada localmente
(RF-AUTH-07) — diferente do 401 automático (RNF-18), que só limpa o token, preservando a senha
lembrada para permitir reautenticação silenciosa (RF-AUTH-04a). **Response 204** (sem corpo).

---

#### `POST /api/v1/app/auth/recuperacao/iniciar`
RF-AUTH-08. Sem 🔒 — é chamado por quem perdeu acesso, antes de qualquer sessão existir. Mesmo
rate limit de RNF-08 (5 tentativas/15 min) para não abrir uma segunda porta de força bruta.

**Request**
```json
{ "cpf": "123.456.789-00", "email": "ana.ferreira@exemplo.com.br" }
```
**Response 200** (sempre — não confirma nem nega que o e-mail exista, mesmo racional de
`SENHA_INVALIDA` em `.../login`)
```json
{ "mensagem": "Se o e-mail informado estiver correto, você receberá um código de verificação." }
```
Se o e-mail corresponde a um representante `ativo` com esse CPF, um código de verificação **válido
por 15 minutos** é enviado a ele (2º fator equivalente ao facial — não um substituto mais fraco).

---

#### `POST /api/v1/app/auth/recuperacao/confirmar`
Confirma o código recebido por e-mail e permite definir uma nova senha — a mesma pessoa já
verificada (RF-KYC-02) restabelece acesso, sem repetir cadastro/revisão.

**Request**
```json
{ "cpf": "123.456.789-00", "email": "ana.ferreira@exemplo.com.br", "codigo": "482913", "nova_senha": "••••••••" }
```
**Response 200**
```json
{ "representante_id": 1, "status": "senha_redefinida" }
```
Depois disso, o app segue para uma nova leitura facial — par dedicado abaixo, já que não existe
mais um par de leitura facial de login pra reaproveitar. Substitui o template antigo pelo novo, já
que o dispositivo/enrollment anterior pode não estar mais disponível.

**Response 401** (código incorreto ou expirado)
```json
{ "error_code": "CODIGO_INVALIDO", "message": "Código incorreto ou expirado." }
```

---

#### `POST /api/v1/app/auth/recuperacao/leitura-facial/iniciar`
Inicia a sessão de leitura facial que encerra a recuperação de conta (RF-AUTH-08/RF-BIO-03) —
mesmo mecanismo de sessão dos demais pontos de leitura facial do app (RF-BIO-08).

**Request**
```json
{ "representante_id": 1 }
```
**Response 200**
```json
{ "session_id": "a1b2c3d4-e5f6-...", "session_expires_in": 180 }
```

---

#### `POST /api/v1/app/auth/recuperacao/leitura-facial/confirmar`
Confirma o resultado da sessão e substitui o template biométrico do representante pelo novo,
emitindo o token de sessão — a recuperação de conta termina aqui.

**Request**
```json
{ "session_id": "a1b2c3d4-e5f6-..." }
```
**Response 200**
```json
{
  "access_token": "eyJ0eXAiOiJKV1Qi...",
  "token_type": "bearer",
  "expires_in": 604800,
  "empresa": { "id": 123, "nome_fantasia": "Bem Estar Serviços Médicos", "cnpj": "11.222.333/0001-99", "kyc_status": "approved" },
  "representante": { "id": 1, "nome": "Ana Ferreira", "perfil_acesso": "representante_legal" }
}
```
**Response 401** (liveness reprovado)
```json
{ "error_code": "FACIAL_MISMATCH", "message": "Não foi possível confirmar sua identidade." }
```

---

### 4.2 Cadastro

#### `POST /api/v1/app/cadastro`
Inicia o cadastro. `multipart/form-data`.

**Request (campos do form)**
| Campo | Tipo | Obrigatório |
|---|---|---|
| `cnpj` | string | sim |
| `email` | string | sim (RF-CAD-01/RF-REP-07 — só uso é recuperação de conta) |
| `contrato_social` | file (pdf/jpg/png, ≤10MB) | sim |
| `documento_identidade` | file (pdf/jpg/png, ≤10MB) | sim (RF-CAD-01) |
| `procuracao` | file (pdf/jpg/png, ≤10MB) | não |
| `parceiro_codigo` | string | não (RF-CAD-11) |

**Response 201**
```json
{ "cadastro_id": 55, "status": "processando_ia" }
```

---

#### `GET /api/v1/app/cadastro/{cadastro_id}`
Consulta status e, quando disponível, os dados extraídos pela IA.

**Response 200** (`status = dados_extraidos`)
```json
{
  "cadastro_id": 55,
  "status": "dados_extraidos",
  "dados_extraidos": {
    "razao_social": "Bem Estar Serviços Médicos Ltda",
    "nome_fantasia": "Bem Estar Serviços Médicos",
    "endereco": "Av. Paulista, 1000 - Bela Vista, São Paulo/SP",
    "responsavel_legal": {
      "nome": "Ana Ferreira",
      "cpf": "123.456.789-00",
      "cargo": "Sócia-administradora"
    }
  }
}
```
`status`: `processando_ia` | `dados_extraidos` | `falha_extracao` | `dados_confirmados` |
`biometria_cadastrada` | `dados_bancarios_salvos` | `pending` | `approved` | `rejected`.

---

#### `POST /api/v1/app/cadastro/{cadastro_id}/confirmar-dados` 🔒
Confirma (ou corrige) os dados extraídos pela IA e define a senha do responsável legal — que se
torna o primeiro representante da empresa (RF-REP-01), com perfil `representante_legal`.

**Request**
```json
{
  "razao_social": "Bem Estar Serviços Médicos Ltda",
  "nome_fantasia": "Bem Estar Serviços Médicos",
  "endereco": "Av. Paulista, 1000 - Bela Vista, São Paulo/SP",
  "responsavel_legal": {
    "nome": "Ana Ferreira",
    "cpf": "123.456.789-00",
    "cargo": "Sócia-administradora"
  },
  "senha": "••••••••"
}
```
**Response 200**
```json
{ "cadastro_id": 55, "status": "dados_confirmados", "representante_id": 1 }
```

---

#### `POST /api/v1/app/cadastro/{cadastro_id}/leitura-facial/iniciar`
Inicia a sessão de leitura facial para cadastrar o template biométrico do responsável — mesmo
mecanismo de sessão usado em qualquer outro ponto de leitura facial do app (RF-BIO-08), aqui usado
para cadastrar em vez de verificar contra um template já existente.

**Request**: sem corpo (o `cadastro_id` já identifica a empresa).

**Response 200**
```json
{ "session_id": "a1b2c3d4-e5f6-...", "session_expires_in": 180 }
```

---

#### `POST /api/v1/app/cadastro/{cadastro_id}/leitura-facial/confirmar`
Confirma o resultado da sessão e cadastra o template biométrico do responsável.

**Request**
```json
{ "session_id": "a1b2c3d4-e5f6-..." }
```
**Response 200**
```json
{ "cadastro_id": 55, "status": "biometria_cadastrada" }
```
**Response 401**: mesmo formato de `FACIAL_MISMATCH` da seção 4.1.

---

#### `POST /api/v1/app/cadastro/{cadastro_id}/dados-bancarios`
**Request**
```json
{
  "banco_id": 1,
  "agencia": "1234",
  "conta": "56789-0",
  "tipo_conta": "corrente",
  "tipo_transferencia": "pix",
  "pix": "11222333000199"
}
```
`tipo_conta`: `corrente` | `poupanca`. `tipo_transferencia`: `pix` | `ted` (quando `ted`, `pix`
é omitido/ignorado).

**Response 200**
```json
{ "cadastro_id": 55, "status": "dados_bancarios_salvos" }
```

---

#### `POST /api/v1/app/cadastro/{cadastro_id}/aceite-termos`
**Request**
```json
{ "termos_aceitos": true, "versao_termos": "1.0" }
```
**Response 200**
```json
{
  "cadastro_id": 55,
  "status": "pending",
  "kyc_status": "pending",
  "access_token": "eyJ0eXAiOiJKV1Qi...",
  "token_type": "bearer",
  "expires_in": 604800
}
```
O token é emitido já nesta resposta (RF-CAD-10) — o app autentica o usuário imediatamente com ele,
em vez de exigir uma chamada de login separada só para chegar à tela de acompanhamento de análise.

---

### 4.3 Antecipação

#### `GET /api/v1/app/contrato-mae` 🔒
Consulta se o Contrato-Mãe da empresa autenticada já foi assinado (RF-MAE-01).

**Response 200**
```json
{ "status": "assinado", "assinado_em": "2026-07-20T09:12:00Z" }
```
ou, se ainda não assinado:
```json
{ "status": "nunca_assinado", "assinado_em": null }
```

---

#### `POST /api/v1/app/contrato-mae/assinar/iniciar` 🔒
Inicia a sessão de leitura facial para confirmar a assinatura do Contrato-Mãe — mesmo mecanismo
de sessão usado em qualquer outro ponto de leitura facial do app (RF-BIO-03/08).

**Request**: sem corpo (a empresa é identificada pelo token de sessão).

**Response 200**
```json
{ "session_id": "a1b2c3d4-e5f6-...", "session_expires_in": 180 }
```

---

#### `POST /api/v1/app/contrato-mae/assinar/confirmar` 🔒
Confirma o resultado da sessão e registra a assinatura do Contrato-Mãe (RF-MAE-02) — mesmo
mecanismo de `POST /antecipacoes/{id}/assinar/confirmar`.

**Request**
```json
{ "session_id": "a1b2c3d4-e5f6-..." }
```
**Response 200**
```json
{
  "status": "assinado",
  "assinado_em": "2026-08-05T14:10:00Z",
  "assinado_por": { "representante_id": 1, "nome": "Ana Ferreira" }
}
```
**Response 401**: mesmo formato de `FACIAL_MISMATCH` da seção 4.1.

---

#### `GET /api/v1/app/antecipacoes` 🔒
Lista as solicitações da empresa autenticada, mais recentes primeiro.

**Response 200**
```json
{
  "data": [
    {
      "id": 1,
      "nf_numero": "1000",
      "tomador": "Convênio SulSaúde",
      "valor_bruto": 4820.00,
      "desagio_pct": 3.95,
      "desagio": 190.39,
      "taxa_administrativa": 15.00,
      "valor_liquido": 4614.61,
      "data_credito": "2026-08-06",
      "status": "aguardando_liquidacao",
      "pagamento_status": "pending",
      "motivo_recusa": null,
      "origem": "self",
      "created_at": "2026-08-05T14:32:00Z"
    }
  ]
}
```
`status`: um dos nove valores de RF-STATUS-01 (`solicitada` | `em_analise` | `aprovada` |
`recusada` | `credito_efetuado` | `aguardando_liquidacao` | `liquidada` | `em_atraso` |
`cancelada`). `pagamento_status` só é relevante em `aguardando_liquidacao`/`em_atraso`/
`liquidada` (`pending` | `paid`). `origem`: `self` | `gestora` | `hospital_convenio` (RF-TER-01)
— itens com `origem` diferente de `self` e `status: aguardando_assinatura` (normalmente
invisível na lista, ver RF-ANT-08) **aparecem** aqui mesmo nesse status, com ação de "Aprovar"
em vez de "Ver pagamento" (RF-TER-03) — é a diferença deliberada desse fluxo em relação à
solicitação self-service, cujo rascunho não persiste em `aguardando_assinatura` visível ao
usuário.

---

#### `POST /api/v1/app/antecipacoes/nota-fiscal` 🔒
Envia a Nota Fiscal para leitura por IA. `multipart/form-data`: campo `nota_fiscal` (file).

**Response 201**
```json
{ "nf_leitura_id": 77, "status": "processando_ia" }
```

---

#### `GET /api/v1/app/antecipacoes/nota-fiscal/{nf_leitura_id}` 🔒
**Response 200**
```json
{
  "nf_leitura_id": 77,
  "status": "dados_extraidos",
  "numero": "1000",
  "tomador": "Convênio SulSaúde",
  "cnpj_tomador": "22333444000155",
  "valor": 4820.00,
  "data_emissao": "2026-07-31",
  "data_vencimento": "2026-09-04"
}
```

---

#### `POST /api/v1/app/antecipacoes/nota-fiscal/{nf_leitura_id}/confirmar-dados` 🔒
Confirma (ou corrige) os dados extraídos pela IA — mesmo padrão de
`POST /cadastro/{cadastro_id}/confirmar-dados` (RF-ANT-04/RF-CAD-07). A simulação (abaixo) e a
criação da solicitação usam os valores desta confirmação, não os originalmente extraídos.

**Request**
```json
{
  "numero": "1000",
  "tomador": "Convênio SulSaúde",
  "cnpj_tomador": "22333444000155",
  "valor": 4820.00,
  "valor_solicitado": 4820.00,
  "data_emissao": "2026-07-31",
  "data_vencimento": "2026-09-04"
}
```
`valor` é o valor total da NF; `valor_solicitado` (RF-ANT-04) é quanto o usuário quer antecipar
nesta solicitação — o app já pré-preenche esse campo com o saldo disponível calculado (RF-ANT-10),
não com `valor` cru, mas o usuário pode editar para um valor ainda menor. O backend não valida o
saldo aqui ainda — só na criação da solicitação (abaixo), que é o momento em que a checagem
importa de fato.
**Response 200**
```json
{ "nf_leitura_id": 77, "status": "dados_confirmados" }
```

---

#### `POST /api/v1/app/antecipacoes/simular` 🔒
`desagio_pct` é calculado por RN-14 a partir do prazo real da NF (flat até 30 dias, pro rata die
a partir do 31º) — nunca um valor fixo. O deságio incide sobre `valor_solicitado` (a
confirmação acima), não sobre o valor total da NF quando os dois forem diferentes.

**Request**
```json
{ "nf_leitura_id": 77 }
```
**Response 200**
```json
{
  "valor_bruto": 4820.00,
  "desagio_pct": 3.95,
  "desagio": 190.39,
  "taxa_administrativa": 15.00,
  "valor_liquido": 4614.61,
  "data_credito_prevista": "2026-08-06"
}
```
`valor_bruto` aqui é o `valor_solicitado` confirmado, não necessariamente o valor total da NF
(RF-ANT-10).

---

#### `POST /api/v1/app/antecipacoes` 🔒
Cria a solicitação (antes da assinatura — ver RF-ANT-07/08). Não há mais prazo mínimo que
bloqueie a criação (RN-14) — a única rejeição possível é saldo insuficiente na NF (RN-11).

**Request**
```json
{ "nf_leitura_id": 77 }
```
**Response 201**
```json
{
  "id": 1,
  "status": "aguardando_assinatura",
  "valor_bruto": 4820.00,
  "desagio": 190.39,
  "taxa_administrativa": 15.00,
  "valor_liquido": 4614.61,
  "data_credito": "2026-08-06"
}
```
**Response 409** (`valor_solicitado` supera o saldo disponível da NF — RN-11)
```json
{
  "error_code": "SALDO_NF_INSUFICIENTE",
  "message": "Esta Nota Fiscal já tem R$ 5.000,00 antecipados. Saldo disponível: R$ 5.000,00.",
  "valor_total_nf": 10000.00,
  "valor_ja_antecipado": 5000.00,
  "saldo_disponivel": 5000.00,
  "antecipacao_id": 4
}
```

---

#### `POST /api/v1/app/antecipacoes/{id}/assinar/iniciar` 🔒
Inicia a sessão de leitura facial para confirmar a assinatura desta solicitação — mesmo mecanismo
de sessão usado em qualquer outro ponto de leitura facial do app (RF-BIO-03/08).

**Request**: sem corpo.

**Response 200**
```json
{ "session_id": "a1b2c3d4-e5f6-...", "session_expires_in": 180 }
```

---

#### `POST /api/v1/app/antecipacoes/{id}/assinar/confirmar` 🔒
Confirma o resultado da sessão e efetiva a assinatura (RF-ANT-07/08).

**Request**
```json
{ "session_id": "a1b2c3d4-e5f6-..." }
```
**Response 200**
```json
{
  "id": 1,
  "status": "solicitada",
  "assinado_em": "2026-08-05T14:40:00Z",
  "assinado_por": { "representante_id": 1, "nome": "Ana Ferreira" }
}
```
**Response 401**: mesmo formato de `FACIAL_MISMATCH` da seção 4.1.

---

#### `POST /api/v1/app/antecipacoes/{id}/cancelar` 🔒
**Response 200**
```json
{ "id": 1, "status": "cancelada" }
```
**Response 409** (status não permite cancelamento — RN-03)
```json
{ "error_code": "CANCELAMENTO_NAO_PERMITIDO", "message": "Solicitação não pode mais ser cancelada." }
```

---

#### `POST /api/v1/app/antecipacoes/{id}/recusar` 🔒
RF-TER-07. Só válido para `status: aguardando_assinatura` com `origem` diferente de `self` (uma
antecipação de terceiro ainda não decidida) — **não exige sessão de leitura facial**, diferente de
`.../assinar/*`. Definitivo: não existe endpoint para reverter uma recusa.

**Response 200**
```json
{ "id": 1, "status": "cancelada" }
```
**Response 409** (não é uma antecipação de terceiro pendente)
```json
{ "error_code": "RECUSA_NAO_PERMITIDA", "message": "Esta solicitação não pode ser recusada." }
```

---

#### `GET /api/v1/app/antecipacoes/{id}/pagamento` 🔒
Disponível quando `status` é `aguardando_liquidacao`, `em_atraso` ou `liquidada` (RF-PAG-01).
O boleto refere-se à **liquidação da operação pelo tomador** (valor bruto da NF), não a uma
cobrança à PJ (RF-ANT-11) — `pix_payload`/`linha_digitavel` só vêm preenchidos quando o vínculo
de parceiro da empresa **não** é `confirmado` (RF-CAD-13); caso contrário a resposta traz apenas
o status, e o app não deve exibir tela de QR/boleto.

**Response 200** (sem parceiro confirmado)
```json
{
  "antecipacao_id": 1,
  "valor_bruto": 4820.00,
  "tomador": "Convênio SulSaúde",
  "data_vencimento": "2026-09-04",
  "pagamento_status": "pending",
  "pix_payload": "00020126580014BR.GOV.BCB.PIX...6304ABCD",
  "linha_digitavel": "34191.79001 01043.510047 91020.150008 4 88970000001500"
}
```
**Response 200** (vínculo de parceiro `confirmado` — liquidação pela plataforma do parceiro)
```json
{
  "antecipacao_id": 1,
  "valor_bruto": 4820.00,
  "tomador": "Convênio SulSaúde",
  "data_vencimento": "2026-09-04",
  "pagamento_status": "pending",
  "pix_payload": null,
  "linha_digitavel": null
}
```
**Response 409** (status fora de `aguardando_liquidacao`/`em_atraso`/`liquidada`)
```json
{ "error_code": "LIQUIDACAO_INDISPONIVEL", "message": "Esta solicitação não possui liquidação em andamento." }
```

> Não existe endpoint para o app "confirmar" a liquidação — a confirmação chega ao backend via
> webhook do provedor de boletos/split (RF-PAG-04) e é apenas refletida neste `GET` e via push
> (RF-PUSH-02).

---

### 4.4 Perfil

#### `GET /api/v1/app/perfil` 🔒
**Response 200**
```json
{
  "empresa_id": 123,
  "razao_social": "Bem Estar Serviços Médicos Ltda",
  "nome_fantasia": "Bem Estar Serviços Médicos",
  "cnpj": "11.222.333/0001-99",
  "kyc_status": "approved",
  "documentos": [
    { "tipo": "contrato_social", "status": "enviado" },
    { "tipo": "procuracao", "status": "nao_enviado" }
  ],
  "vinculo_parceiro": { "parceiro": "ABM/DC", "status": "confirmado" },
  "representante_logado": {
    "id": 1,
    "nome": "Ana Ferreira",
    "cargo": "Sócia-administradora",
    "perfil_acesso": "representante_legal",
    "documento_identidade_status": "enviado",
    "leitura_facial_status": "cadastrado"
  }
}
```
`vinculo_parceiro.status`: `nao_vinculado` | `pendente` | `confirmado` (RF-CAD-11/12/13). Quando
a empresa nunca declarou vínculo, `parceiro` é `null` e `status` é `nao_vinculado`. Note que
`documentos` só traz documentos **da empresa** (Contrato Social, Procuração) — documento de
identidade e leitura facial são por representante `representante_legal` (RF-BIO-04) e por isso
vivem em `representante_logado` (o de quem está autenticado) e em cada item de
`GET /perfil/representantes` (os demais); um representante `visualizador` não tem nenhum dos dois.

---

#### `GET /api/v1/app/perfil/representantes` 🔒
Lista todos os representantes da empresa — qualquer perfil de acesso pode chamar (RF-REP-02).

**Response 200**
```json
{
  "representantes": [
    { "id": 1, "nome": "Ana Ferreira", "cpf": "123.456.789-00", "cargo": "Sócia-administradora", "perfil_acesso": "representante_legal", "status": "ativo" },
    { "id": 2, "nome": "Carlos Mendes", "cpf": "987.654.321-00", "cargo": "Gerente financeiro", "perfil_acesso": "visualizador", "status": "ativo" }
  ]
}
```
`status`: `convidado` | `pendente_analise` | `ativo` | `rejeitado` | `inativo` (RF-REP-03). Um
`visualizador` nunca passa por `pendente_analise` — vai direto de `convidado` para `ativo` ao
definir a senha (não há revisão da equipe Fynvex nesse fluxo).

---

#### `POST /api/v1/app/perfil/representantes` 🔒
Convida um novo representante. Só `representante_legal` (RF-REP-02). O corpo varia conforme o
perfil convidado (RF-REP-03):

**Request — convite de `representante_legal`** (precisa de Procuração, revisão de KYC)
```json
{
  "nome": "Beatriz Souza",
  "cpf": "111.222.333-44",
  "cargo": "Sócia",
  "email": "beatriz.souza@exemplo.com.br",
  "perfil_acesso": "representante_legal"
}
```
**Response 201**
```json
{ "representante_id": 3, "status": "convidado", "convite_id": "F9K2QX" }
```
`convite_id` é o código que o representante_legal compartilha com o convidado por fora do app
(ex. WhatsApp) — não há, hoje, um deep link automático (ver Fora de Escopo). O convidado usa esse
código para acessar o próprio fluxo de ingresso: senha, leitura facial (RF-BIO-01), documento de
identidade e upload de Procuração — mesmo padrão multipart de RF-CAD-03 — e só fica `ativo` após
revisão da equipe Fynvex (RF-REP-03).

**Request — convite de `visualizador`** (sem Procuração, sem revisão)
```json
{ "nome": "Carlos Mendes", "cpf": "987.654.321-00", "email": "carlos.mendes@exemplo.com.br", "perfil_acesso": "visualizador" }
```
`cpf` é obrigatório aqui mesmo sem revisão nenhuma depois — é o identificador de login (RF-AUTH-01)
do convidado, coletado nesse momento porque não há mais nenhuma outra etapa que o peça.
**Response 201**
```json
{ "representante_id": 2, "status": "convidado" }
```
Não há `convite_id` nesse caso — o backend envia direto um e-mail com um código de 6 dígitos
(mesmo mecanismo de `POST /auth/recuperacao/iniciar`, seção 4.1); o convidado confirma esse
código em `POST /convites/visualizador/confirmar` (abaixo) e já fica `ativo` nesse momento.

**Response 403** (quem chamou não é `representante_legal`)
```json
{ "error_code": "ACAO_RESTRITA_A_REPRESENTANTE_LEGAL", "message": "Apenas representantes legais podem convidar representantes." }
```

---

#### `POST /api/v1/app/convites/visualizador/confirmar`
Confirma o código enviado por e-mail no convite de um `visualizador` e define a senha — sem
sessão de leitura facial, já que esse perfil não passa por biometria (RF-REP-08).

**Request**
```json
{ "email": "carlos.mendes@exemplo.com.br", "codigo": "482913", "senha": "••••••••" }
```
**Response 200**
```json
{ "representante_id": 2, "status": "ativo" }
```
**Response 401** (código incorreto/expirado — mesmo limite de tentativas de RNF-08)
```json
{ "error_code": "CODIGO_INVALIDO", "message": "Código incorreto ou expirado." }
```

---

#### `PUT /api/v1/app/perfil/representantes/{id}` 🔒
Altera perfil de acesso ou status de um representante. Só `representante_legal`.

**Request**
```json
{ "perfil_acesso": "representante_legal" }
```
**Response 200**
```json
{ "id": 2, "status": "ativo", "perfil_acesso": "representante_legal" }
```
**Response 409** (resultaria em zero representante_legal ativo — RN-15)
```json
{ "error_code": "ULTIMO_REPRESENTANTE_LEGAL", "message": "A empresa precisa de ao menos um representante legal ativo." }
```

---

#### `DELETE /api/v1/app/perfil/representantes/{id}` 🔒
Remove/desativa um representante e revoga sua sessão ativa (RN-16). Só `representante_legal`;
mesmo 409 `ULTIMO_REPRESENTANTE_LEGAL` de acima quando aplicável.

**Response 200**
```json
{ "id": 2, "status": "inativo" }
```

---

#### `GET /api/v1/app/perfil/dados-bancarios` 🔒
Só `representante_legal` (RF-REP-02) — um `visualizador` não tem acesso a esta rota (403), nem
mascarado: dados bancários não fazem parte do que ele acompanha.
**Response 200**: mesmo formato do request de `POST .../dados-bancarios` (seção 4.2), acrescido
de `banco_nome`.

#### `PUT /api/v1/app/perfil/dados-bancarios` 🔒
**Request**: idêntico ao `POST /api/v1/app/cadastro/{id}/dados-bancarios`. Só `representante_legal`
(RF-REP-02).
**Response 200**
```json
{ "status": "atualizado" }
```
**Response 403** (chamado por `visualizador`)
```json
{ "error_code": "ACAO_RESTRITA_A_REPRESENTANTE_LEGAL", "message": "Apenas representantes legais podem acessar dados bancários." }
```

---

### 4.5 Apoio

#### `GET /api/v1/app/bancos`
Lista de bancos para preencher o seletor de RF-BANK-01. Público (não exige token).

**Response 200**
```json
{ "data": [ { "id": 1, "nome": "Banco do Brasil" }, { "id": 2, "nome": "Bradesco" } ] }
```

#### `POST /api/v1/app/simulacao-publica`
Simulador (RF-SIM-01/04). Público (não exige token) — usa o mesmo motor de cálculo de
`POST /antecipacoes/simular` (RN-14), sem depender de uma leitura de NF real. Usuário autenticado
chama o mesmo endpoint (RF-SIM-04): não há uma variante "logada" separada — o app é que decide
pra onde levar o resultado (cadastro, se anônimo; revisão da NF, se autenticado).

**Request**
```json
{ "valor_bruto": 4820.00, "data_vencimento": "2026-09-04" }
```
**Response 200**
```json
{
  "valor_bruto": 4820.00,
  "desagio_pct": 3.95,
  "desagio": 190.39,
  "taxa_administrativa": 15.00,
  "valor_liquido": 4614.61,
  "data_credito_prevista": "2026-08-11"
}
```

#### `POST /api/v1/app/dispositivos` 🔒
Registra o token de push do dispositivo (RF-PUSH-01).

**Request**
```json
{ "device_token": "f3a1...", "plataforma": "ios" }
```
`plataforma`: `ios` | `android`. **Response 204**.

---

## 5. Integrações Externas

| Sistema | Finalidade | Sentido |
|---|---|---|
| Backend Fynvex existente (`antecipacao-develop`) | Persistência de empresa/sócio/antecipação/arquivo, motor de deságio e taxa administrativa | Bidirecional |
| Serviço de IA / OCR de documentos — já existe como código na aplicação web da Fynvex, exposto ao app via API do próprio backend (não é um fornecedor terceirizado a contratar) | Extração de dados do Contrato Social e da Nota Fiscal | Entrada |
| Provedor de biometria facial (liveness + correspondência + face match documental) — candidato: AWS Rekognition Face Liveness, a confirmar (RF-BIO-08) | Verificação de identidade (login), captura de assinatura (2º fator) e validação facial do documento de identidade no cadastro (RF-BIO-09) | Bidirecional |
| Provedor de boletos/split — Payproxy, solução já usada internamente pela Fynvex (não é um fornecedor novo a contratar) | Emissão do boleto de liquidação (RF-PAG), geração de QR Code Pix e código de barras, split automático (Fynvex + cashback do parceiro, RN-13), webhook de confirmação | Bidirecional |
| Autentique | Assinatura eletrônica formal do Termo de Cessão e do Contrato-Mãe — orquestrada inteiramente pelo backend (RN-10), sem etapa adicional visível ao usuário no app | Saída |
| Firebase Cloud Messaging / Apple Push Notification service | Notificações push ao dispositivo do usuário, inclusive as que levam à aprovação de antecipação originada por terceiro (RF-TER-02) | Saída |
| WhatsApp Business API | Espelhamento das notificações de status (RF-PUSH-04) e canal de suporte N2 (RF-SUP-01) | Saída |
| Plataforma do Departamento de Convênios (DC/ABM), demais parceiros/gestoras e hospitais convenentes | Base de PJs para validação de vínculo (RF-CAD-12), origem de deep links de nova solicitação (RF-CAD-14), origem de antecipações já preenchidas para aprovação (RF-TER-01), dashboard e prestação de contas do parceiro — inteiramente no backoffice, sem tela própria no app | Bidirecional |
| Registradora de recebíveis | Registro da cessão para prevenção de dupla cessão, quando aplicável ao ativo (RN-11) | Saída |
| Servidor SMTP próprio da Fynvex | Código de verificação da recuperação de conta (RF-AUTH-08) e comunicação de resultado do cadastro por e-mail (RF-KYC-03/04) — infraestrutura já existente da empresa, não um provedor terceirizado novo a contratar | Saída |

---

## Apêndice — Fora de Escopo

Os itens abaixo foram deliberadamente deixados fora deste documento:

- **Interface interna de análise/aprovação** usada pela equipe Fynvex (RF-KYC-02) — assume-se
  backoffice já existente ou a ser especificado separadamente; este documento define apenas o
  contrato de API (status e transições) que ela deve respeitar.
- **Cadastro de pessoa física** (médico autônomo) — fora do escopo atual do app (ver Contexto).
- **Cobrança de taxa administrativa à PJ por boleto/QR** — a taxa administrativa é sempre
  descontada do valor líquido, nunca cobrada separadamente (RF-PAG, seção 1.10). O boleto de
  QR/código de barras que o app eventualmente exibe é o de **liquidação da NF** (RF-ANT-11) — sem
  vínculo de parceiro confirmado, é a própria PJ quem paga esse boleto, mas ele nunca inclui a
  taxa administrativa como um valor adicional; é sempre o resgate do valor bruto da NF.
- **Cadastro, validação e comissionamento de parceiros/gestoras (backoffice do DC/ABM e demais
  parceiros)** — o app só reflete o resultado (RF-CAD-12/13); a administração de parceiros, o
  split de pagamento e a prestação de contas são inteiramente do backoffice.
- **Esquema de deep link e tratamento de app links** vindos da plataforma do parceiro (RF-CAD-14)
  — mencionados como requisito funcional, mas o formato de URL/parâmetros é detalhe de
  implementação, não normatizado aqui.
- **Sistema que cria uma antecipação originada por gestora ou hospital convenente** (RF-TER-01)
  — é um sistema/portal do terceiro, externo a este app; aqui só se especifica o que o app faz
  a partir do momento em que a operação já existe (revisão + aprovação).
- **Cadastro/credenciamento de hospitais convenentes e gestoras como origem de antecipação**
  (RF-TER-01) — mesmo critério já aplicado a parceiros/gestoras acima: administração
  inteiramente backoffice.
- **Entrega do convite de novo `representante_legal` por deep link automático** (RF-REP-03) — por
  ora usa um código digitado manualmente, compartilhado pelo representante_legal fora do app (ex.
  WhatsApp); não há infraestrutura de deep link real ainda (mesma lacuna do item de RF-CAD-14
  acima), e não é pré-requisito para o convite funcionar. O convite de `visualizador` não tem essa
  lacuna — já vai por e-mail automaticamente (RF-REP-03).
