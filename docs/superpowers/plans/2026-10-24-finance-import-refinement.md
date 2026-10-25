# Finance import refinement Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; user explicitly prohibits subagents.

**Goal:** Simplificar as telas de importação e permitir remoções auditadas sem histórico financeiro.
**Architecture:** Reutilizar formulários e estilos financeiros; nova RPC de ciclo de vida separada, com soft delete e restauração de itens. Preservar consultas em conjunto.
**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgreSQL, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-24-finance-import-refinement-design.md

## Global Constraints
- Branch codex/finance-bank-statement-import. Sem subagentes, push, merge ou escrita online.
- Migrações anteriores imutáveis. Atualizar somente banco local; preservar RLS, audit e escopos.
- Testes fictícios; servidor temporário encerrado ao final.

## Review Focus
- Excluir após desvincular ou cancelar nunca pode apagar rastreabilidade financeira (SQL).
- Repetir solicitação após resposta perdida preserva revisão e evita restaurar indevidamente (SQL).
- Excluir a última linha da última página precisa permitir voltar à página válida (E2E/SQL).
- Rascunho antigo rateado não pode perder classificação sem decisão explícita (UI/E2E).
- Mais opções precisa preservar correções e proteção de duplicidade sem bloquear fluxo normal (E2E).

### Task 1: Ciclo de vida auditado
Files: nova migration, supabase/tests/finance_bank_import_lifecycle.sql, import/{types,schemas,service,actions}.ts e testes, finance-errors.ts, database.types.ts gerado.
Interfaces: manage_finance_bank_import(p_church_id,p_unit,p_batch,p_item,p_revision,p_operation_key,p_action), ações DELETE_BATCH/DELETE_ITEM/RESTORE_ITEM. DTOs canDelete/deleted e filtro DELETED.
- [x] Escrever e executar SQL vermelho para RPC ausente; testes Zod/serviço para escopo e entradas.
- [x] Criar migração via CLI, implementar remoção/restauração idempotente, autorização, travas, histórico e contadores/filtro.
- [x] Aplicar apenas local, regenerar tipos, executar SQL e testes focados até passar.

### Task 2: Telas e conferência
Files: bank-import-{list,workspace,review,styles}, finance-entry-form.tsx; componente de confirmação de exclusão; E2E.
Interfaces: Server Action de gerenciamento com retorno {batchId,itemId,deleted,replayed}; campos DTO da Task 1; aparência lateral independente do mode financeiro.
- [x] Atualizar E2E e observar ausência de novos controles antes da implementação.
- [x] Implementar upload/cards/paginação/status/ícones, exclusão e recuperação; preservar atualização de totais.
- [x] Recolher transferências/vínculos/decisões em Mais opções; alertas condicionais e rascunhos antigos tratados explicitamente.
- [x] Verificar E2E, layout desktop e intermediário; revisar capturas fictícias.

### Task 3: Validação e entrega
- [x] Executar lint, typecheck, npm test, build local e E2E afetados.
- [x] Executar regressão SQL de importação, performance e advisors locais; revisar diff/segurança manualmente, sem subagentes.
- [x] Registrar resultados e limitações, encerrar servidor; commits locais na branch separada.
