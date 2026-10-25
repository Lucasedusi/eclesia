# Bank import navigation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. User explicitly prohibits subagents and already approved execution.

**Goal:** Compactar os controles e impedir a restauração de edições encerradas.
**Architecture:** Limpar estado transitório nos eventos de sucesso e no encerramento de Activity. Manter formulários, ações, proteção de navegação e rotinas de banco existentes; controle de rascunho ligado ao formulário por ref, dentro de Mais opções.
**Tech Stack:** Next.js 16, React 19, TypeScript, Styled Components, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-24-bank-import-navigation-design.md

## Global Constraints
- Branch `codex/finance-bank-statement-import`; sem subagentes, publicação, main ou escrita online.
- Sem novas dependências ou migrações. Harness local e dados fictícios. Encerrar servidor ao final.

## Review Focus
- Voltar/avançar e navegação interna preservada não podem reabrir item encerrado.
- Falha de envio mantém arquivo; sucesso e saída limpam seleção.
- Rascunho deve poder ser salvo com campos incompletos, sem criar lançamento.
- Retentativa após resposta perdida não duplica lançamento nem libera saída antes de confirmar.
- Filtro e última página devem continuar válidos ao concluir o último item.

### Task 1: Navegação e formulário
Files: bank-import-{list,workspace,review}.tsx, finance-entry-form.tsx; e2e/finance-bank-import-navigation.spec.ts e finance-bank-import.spec.ts.
Interfaces: Review.onResult(item, action: BankImportMutation['action']); BankImportEntry.draftControl e submit(command), sem avanço automático. Rascunho usa a rotina existente via ref; o botão principal permanece o envio padrão do formulário, inclusive por Enter.
- [x] Escrever testes reais de upload/saída/retorno e de salvar/rascunho; observar falhas antes da correção.
- [x] Limpar arquivo e item transitório com eventos e cleanup de Activity; preservar estado persistido e guardas de retentativa.
- [x] Manter apenas Salvar na prévia; mover rascunho para Mais opções; concluir POST/LINK/DUPLICATE na fila, preservando filtros/página.
- [x] Adaptar e executar regressão de importação e cenários de navegação até passar.

### Task 2: Controles compactos
Files: bank-import-list.tsx, bank-import-lifecycle.tsx, bank-import.styles.ts e teste de navegação.
Interfaces: menu nativo popover apenas para DELETE_BATCH; ação final usa a mesma confirmação/RPC. Upload preserva input acessível e seleção/arrastar arquivo.
- [x] Verificar dimensões do upload e menu fechado por padrão no teste; observar falha inicial.
- [x] Compactar upload e usar três pontos com Excluir, preservando impedimentos e confirmação.
- [x] Verificar teclado, fechamento do menu ao sair e capturas desktop/intermediária.

### Task 3: Validação e entrega
- [x] Lint sem warnings, typecheck, npm test e build com configuração local.
- [x] E2E de importação/navegação e regressão do formulário compartilhado; revisão manual do diff e dos casos de erro.
- [x] Documentar evidências, commits locais e servidor encerrado. Nenhuma migração, consulta ou escrita online.

## Decisão verificada durante implementação
O botão externo de envio associado por `form` se tornava o envio padrão do formulário no navegador. Um teste com Enter reproduziu o salvamento involuntário de rascunho. Foi substituído por um controle estreito via `useImperativeHandle`, preservando estado, validação e guardas do mesmo formulário.
