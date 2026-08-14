# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Regras fundamentais

- **Responda sempre em português.**
- **Teste tudo após codificar — nenhuma tarefa está concluída sem verificação.** Ver seção
  "Testes" (fim deste arquivo) para o que isso significa em cada parte do repositório.

## What this repository is

The repo root holds four independent things — don't assume changes in one belong in another:

- **`prototipo/`** — a **static, framework-free HTML/CSS/JS clickable prototype** of the Fynvex
  mobile app (receivables anticipation for healthcare professionals/companies). No backend, no build step, no
  package manager — `prototipo/index.html` is opened directly in a browser (`file://`) and
  everything runs client-side. This is a **product-vision exploration**, not a 1:1 spec of an
  existing system. See `prototipo/README.md` for what's simulated vs. real and the debug tools
  panel — several things that look like they could be "fixed" (no boleto in the real system, no
  Pix key-type selector, deságio vs. "juros", etc.) are deliberate, researched decisions, not
  oversights.
- **`Especificacao-Requisitos-Fynvex.md`** (+ generated `.html` twin, same styling/toolbar model as
  `payproxy/Especificacao-Requisitos-Payproxy.html` — do not hand-edit the `.html`, regenerate it
  from the `.md`) — the formal requirements spec (functional/non-functional requirements + the new
  API endpoints that need to be built in the real backend to support this app). This is the
  forward-looking design document for the *real* implementation. The prototype predates and
  informed this spec; when the two disagree, the spec reflects the latest decisions.
- **`sistema-fynvex/antecipacao-develop/antecipacao-develop/`** — the real Fynvex backend (Laravel
  12 / PHP), a separate, independent codebase. It is a staff-operated back-office; it has **no
  self-service API** for a company to register or request an anticipation. Do not assume code in
  the prototype exists there, and do not edit that project when working on the prototype or the spec.
  Confirmed: when backend implementation begins, the new endpoints in spec §4 get added as new
  routes/controllers **inside this same Laravel app** — there is no separate new backend service.

## Stack e arquitetura do app real (React Native) — em implementação

O app mobile real da Fynvex (o que `prototipo/` simula em HTML) **já existe como código** neste
repositório, em `src/` (scaffold React Native completo, roda no emulador Android via
`gradlew.bat`/`npx react-native run-android`) — mas não é uma implementação completa de tudo que
está na especificação: telas de Perfil, gestão de múltiplos representantes e o fluxo de convite
ainda não têm UI (só parte do backend mockado). Usa **exatamente a mesma stack e arquitetura do
`payproxy-app`** (`C:\Users\raimundo.araujo\Documents\Projetos\payproxy-app`), como já decidido —
não avalie alternativas de framework/lib sem que o usuário peça explicitamente. Copiada do
`CLAUDE.md` do payproxy-app:

| Camada | Tecnologia |
|---|---|
| Framework | React Native 0.86.2 |
| Linguagem | TypeScript |
| Navegação | React Navigation 7 (`@react-navigation/native`, `bottom-tabs`, `native-stack`) |
| Estado global | Zustand |
| Armazenamento seguro | `react-native-keychain` — session token |
| Cache offline | `@react-native-async-storage/async-storage` |
| Push notifications | `@react-native-firebase/messaging` (FCM HTTP v1) |
| Ícones | `react-native-vector-icons/MaterialCommunityIcons` |
| HTTP | Axios via `src/api/client.ts` (interceptor Bearer token) |
| Estilos | `StyleSheet.create` puro — sem biblioteca de UI externa |

Estrutura de pastas a seguir (mesmo padrão do payproxy-app, adaptado ao domínio Fynvex):
```
src/
├── api/            # client.ts (axios + interceptor) + um arquivo por domínio (auth, cadastro, antecipacoes, perfil)
├── components/      # visuais puros, sem chamada HTTP inline
├── hooks/           # useAuth, usePushNotifications, etc.
├── navigation/       # RootNavigator + navigators por fluxo
├── screens/           # uma pasta por fluxo (auth/, cadastro/, home/, antecipacao/, perfil/)
├── store/              # Zustand — sessão/auth
└── types/               # tipos TypeScript
```

Os endpoints que o app vai consumir (rotas, request/response JSON) já estão especificados na
seção 4 de `Especificacao-Requisitos-Fynvex.md` — usar esse contrato ao escrever `src/api/`, não
inventar formato novo.

### Backend mockado — `src/api/mocks/`

Os endpoints reais (`/api/v1/app/*`) ainda não existem no `sistema-fynvex`. Enquanto isso,
`src/api/client.ts` troca o `adapter` do axios por `mockAdapter` (`src/api/mocks/adapter.ts`)
quando `Config.USE_MOCK_API === 'true'` (`.env`) — a troca é só nesse ponto, então o mock passa
pelos mesmos interceptors de request/response de uma chamada real (inclusive o forceLogout em
401, RNF-18). `src/api/mocks/fixtures.ts` guarda todo o estado em memória (empresas,
representantes, antecipações, sessões de leitura facial) — reinicia a cada reload do Metro, não é
persistência de verdade. Cada domínio tem seu próprio `*.mock.ts` (auth, cadastro, antecipacoes,
perfil); handlers lançam `{status, data: {error_code, message}}` pra simular respostas de erro.
Trocar para o backend real quando ele existir = apagar `src/api/mocks/` + `USE_MOCK_API=false`,
sem tocar em telas ou nos arquivos `src/api/*.ts` (que já falam o contrato real).

### Modelo de domínio: representante ≠ empresa

Sessão, template biométrico e senha são por **representante** (pessoa), não por empresa/CNPJ —
uma empresa pode ter mais de um representante, cada um com seu perfil de acesso
(`administrador`/`operador`, seção 1.15 da spec). Isso está parcialmente implementado: os tipos
(`src/types/index.ts`) e boa parte do mock (`fixtures.ts`, `auth.mock.ts`, `perfil.mock.ts`) já
refletem esse modelo, mas ainda faltam as telas (Perfil, gestão de representantes, convite,
recuperação de conta por e-mail) — checar a especificação (seções 1.1, 1.15, 1.16) antes de
assumir que uma tela de auth/perfil já existe.

Os requisitos de segurança do app (pinning de certificado, detecção de root/jailbreak, logout
centralizado em 401, timeout de sessão, hardening do build de release, etc.) estão na seção 2.5
do mesmo documento — levantados a partir de uma auditoria real do `payproxy-app` (que serve de
piso, não de teto: vários itens ali ainda estão incompletos ou são código morto, ex. o hook de
biometria nunca é chamado). Implementar 2.5 por completo, não só copiar o que o payproxy-app tem hoje.

## Commands

`prototipo/` has no build/lint/test tooling by design (static prototype, no `package.json` in
that folder). The real RN app (repo root `package.json`) does — mirrors payproxy-app's commands:
```bash
npx tsc --noEmit                              # type-check
npx eslint src/                                # lint
cd android && ./gradlew.bat app:installDebug -PreactNativeDevServerPort=8082   # build + instala no emulador
```
Ver a seção "Testes" para o roteiro de verificação manual no emulador depois de qualquer mudança.

- **Run the prototype**: open `prototipo/index.html` in a browser (double-click, or a file:// URL).
  No server needed.
- **Reset app state** during manual testing: use the floating 🛠 dev-tools button (bottom-right of
  the phone frame) → "Resetar protótipo", or run `localStorage.clear()` in the browser console and
  reload.
- **Regenerate the spec HTML** after editing `Especificacao-Requisitos-Fynvex.md`: there is no
  checked-in converter script (it was a throwaway build in a scratch directory during development).
  Rebuilding it means re-deriving the same transform: wrap each `**RF-/RNF-/RN-NNN**` paragraph into
  a `.req`/`.req-rnf`/`.req-rn` card, headings into `.sec-heading`, reusing the CSS/JS verbatim from
  `payproxy/Especificacao-Requisitos-Payproxy.html`.

## Architecture (of `prototipo/`)

### Single-file, multi-screen navigation (no router, no framework)

Every "screen" is a `<section class="screen" data-screen="...">` inside `prototipo/index.html`,
all present in the DOM at once. `prototipo/js/app.js` toggles visibility by adding/removing the
`.active` class — see `Nav.to(screenId)`. There are ~25 screens (auth, onboarding, home/list, the
anticipation-request flow, payment, profile); grep `data-screen=` in `index.html` for the
authoritative list rather than trusting any prose description to stay in sync.

When a screen becomes active, `Nav.to()` looks up and calls a matching entry in the `ScreenHooks`
object (bottom of `app.js`) if one exists. This is where per-screen setup lives: populating fields
from `AppState`, rendering dynamic lists, starting a fake "processing" timer, etc. **If you add a
new screen that needs to render data on entry, add it to `ScreenHooks`** — nothing runs
automatically just because a screen became visible.

### State: one global object, persisted to `localStorage`

`prototipo/js/state.js` defines `AppState`, a singleton wrapping a single JSON-serializable object
(`AppState.data`), auto-persisted via `AppState.save()` / loaded via `AppState.load()`. There is no
event system or reactivity — after mutating `AppState.data`, screens re-render themselves by calling
their own render function again (e.g. `renderHome()`), not via subscription. Session, KYC status,
uploaded-document flags, bank data, and the list of anticipation requests (`advanceRequests`) all
live under this one object.

### Mock data and "fake but plausible" generators

- `prototipo/js/mock-data.js` (`MockData`) holds business rules that were deliberately
  reverse-aligned to the real backend's actual domain vocabulary (deságio %, taxa administrativa,
  document types, the 5-state `statusLabels` lifecycle: `solicitada → pendente_analise →
  aguardando_pagamento → rejeitada|cancelada`). Read the "Alinhamento com o sistema real" section of
  `prototipo/README.md` before changing any of these — the naming is intentional, not a guess.
- `prototipo/js/qrcode-mock.js` generates a decorative (non-scannable) QR code SVG and a decorative
  barcode + `linha digitável` string, both deterministic from a seed string (same input → same
  visual output). There is no real OCR/AI behind the "IA lê o documento" screens (Contrato Social,
  Nota Fiscal) — it's a timed spinner followed by data pulled from a fixed mock/pool in `MockData`.

### Document upload & multi-step flows are generic, reused patterns

`renderDocsList()` / `toggleDocAttached()` / `docIconSvg()` in `app.js` render a checklist of
"attach this document" cards from a declarative spec array (e.g. `MockData.docsEmpresa`,
`MockData.docsNotaFiscal`) and are reused across onboarding and the anticipation-request flow rather
than having bespoke markup/logic per flow. The AI-extraction UX (upload → "lendo..." spinner →
review extracted fields → confirm) is also duplicated by convention between the Contrato Social flow
(`signup-ai-*`) and the Nota Fiscal flow (`advance-nf-*`) — when changing one, check whether the
other needs the same fix.

### Debug/dev tools are part of the product surface, not scaffolding to delete

The floating 🛠 button and its panel (`toggleDevTools()` and the `debug*` functions in `app.js`)
exist because several state transitions are driven by fake timers (`scheduleAdvanceLifecycle`,
`scheduleAutoApprove`) that would otherwise require waiting tens of seconds to demo. These are
intentionally kept visible in the UI, not hidden behind a flag — don't remove them as "cleanup"
without checking with the user first.

## Testes

Nenhuma alteração de código é considerada concluída sem verificação. O que "testar" significa
depende de qual parte do repositório foi tocada — nenhuma delas tem suíte de testes automatizada
(unit/integration), **igual ao payproxy-app**, que também não tem Jest/RNTL configurado:

### `prototipo/` (protótipo estático)
Não existe test runner. Depois de qualquer mudança:
1. Abrir `prototipo/index.html` no navegador e navegar manualmente pelo fluxo alterado.
2. Para verificação repetível, escrever um script Playwright descartável (headless Chromium,
   `file://`) que percorra o fluxo de ponta a ponta e confira `page.on('console'/'pageerror')` —
   esse foi o padrão usado durante todo o desenvolvimento. Salvar esse script fora do repositório
   (pasta de scratch/temp), não commitar.
3. Conferir visualmente pelo menos uma vez com screenshot (`page.screenshot()`) — erros de layout
   não aparecem no console.

### App real (React Native)
Mesmo modelo do payproxy-app (`payproxy-app/CLAUDE.md` → seção "Comandos"), que **não tem testes
unitários** — a verificação é lint + type-check + execução manual:
```bash
npx eslint src/          # lint
npx tsc --noEmit         # type-check
npx react-native run-android --port 8082   # roda no emulador para verificar manualmente
```
Depois de qualquer mudança de tela/fluxo, reabrir a tela alterada no emulador (Ctrl+M → Reload) e
exercitar o caminho alterado manualmente antes de considerar a tarefa pronta — não existe
alternativa automatizada a isso neste stack, então não pular essa etapa.

### `Especificacao-Requisitos-Fynvex.md` / `.html`
"Testar" aqui significa: depois de editar o `.md`, regenerar o `.html` (ver "Commands") e abrir no
navegador para confirmar que os requisitos alterados renderizam corretamente dentro dos cards
`.req`/`.req-rnf`/`.req-rn` e que a contagem de requisitos/tabelas/blocos de código bate com o
esperado — não apenas confiar que a conversão funcionou.
