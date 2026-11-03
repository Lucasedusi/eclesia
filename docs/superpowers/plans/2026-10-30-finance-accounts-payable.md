# Contas a pagar da Catedral — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Implementação direta e revisão própria, sem subagentes, conforme autorização do usuário.

**Goal:** Entregar checklist administrativo exclusivo da Catedral, com histórico, cópia mensal e experiência desktop/mobile.

**Architecture:** Reutilizar `accounts_payable` com marcador explícito para o novo fluxo, valor opcional, revisão e vínculos compostos. RPCs autorizadas e atômicas controlam consulta, histórico e comandos; serviços server-only validam DTOs. Interface utiliza os componentes, navegação e padrões do Financeiro.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, Zod, Supabase/Postgres, Vitest e Playwright.

**Spec:** `docs/superpowers/specs/2026-10-30-finance-accounts-payable-design.md` (aprovada em 30/10/2026).

## Global Constraints

- Branch nova `codex/finance-accounts-payable`, base `2fd1da3`, main conferida com origin/main.
- Sem subagentes, banco online, publicação ou merge. Apenas dados fictícios locais; encerrar servidores ao concluir.
- Lista da sede resolvida no servidor, independente da unidade das outras telas, administradores ativos CHURCH com permissão específica.
- Data de vencimento determina período; confirmação não cria saída; valor ausente não é zero.
- Reaproveitar categorias EXPENSE/BOTH, preservar legado sem reatribuição, histórico e permissões.
- Novas migrações apenas; tipos regenerados pelo CLI; Next.js documentado localmente antes de escrever código.

## Review Focus

- Mudança de unidade ou churchId forjado não muda propriedade nem permite acesso por tesoureiro.
- Rede perdida após gravação: repetir mesma chave retorna resultado, sem duplicar evento ou cópia.
- Fim de mês/ano, ano bissexto e meia-noite local não ocultam pendências nem deslocam datas.
- Categoria inativa e edição concorrente exigem conferência, sem sobrescrever ou copiar parcialmente.
- Conta sem valor e legado com zero permanecem distintos e não alteram razão/saldo financeiro.

### Task 1: Contratos e regras de calendário

**Files:** criar `validations/finance-payable.schemas.ts`, `types/finance-payable.types.ts`, `utils/finance-payables.ts` e seus testes em `src/modules/finance/`.

**Interfaces:** `payableCommandSchema`, `payableQuerySchema`, `payablePageSchema`, `payableDetailSchema`; `payableStatus(status,dueDate,today)`, `nextPayableDate(date)`, `canManagePayables(auth)`.

- [x] Escrever testes que rejeitam valor zero, data inválida/futura de pagamento, titularidade enviada, intervalo incompleto e cópia duplicada; datas literais 2028-01-31 → 2028-02-29, 2026-01-31 → 2026-02-28 e 2026-12-31 → 2027-01-31; tesoureiro com permissão continua negado.
- [x] Rodar `npm test -- src/modules/finance/utils/finance-payables.test.ts src/modules/finance/validations/finance-payable.schemas.test.ts`; esperar falha de módulos ausentes.
- [x] Implementar os contratos, comandos CREATE/UPDATE/PAY/REOPEN/DELETE/COPY com requestId e revisão; filtros por vencimento e página de 20 itens.
- [x] Repetir os testes; esperar todos aprovados.

### Task 2: Persistência, autorização e histórico

**Files:** `supabase/migrations/20261030140816_finance_cathedral_payables.sql`, complementos `20261030144454_finance_payables_category_index.sql` e `20261030144935_finance_payables_conflict_response.sql`, `supabase/tests/finance_payables.sql`, tipos gerados.

**Interfaces:** `private.finance_payables_headquarters(church)`; `public.query_finance_payables(church,options)`, `public.get_finance_payable(church,id)`, `public.execute_finance_payable(church,command)` retornam os DTOs da Task 1.

- [x] Escrever SQL com fixture local e rollback: CRUD, datas, cópia atômica/idempotente, revisão obsoleta, perfis negados inclusive override, igreja errada, RLS/grants, exclusão lógica, histórico, saldo/lançamentos inalterados.
- [x] Rodar no banco local antes da migração; esperar RPC ausente.
- [x] Criar permissão administrativa, adequar tabela antiga com campos do checklist, eventos e recibos privados de idempotência, índices e FKs compostas. Expor apenas leituras restritas e RPCs com validação em profundidade.
- [x] Aplicar exclusivamente localmente; repetir SQL e verificações financeiras afetadas; esperar aprovação com rollback.
- [x] Regenerar `src/lib/supabase/database.types.ts` localmente; revisar diff para não incluir ruído.

### Task 3: Serviços e ações autenticadas

**Files:** criar `services/finance-payable.service.ts`, `actions/finance-payable.actions.ts`, testes de serviço; modificar `auth/constants/permissions.ts`, `lib/cache-tags.ts`.

**Interfaces:** `requirePayableContext()`, `queryFinancePayables(input)`, `getFinancePayable(id)`, `submitFinancePayable(input)` e ações correspondentes; contexto fornece auth, churchId e sede verificada.

- [x] Escrever testes para perfil negado, sede ausente, DTO inválido, entrada de outra unidade rejeitada e erro seguro de banco.
- [x] Rodar teste focado; esperar falha antes do serviço existir.
- [x] Implementar autenticação em cada entrada, cliente autenticado, validação da resposta e invalidação da igreja após sucesso. Categoria continua pelo cadastro existente.
- [x] Rodar testes focados e typecheck; esperar aprovação.

### Task 4: Tela, formulários, ações e navegação

**Files:** criar rota `src/app/(finance)/financeiro/contas-a-pagar/page.tsx`, componentes `finance-payables.tsx`, `finance-payable-form.tsx`, `finance-payable-details.tsx`, `finance-payable-copy.tsx`; modificar shell/layout e estilos existentes. Criar `e2e/finance-payables.spec.ts`.

**Interfaces:** página renderiza DTO da Task 1; componentes usam ações da Task 3, `FinanceCatalogForm` e `useFinanceNavigation`.

- [x] Escrever E2E de cadastro sem valor, nova categoria sem perder campos, filtros, confirmação retroativa, desfazer, editar/excluir, histórico, usuário negado e contexto preservado.
- [x] Rodar E2E em servidor local: esperar rota ausente.
- [x] Implementar tabela/cartões, filtros, abas, paginação, indicadores, proteção de formulário, modais e atualizações na virada do dia. Preservar requestId durante retry e detectar conflito de revisão.
- [x] Implementar cópia com seleção paginada e conferência, valores/datas ajustáveis e categoria ativa; resultado informa cópias existentes.
- [x] Executar E2E desktop/mobile com os casos de datas e duplicação; esperar aprovação.

### Task 5: Resumo e verificação final

**Files:** componente `finance-payable-summary.tsx`, página da visão geral, E2E de resumo; `docs/finance/2026-10-30-accounts-payable-validation.md`.

**Interfaces:** resumo reutiliza contagens da consulta, sempre por hoje e Catedral; atalhos fornecem intervalo de vencimento.

- [x] Escrever E2E de contas vencidas anteriores fora dos filtros, resumo independente da congregação/mês e ausência para tesoureiro; rodar e observar falha.
- [x] Implementar resumo e atalhos com rótulo Contas da Catedral; rodar E2E e verificar visualmente 390px e desktop.
- [x] Rodar `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test`, build local, E2E afetados, SQL, Advisors locais e `git diff --check`; registrar resultados e qualquer pré-requisito ausente.
- [x] Revisão própria de todo o diff, autorização, isolamento, dados legados e ausência de efeitos financeiros. Corrigir problemas com regressão focada.
- [x] Atualizar documentação, fazer commit somente na branch local e encerrar processos iniciados. Sem push/merge/banco remoto.
