# Fynvex App

App móvel (React Native) de antecipação de recebíveis para profissionais de saúde (PJ). Self-service:
cadastro com leitura automática de documentos por IA, login por CNPJ + senha + leitura facial,
solicitação de antecipação a partir de Nota Fiscal, e acompanhamento até a liquidação.

Para contexto completo do repositório (o que cada pasta é, convenções, arquitetura, comandos de
verificação), ver [`CLAUDE.md`](./CLAUDE.md) — é o documento vivo, mantido atualizado a cada
mudança. Os requisitos funcionais/não-funcionais e o contrato de API estão em
[`Especificacao-Requisitos-Fynvex.md`](./Especificacao-Requisitos-Fynvex.md) (ou o
`.html` gerado a partir dele).

## Rodando localmente

Backend real ainda não expõe os endpoints novos — o app roda hoje contra um backend mockado
(`USE_MOCK_API=true` no `.env`, ver `src/api/mocks/`).

```sh
npx tsc --noEmit
npx eslint src/
npx react-native start --port 8082
# em outro terminal:
npx react-native run-android --port 8082
```

Não existe suíte de testes automatizada (unit/integration) — verificação é lint + type-check +
execução manual no emulador, mesmo modelo do `payproxy-app`. Ver a seção "Testes" de
[`CLAUDE.md`](./CLAUDE.md) para o roteiro.
