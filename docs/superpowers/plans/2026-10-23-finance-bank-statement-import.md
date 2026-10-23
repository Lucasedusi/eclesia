# Lançamento via extrato bancário — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Execução direta e autorrevisão, sem subagentes, por instrução explícita do usuário.

**Goal:** Importar XLSX do Sicoob para uma fila persistente e transformar itens conferidos em movimentos financeiros rastreáveis.

**Architecture:** Adaptador XLSX server-only prepara dados imutáveis; novas tabelas preservam lotes, itens, vínculos e decisões. RPCs autorizadas executam a confirmação e o comando financeiro na mesma transação. Server Actions e páginas financeiras expõem DTOs limitados, e a interface reutiliza o formulário financeiro.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, ExcelJS 4.4.0, Supabase/Postgres, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-finance-bank-statement-import-design.md` (aprovada em 23/10/2026).

## Global Constraints

- Branch `codex/finance-bank-statement-import`; sem publicação ou banco online.
- Sem subagentes. Banco, usuários e dados de teste exclusivamente locais.
- XLSX de até 5 MB e 5.000 movimentos; sem guardar o arquivo original ou dados em armazenamento offline.
- Data, direção, total e conta vêm da origem armazenada; vínculo e movimentação são atômicos.
- Isolamento por igreja/unidade/conta e permissões existentes, com RLS e concessões mínimas.
- Leitura não cria movimento; relatórios e comprovantes preservam seus fluxos.

## Review Focus

- Arquivos com cabeçalhos/saldos repetidos ou várias datas não podem perder linhas: testar parser na tarefa 1.
- Valores em centavos, documentos repetidos e ocorrências legítimas idênticas não podem ser fundidos: tarefas 1 e 2.
- Duas pessoas ou resposta perdida não podem confirmar duas vezes: tarefa 2 e concorrência na tarefa 5.
- Correção/cancelamento posterior deve reabrir a necessidade de conferência sem recriar dinheiro: tarefas 2 e 4.
- Cliente pode fabricar IDs ou payload de origem: tarefa 2 testa escopo/RLS e tarefa 3 testa reconstituição confiável.

## Task 1: Leitor Sicoob e contratos

**Files:** criar `src/modules/finance/import/types.ts`, `schemas.ts`, `parser.service.ts`, `parser.service.test.ts`, `schemas.test.ts`.

**Interfaces:** `parseBankStatement(buffer: Buffer): Promise<ParsedBankStatement>`; `ParsedBankStatement` contém `parserVersion`, `rows`, `balances`, `reconciliation`; cada linha tem posição, data ISO, referência, histórico, complemento, centavos assinados e erros de leitura. `bankImportMutationSchema` valida rascunho/registro/vínculo/ignorar/restaurar/reabrir/duplicidade.

- [ ] Escrever testes de leitura: 33 movimentos/22 créditos/11 débitos, três saldos, múltiplas datas, referências repetidas, linha desconhecida retida, fórmula e ZIP excessivo rejeitados.
- [ ] Executar `npm test -- src/modules/finance/import/parser.service.test.ts` e verificar falha pelo leitor ausente.
- [ ] Implementar validação de ZIP e leitura limitada com ExcelJS, valores em centavos e resultado de reconciliação.
- [ ] Testar esquemas estritos e incompatibilidades de ações; executar testes de `src/modules/finance/import` e conferir aprovação.
- [ ] Commit `feat(finance): parse Sicoob statements for review`.

## Task 2: Persistência e comandos atômicos

**Files:** criar migração via CLI `finance_bank_statement_import`; criar `supabase/tests/finance_bank_import_verification.sql`; regenerar `src/lib/supabase/database.types.ts`.

**Interfaces:** `prepare_finance_bank_import(p_church_id,p_unit,p_cashbox,p_file_hash,p_file_name,p_data)` retorna ID/replay; `get_finance_bank_import(p_church_id,p_unit,p_batch,p_filters)` retorna lote, contagens, itens paginados; `list_finance_bank_imports(p_church_id,p_unit,p_cashbox,p_page)`; `finance_bank_import_item(p_church_id,p_unit,p_item,p_revision,p_operation_key,p_action,p_payload)`; `finance_bank_import_candidates(p_church_id,p_unit,p_item,p_query)`.

- [ ] Escrever verificações SQL de preparação sem ledger, RLS/cross-tenant, reenvio, rascunho, conflito de revisão, repetição de confirmação, vínculos, transferências, ignorar/restaurar, correção posterior e repetição textual legítima.
- [ ] Executar SQL local e verificar falha por função ausente.
- [ ] Criar tabelas de lotes/itens/vínculos/eventos/operações, índices e grants mínimos; leitura restrita e escritas por RPCs autorizadas.
- [ ] Implementar confirmação com trava de igreja/item na mesma ordem do núcleo financeiro; reconstituir dados de origem e validar total. Vínculos usam FKs por igreja e exclusividade de transação/ponta para origens distintas; alias de duplicidade aponta para item canônico.
- [ ] Repetir SQL, verificar grants/advisors locais e regenerar tipos. Expected: verificações aprovadas e nenhuma função anônima.
- [ ] Commit `feat(finance): persist and finalize statement imports atomically`.

## Task 3: Serviços e ações autorizadas

**Files:** criar `src/modules/finance/import/service.ts`, `actions.ts`, `service.test.ts`; adicionar tag de importação se necessária em `src/lib/cache-tags.ts`.

**Interfaces:** ações `prepareBankImportAction(FormData)`, `mutateBankImportAction(unit,itemId,revision,operationKey,action,payload)`, `getBankImportCandidatesAction(unit,itemId,query)`; serviço `listBankImports(context,...)` e `getBankImport(context,...)` consomem RPCs da tarefa 2 e devolvem tipos da tarefa 1.

- [ ] Testar arquivo inválido, unidade incompatível, referência de caixa inválida e erros seguros; verificar chamadas derivam igreja do contexto.
- [ ] Executar testes e observar falha por serviço ausente.
- [ ] Implementar parsing no servidor, hash do arquivo, validação Zod e chamadas autenticadas; não registrar dados sensíveis. Invalidar tags da unidade após mutações e manter retries com chave persistente.
- [ ] Executar testes focados e typecheck. Expected: aprovação.
- [ ] Commit `feat(finance): expose authorized statement review actions`.

## Task 4: Interface de importação e conferência

**Files:** criar páginas `src/app/(finance)/financeiro/lancamentos/importacoes/page.tsx` e `[id]/page.tsx`; componentes sob `src/modules/finance/import/`; modificar `finance-transactions-workspace.tsx` e `finance-entry-form.tsx`; adicionar estilos ao padrão existente; criar `e2e/finance-bank-import.spec.ts` conforme diretório real da suíte.

**Interfaces:** formulário financeiro ganha configuração opcional `bankImport` com origem imutável, rascunho e submit customizado. Uso manual mantém o comportamento. Painel da importação usa ações/DTOs da tarefa 3 e os catálogos/capacidades existentes.

- [ ] Criar cenários de navegador: importar fixture, pendências/saldos, rascunho retomável, finalizar/próximo, vínculo existente, transferência, ignorar/restaurar e orientação mobile; observar falha da navegação ausente.
- [ ] Implementar histórico paginado de lotes, escolha de conta, upload, fila com filtros/busca/paginação e detalhe de origem, candidatos e histórico.
- [ ] Integrar formulário de entrada/saída/atendimento, valores protegidos, total validado, rascunho e finalização; criar fluxo autorizado de transferência e resolução de vínculo/reabertura.
- [ ] Executar os cenários autenticados locais, testar teclado/erros e inspecionar capturas desktop/mobile. Expected: aprovação sem dados reais.
- [ ] Commit `feat(finance): add persistent bank statement review workspace`.

## Task 5: Verificação integrada e entrega local

**Files:** criar `docs/finance/2026-10-23-bank-statement-import.md`; complementar testes SQL/concorrência quando a integração revelar lacunas.

- [ ] Reexecutar verificações SQL financeiras afetadas e concorrência real de dois usuários no mesmo item, incluindo confirmação/retentativa e outro arquivo sobreposto.
- [ ] Rodar `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test`, `npm run build` com ambiente local e `npm run test:e2e` nos fluxos financeiros afetados.
- [ ] Conferir importação do exemplo real somente em memória local (contagens e reconciliação); dados fictícios no navegador/banco.
- [ ] Revisar diff completo, isolamento, correções posteriores, dados sensíveis, grants e histórico de migrações; registrar decisões e limitações.
- [ ] Documentar uso, evidências e preparação para teste manual; commit `docs(finance): document statement import validation`.
- [ ] Entregar branch local para conferência sem merge/push ou aplicação remota.
