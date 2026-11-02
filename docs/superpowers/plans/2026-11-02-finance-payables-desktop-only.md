# Contas a pagar exclusivamente no desktop

> Execução direta com a habilidade executing-plans, sem subagentes, conforme solicitação do usuário.

**Goal:** remover Contas a pagar do mobile, incluindo abertura direta, preservando o fluxo administrativo no desktop.
**Architecture:** identificação de celulares/tablets no servidor com o helper do Next.js, após autorização; limite visual de 760 px já usado no Financeiro no cliente. A fronteira de apresentação desmonta o conteúdo e seus modais no modo mobile. Autorização, escopo Catedral e banco permanecem inalterados.
**Tech Stack:** Next.js 16, React 19, TypeScript, Styled Components e Playwright existentes.
**Spec:** pedido de 02/11/2026 neste chat, substituindo a disponibilidade mobile da proposta inicial.

## Restrições e revisão

- Manter a branch atual; não publicar nem alterar o banco online.
- Usar o ambiente local e encerrá-lo após a conferência.
- Verificar celulares na horizontal, tablets, abertura direta e mudança de largura com modal aberto.
- Manter autorização antes da verificação de dispositivo, sem confiar no dispositivo como permissão.
- Preservar congregação/período ao voltar à visão geral e os demais itens do menu mobile.

## Execução

- [x] Adicionar `e2e/finance-payables-desktop.spec.ts`; observar falta da restrição no acesso direto e ao reduzir a janela.
- [x] Em `finance-shell.tsx`, marcar o item como exclusivo do desktop e filtrá-lo da navegação mobile; em `financeiro/layout.tsx`, não oferecer o atalho a celulares/tablets identificados.
- [x] Em `financeiro/contas-a-pagar/page.tsx`, manter autorização, identificar o dispositivo antes de consultar contas e renderizar `finance-payables-access.tsx`; o novo componente usa `useFinanceDesktop`, mensagem explicativa e retorno à visão geral.
- [x] Substituir os cenários antigos de operação mobile por restrição; manter as regressões de operação em desktop nos três arquivos de testes existentes.
- [x] Executar lint, typecheck, Vitest, build e testes de navegador afetados; inspecionar a mensagem no celular, registrar resultados e salvar commit local.

## Registro de execução e revisão

- Revisão própria, sem delegação, conforme orientação do usuário. Autorização permanece antes da decisão de dispositivo; nenhuma alteração nos serviços ou políticas do banco.
- Ajuste necessário na rotina local: justificativa retroativa para a fixture de outubro continuar válida em novembro. Nenhuma flexibilização de regra de negócio.
- Capturas limitadas à área visível, pois a captura completa altera transitoriamente a largura para 1 px no Chromium e provoca a própria restrição que está sendo testada.
- Resultado: 633 testes unitários e 27 cenários de navegador aprovados, além de compilação, tipos e lint. Evidências e ocorrências em `docs/finance/2026-11-02-accounts-payable-desktop-only.md`.
