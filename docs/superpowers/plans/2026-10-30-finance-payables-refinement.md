# Finance payables refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans, directly without subagents as requested.

**Goal:** Aplicar refinamentos aprovados e eliminar atualização desnecessária dos modais.
**Architecture:** Reutilizar componentes e estilos de Lançamentos; dueStatus opcional na consulta existente, antes da paginação. Separar fechamento de atualização, preservando reconciliação de falhas.
**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, Supabase, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-30-finance-payables-refinement-design.md

## Global Constraints

Execução direta na branch codex/finance-accounts-payable; sem subagentes, push ou merge. Migrações anteriores imutáveis. Testes de escrita exclusivamente locais. Não alterar regras financeiras ou permissões.

## Review Focus

Fechamento após resposta perdida/conflito; categoria criada em modal filho; intervalos de pendências antigas; datas relativas em São Paulo e mudança de dia; largura 320 px, nomes longos e alternância entre abas.

### Task 1: Filtro de situação completo

**Files:** schemas/types/service de finance-payable; nova migração de query_finance_payables; supabase/tests/finance_payables_filters.sql; teste do schema.
**Interfaces:** Consome PENDING/PAID/ALL e consulta paginada existente. Produz dueStatus ALL/OVERDUE/TODAY/UPCOMING com default ALL; itens/total filtrados, contadores das abas no período sem dueStatus; PAID ignora recorte.

- [x] Acrescentar teste de entrada válida/inválida e SQL com mais de 20 contas, todas situações, combinações categoria/busca, página vazia, PAID e isolamento.
- [x] Executar testes e verificar falha por parâmetro ainda não suportado.
- [x] Adicionar validação e migração preservando autorização/grants e contratos.
- [x] Executar testes focados, SQL local, Advisors e comparar tipos regenerados. Expected: PASS, sem nova exposição ou alteração de assinatura.

### Task 2: Interface e modais

**Files:** finance-shell.tsx/styles.ts, finance-payables.tsx, finance-payable-details.tsx/form.tsx/copy.tsx, use-payable-mutation.ts, financeiro/page.tsx e contas-a-pagar/page.tsx; e2e/finance-payables.spec.ts e e2e/finance-payables-refinement.spec.ts.
**Interfaces:** Consome dueStatus da tarefa 1; onClose(refresh?: boolean) indica reconciliação de tentativa de gravação, não fechamento simples.

- [x] Criar regressão de navegador que abre/fecha Nova conta sem requisição/indicador de atualização; verificar RED.
- [x] Implementar filtros, busca, abas/badge, largura estável, sidebar, remoção do resumo, título e detalhes/sanfona.
- [x] Separar fechamento de atualização; reconciliar falhas de gravação e conflitos. Preservar cópia e categoria filha.
- [x] Atualizar cenários existentes e acrescentar situações, fechamento de editar/detalhes/excluir/pagar/cópia, dimensões e cores. Expected: navegação, cópia, concorrência, resposta perdida e novos fluxos PASS.
- [x] Executar lint, typecheck, testes, build e E2E locais; revisar visualmente screenshots desktop/mobile; fazer revisão própria do diff e registrar evidências; commit local.
