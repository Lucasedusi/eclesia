# Módulo financeiro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o ambiente financeiro aprovado, com configurações completas, movimentações auditáveis, atendimento ágil e demonstrativo mensal descritivo.

**Architecture:** Concentrar o domínio em src/modules/finance/, com páginas de servidor, serviços autenticados e operações atômicas no Postgres. Evoluir as tabelas existentes por novas migrações, preservando isolamento, auditoria, revisões e comprovantes. Usar layout financeiro próprio sob o layout raiz, com tema e portais delimitados ao módulo.

**Tech Stack:** Next.js 16.3.5, React 19.2.4, TypeScript estrito, Supabase/Postgres, Zod, Styled Components e utilitários existentes, Chart.js 4.5.1, Vitest e Playwright. Node 24.21.0 conforme .node-version; npm e package-lock.json.

**Spec:** [Especificação consolidada](../specs/2026-10-03-financial-module-design.md).

**Estado:** aprovado em 2026-10-03. Execução direta autorizada, sem subagentes; revisão final pelo próprio implementador. Alterações necessárias no banco online autorizadas. O protótipo é referência visual, não código a importar para a aplicação. Sua publicação no Sites é independente deste desenvolvimento.

## Resultado da execução — 4 de outubro de 2026

As 12 tarefas foram entregues em execução direta, sem subagentes. O checklist abaixo preserva a descrição original do plano; a conclusão e as ressalvas verificadas estão no [relatório de validação e implantação](../../finance/validation-and-rollout.md). As 14 migrações foram aplicadas ao banco online autorizado. A publicação da aplicação não integra esta entrega.

## Global Constraints

- “A contribuição pertence à unidade que a recebeu, mesmo quando o membro pertence a outra.”
- “Esses nomes são exemplos de cadastros administráveis, não regras fixadas pelos nomes.”
- “A classificação da pessoa anterior nunca é herdada pelo próximo atendimento.”
- “O conjunto de lançamentos é salvo integralmente.”
- “Despesas não reduzem a base bruta usada nos percentuais.”
- “Gerar o demonstrativo não cria despesas, não registra recebimento da Catedral e não marca itens como pagos.”
- “O demonstrativo descritivo não bloqueia os lançamentos do mês.”
- “Um caixa só pode ser inativado com saldo zerado por movimentos ou ajustes registrados.”
- “A impressão térmica usa a janela comum do navegador.”
- “Não presumir que campos nulos representam a Catedral e não classificar dados antigos por adivinhação.”
- Autenticação, church_id, permissão, escopo, exclusão lógica e referências compostas são conferidos no servidor e no banco. Reutilizar requireAccessContext(), PERMISSIONS, Zod e módulos server-only.
- Migrações existentes são imutáveis. Criar arquivos pela CLI; regenerar os tipos, nunca editá-los manualmente. Aplicações remotas e cargas de dados reais exigem autorização explícita.
- Rubik; cores #0B3D32, #087F5B, #B6E875, #F5F7F6, #18352C, #E3EAE6 e #B5474D conforme a especificação. Verde claro usa texto escuro. Preservar o tema das demais áreas.
- Relatórios oficiais, autoatendimento, cobranças automáticas e interface de contas a pagar estão fora desta entrega.

## Review Focus

1. Resposta de gravação perdida: retry recupera os mesmos lançamentos e recibo, inclusive após mudança de cadastro. Testes nas tarefas 3 e 9.
2. Correções simultâneas: uma revisão não apaga a outra nem aplica saldo duas vezes. Teste de concorrência na tarefa 3.
3. Datas retroativas e mudança de mês/fuso: referência, saldo histórico e versões afetadas acompanham a data financeira. Testes nas tarefas 3, 4 e 8.
4. Cadastro inativado durante o atendimento e homônimos: preservar preenchimento, revalidar referências e selecionar a pessoa inequivocamente. Testes nas tarefas 3, 5 e 10.
5. Troca de unidade com formulário preenchido e impressão bloqueada: impedir mistura de unidades e repetição de recebimento. Testes nas tarefas 6 e 10.

---

## Entregas e dependências

| Entrega | Tarefas | Resultado revisável |
| --- | --- | --- |
| Fundação | 1–2 | Acesso por escopo e estrutura compatível com o legado. |
| Regras e serviços | 3–5 | Gravação atômica, cálculo mensal, identificação e anexos. |
| Ambiente e administração | 6–7 | Tema financeiro e cadastros completos. |
| Operação diária | 8–10 | Consulta, lançamento, transferência, atendimento e impressão. |
| Demonstrativo e homologação | 11–12 | Versões mensais e validação integrada. |

Executar 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12. O demonstrativo terá sua regra validada na tarefa 4, antes da interface. Manter um plano único: saldos, atendimento e demonstrativo dependem do mesmo registro financeiro e dos mesmos contratos.

Cada tarefa termina com teste focado, revisão e commit apenas dos seus arquivos. No início da execução, usar checkout isolado conforme using-git-worktrees; preservar FINANCE.MD e alterações do usuário. A aprovação deste plano não publica a aplicação.

## Evidência local e decisões de integração

- Há tabelas financial_*, report_delivery_rules, report_deliveries e report_delivery_items. Ainda não há src/modules/finance/ nem páginas /financeiro.
- src/constants/navigation.ts já aponta para /financeiro, sem permissão no item. Corrigir na tarefa 6.
- PERMISSIONS expõe financeView; o banco também possui finance.manage. A restauração atual concede ambas ao ADMIN. Não conceder capacidades a outros perfis apenas pelo nome do cargo.
- getMemberFinance(), em src/modules/members/services/member.service.ts, consulta por campo e membro. Integrar a nova restrição de escopo e preservar essa aba.
- src/app/(authenticated)/layout.tsx envolve suas páginas no AppShell azul. Criar src/app/(finance)/financeiro/ como grupo irmão, mantendo URL /financeiro, autenticação no layout e nos serviços. Não mover as demais páginas.
- src/providers/app-providers.tsx fornece tema e portal global. Acrescentar id opcional ao ModalPortalProvider e usar finance-modal-root sob o tema financeiro; modal-root continua o padrão global.
- A análise usa migrações e tipos locais, não o estado remoto. Compatibilidade de dados efetivamente existentes é condição da implantação.
- Antes de escrever código Next.js, reler os guias instalados de layouts, Server/Client Components, autenticação com Cache Components, ações e Route Handlers. Leituras de sessão ficam atrás de Suspense. Não compartilhar cache de dados financeiros entre usuários/escopos.

## Organização e contratos

Os caminhos de domínio abaixo são relativos a src/modules/finance/. Arquivos de teste .test.ts ficam ao lado de serviços e regras; testes de interface ficam em e2e/.

| Área | Arquivos | Responsabilidade |
| --- | --- | --- |
| Acesso | types/finance.types.ts; services/finance-access.service.ts; constants/finance-permissions.ts | Contexto validado, unidades e capacidades. |
| Cadastros | types/finance-catalog.types.ts; validations/finance-catalog.schemas.ts; services/finance-catalog.service.ts; actions/finance-catalog.actions.ts | Catálogos, caixa/método, abertura e inativação. |
| Movimentos | types/finance-command.types.ts; validations/finance-command.schemas.ts; services/finance-command.service.ts; actions/finance-command.actions.ts | Contrato único de gravação, correção e cancelamento. |
| Consulta | types/finance-query.types.ts; services/finance-query.service.ts; utils/finance-money.ts; utils/finance-period.ts | Saldos, lista, detalhes, centavos e datas. |
| Demonstrativo | types/finance-statement.types.ts; validations/finance-statement.schemas.ts; services/finance-statement.service.ts; actions/finance-statement.actions.ts | Regras mensais, versões, cálculo e consulta. |
| Identificação | types/finance-contributor.types.ts; services/finance-contributor.service.ts; actions/finance-contributor.actions.ts | Busca restrita de contribuintes. |
| Documentos | types/finance-document.types.ts; services/finance-document.service.ts; actions/finance-document.actions.ts | Upload, validação e acesso privado. |
| Comprovantes | services/finance-receipt.service.ts; components/finance-receipt.tsx; components/finance-print-controls.tsx | Leitura de versão e impressão pelo navegador. |
| Telas | components/ e hooks/ descritos nas tarefas 6–11 | Interações e apresentação sem acesso direto ao banco. |

### Tipos compartilhados

- Cents: number inteiro seguro. amount existente permanece numeric(12,2); converter decimal textual exatamente na fronteira SQL, sem usar ponto flutuante no cálculo de percentuais. Recusar overflow também em somas.
- LocalDate: string YYYY-MM-DD validada como data civil real; MonthRef: string YYYY-MM. Não derivar data financeira por conversão UTC.
- FinanceContext: { auth: AuthContext; churchId: string; congregationId: string; capabilities: FinanceCapabilities }, somente servidor.
- FinanceCapabilities: booleanos view, create, update, cancel, transfer, generateStatement, manageSettings e lookupContributors.
- ContributorRef: união MEMBER com memberId; UNREGISTERED com name; COLLECTIVE sem identificação. Favorecido de despesa é um campo separado.
- ContributionInput: categoryId, departmentId, amountCents, titheClassificationId opcional, description, notes e documentNumber opcionais. Dízimo exige pessoa e classificação; oferta coletiva admite COLLECTIVE.
- ReceiptDTO: id, number, revision, status, congregationName, personName, date, paymentMethodName, totalCents e items com transactionId, categoryName, departmentName, classificationName e amountCents. Sem CPF, tokens ou HTML arbitrário.
- FinanceActionResult<T>: {ok:true;data:T} ou {ok:false;code;message;fieldErrors?}. Códigos: FORBIDDEN, INVALID_INPUT, INACTIVE_REFERENCE, CONFLICT, IDEMPOTENCY_CONFLICT, CONFIGURATION_REQUIRED, LEGACY_DATA_REQUIRES_REVIEW e UNAVAILABLE. Não retornar erros internos do banco.

### Gravação financeira

FinanceCommand é união discriminada, definida completamente na tarefa 2:

| kind | Dados próprios, além de operationKey UUID |
| --- | --- |
| RECORD | congregationId, mode SINGLE/ATTENDANCE, direction INCOME/EXPENSE, date, cashboxId, paymentMethodId, contributor/favorecido, items, issueReceipt e IDs de anexos preparados. SINGLE exige um item; ATTENDANCE aceita somente entradas. |
| CORRECT_TRANSACTION | ID, expectedRevision, substituição dos campos editáveis e reason; não troca congregação proprietária. |
| CANCEL_TRANSACTION / CANCEL_ATTENDANCE | ID, expectedRevision e reason. |
| TRANSFER | congregationId, date, sourceCashboxId, targetCashboxId, amountCents e descrição. |
| CORRECT_TRANSFER / CANCEL_TRANSFER | ID, expectedRevision, reason e substituição de data/caixas/valor quando aplicável. |
| ADJUST_BALANCE | congregationId, cashboxId, date, ajuste assinado e reason; somente administrador. |

FinanceMutationResult: operationId, transactionIds, attendanceId nullable, transferId nullable, receiptId nullable, revision e replayed.

executeFinanceCommand(context: FinanceContext, command: FinanceCommand): Promise<FinanceMutationResult> invoca public.execute_finance_command(p_church_id uuid, p_payload jsonb) returns jsonb. A RPC valida novamente autenticação, campo, permissão, escopo e referências. O servidor deriva church_id do contexto; a RPC não confia no parâmetro sem verificar o acesso.

### Evolução do banco

Tabelas novas têm church_id, auditoria e relacionamentos compostos. Os nomes de migração nas tarefas são sufixos; timestamps serão gerados pela CLI.

| Estrutura | Decisão |
| --- | --- |
| financial_department_base_versions | Departamento, início mensal, versão e participação na base; preservar versões anteriores. |
| financial_cashbox_payment_methods; financial_tithe_classifications | Relações de métodos permitidos e catálogo administrável de classificação. |
| financial_operations | Chave por campo/autor, tipo, hash canônico e resultado persistido. Mesmo payload recupera o resultado; payload diferente conflita. |
| financial_attendances | Unidade, identificação preservada, caixa, método, data, revisão e cancelamento; transactions.attendance_id vincula cada item. |
| financial_transfers; financial_balance_adjustments | Operações próprias, fora da arrecadação. Origem/destino da transferência pertencem à mesma unidade. |
| financial_ledger_entries | Efeitos assinados imutáveis de abertura, movimento, reversão, transferência e ajuste. Correção acrescenta reversão e novo efeito com datas financeiras próprias. |
| financial_transaction_revisions | Campos anteriores/novos, responsável, motivo e classificação preservada; acesso sob escopo financeiro. |
| financial_receipts; financial_receipt_items | Preservar números antigos, acrescentar origem por atendimento, revisão e substituição. Exigir exatamente uma origem; itens guardam nomes e valores daquela emissão. |
| report_delivery_rule_sets | Conjunto imutável por congregação/mês/versão; regras existentes recebem vínculo para novos itens. Destino e papel no cálculo tornam-se explícitos. |
| report_deliveries; report_delivery_versions; report_delivery_items | Manter cabeçalho mensal existente e criar versões; novos itens pertencem à versão. Preservar fontes, regras, departamentos, bases e destinos. Campos legados de pagamento não participam do fluxo novo. |
| financial_period_revisions | Contador por campo/unidade/mês, incrementado quando os dados mudam; a versão do demonstrativo guarda esse contador e versões de configuração. |

Não inventar unidade, classificação antiga ou abertura datada no backfill. Diagnóstico com contagens de pendências precede saneamento. Referências novas já são validadas; constraints legadas são finalizadas após resolução explícita das violações. Não tratar saldo atual legado como abertura sem reconciliação.

Escrita direta em transações, ledger, auditoria, operações e recibos fica revogada para clientes. Quando SECURITY DEFINER for necessário à RPC atômica, usar search_path vazio, nomes qualificados, checagens explícitas e grants mínimos; helpers internos ficam no schema privado. Consultas usam RLS e SECURITY INVOKER quando possível.

## Convenções de verificação

Esta seção descreve verificações futuras; nenhum banco foi alterado durante o planejamento.

- Teste focado: npm test -- <caminho>. Primeiro escrever o cenário e confirmar falha pelo comportamento ausente; depois implementar e confirmar passagem.
- SQL local: psql "$FINANCE_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f <arquivo.sql>. A variável aponta apenas para banco local descartável. Testes usam BEGIN/ROLLBACK e fixtures fictícias; assertiva falsa interrompe o script.
- Criar supabase/tests/finance_fixture.sql: dois campos, duas congregações no primeiro, sede explícita, admin, tesoureiro A, secretário B, observador e acessos REGION/MINISTRY. Incluir helper temporário assert_true(condition boolean, message text) que lança exceção em false/null.
- Para cada migração: aplicar localmente, testar RLS/grants/índices e atualizar src/lib/supabase/database.types.ts pela CLI. Consultar --help antes de usar comandos; executar Advisors localmente ou declarar indisponibilidade e requisito faltante.
- E2E usa E2E_STORAGE_STATE local autorizado e fixtures sem dados reais. Credenciais e estados autenticados ficam ignorados. Não usar produção para suprir fixture ausente.

## Tarefa 1 — Escopo e compatibilidade inicial

**Arquivos:** criar services/finance-access.service.ts, constants/finance-permissions.ts, types/finance.types.ts e services/finance-access.service.test.ts; modificar src/modules/auth/constants/permissions.ts; criar supabase/verification/finance_preflight.sql, supabase/tests/finance_fixture.sql, supabase/tests/finance_access_verification.sql e migração finance_access_foundation.

**Interfaces:** produzir requireFinanceContext({congregationId?:string,permission:PermissionKey}): Promise<FinanceContext> e listFinanceUnits(auth:AuthContext): Promise<{id:string,name:string,isHeadquarters:boolean}[]>.

- [ ] Escrever testes de sede padrão para admin, unidade própria para tesoureiro, acesso direto negado para outra unidade/campo e perfil suspenso. Usar fixture local A/B:
  ~~~sql
  select pg_temp.assert_true(not private.can_access_finance_unit(church_a, unit_b, 'finance.view'), 'tesoureiro A não lê B');
  ~~~
- [ ] Rodar teste de acesso e SQL antes da implementação; confirmar falha.
- [ ] Criar diagnóstico somente leitura: vínculos entre campos/unidades, caixas sem congregação, abertura sem data, origens de recibo e duplicações de catálogo. Retornar contagens sem nomes/CPF.
- [ ] Implementar finance.view, finance.transactions.create/update/cancel, finance.transfers.manage, finance.statements.generate, finance.settings.manage e finance.contributors.lookup. Converter concessões existentes de finance.manage para operações equivalentes no escopo; gestão de configurações exige ADMIN/CHURCH. Não conceder permissões financeiras a usuários antes não habilitados.
- [ ] Substituir políticas financeiras amplas por helpers privados. Não administradores precisam de congregação operacional atribuída e compatível com seu escopo para movimentar. REGION/MINISTRY não viram CHURCH nem ganham unidades por vínculo ausente; leitura permanece dentro do escopo. Sem vínculo operacional, orientar configuração de acesso.
- [ ] Executar npm test -- src/modules/finance/services/finance-access.service.test.ts e finance_access_verification.sql; todas as assertivas devem passar. Commit: feat(finance): enforce permissions and scope.

## Tarefa 2 — Cadastros e estrutura auditável

**Arquivos:** criar tipos finance-catalog, finance-command e finance-statement do mapa; validações, serviço e ações de catálogo; testes correspondentes; migrações finance_catalogs_and_ledger e finance_receipt_and_statement_versions; SQL finance_catalogs_verification.sql e finance_ledger_verification.sql; regenerar tipos Supabase.

**Interfaces:** listFinanceCatalogs(context): Promise<FinanceCatalogs>; saveFinanceCatalog(context,input:FinanceCatalogMutation): Promise<{id:string}>. FinanceCatalogs contém departamentos, categorias, classificações, caixas e métodos permitidos. Mutação é discriminada por entidade e criar/editar/inativar, com propriedade de campo/unidade imutável.

- [ ] Escrever SQL de FK entre campos negada, método não vinculado ao caixa negado, recibo com duas origens rejeitado e abertura fora das receitas:
  ~~~sql
  select pg_temp.assert_true(opening_effect = 100 and income_total = 0, 'abertura não é arrecadação');
  ~~~
- [ ] Rodar testes antes das constraints/serviços e confirmar falha.
- [ ] Implementar estrutura do mapa, FKs compostas, RLS, grants e índices dos filtros reais. Catálogos novos são do campo; não mesclar departamentos antigos automaticamente.
- [ ] Implementar abertura datada no ledger; current_balance é projeção protegida, não editável pelo cliente. Impedir novos movimentos anteriores à abertura; manter legado pendente para saneamento explícito.
- [ ] Implementar ações/serviços de catálogo com inativação, preservando histórico. Caixa com saldo diferente de zero não pode ser inativado. Todos os novos usos exigem registros ativos.
- [ ] Rodar SQL e testes do catálogo, conferir migração desde banco local limpo e tipos gerados. Commit: feat(finance): add catalogs and ledger structure.

## Tarefa 3 — Operações atômicas e repetição segura

**Arquivos:** criar utils/finance-money.ts, utils/finance-period.ts, validação/serviço/ações finance-command e testes; migração finance_atomic_commands; SQL finance_commands_verification.sql; scripts/verify-finance-concurrency.mjs; modificar src/lib/cache-tags.ts e seu teste.

**Interfaces:** executeFinanceCommand e RPC já definidos; submitFinanceCommand(input:unknown): Promise<FinanceActionResult<FinanceMutationResult>>; parseMoneyInput(value:string): Cents; toSqlAmount(value:Cents): string; monthOf(date:LocalDate): MonthRef. Tags financeCatalogs(churchId), financeUnit(churchId,congregationId), financePeriod(churchId,congregationId,month).

- [ ] Escrever testes monetários e de datas:
  ~~~ts
  expect(parseMoneyInput("1.234,56")).toBe(123456);
  expect(toSqlAmount(123456)).toBe("1234.56");
  expect(monthOf("2026-10-01")).toBe("2026-10");
  ~~~
  SQL: atendimento 200+20+50 salva três itens/um recibo de 270; item inválido desfaz tudo; corrigir 150 para 100 reduz saldo em 50; cancelar preserva registro; transferência 100 mantém total.
- [ ] Confirmar falhas em testes focados e SQL.
- [ ] Implementar RPC atômica, limites monetários, datas reais, validação de referências e revisão esperada. Bloquear recursos em ordem estável; gravar movimentos, efeitos, auditoria e recibo na mesma transação.
- [ ] Implementar idempotência. Após autorização atual, verificar resultado da chave antes de revalidar referências mutáveis de operação já confirmada. Mesma chave/payload retorna IDs anteriores; payload diferente conflita. Retry de falha não confirmada preserva a operação.
- [ ] Incrementar revisão dos períodos antigo/novo em correção retroativa; invalidar tags após commit. Correção de item substitui comprovante agrupado; cancelamento de atendimento é integral; transferência sempre corrige/cancela ambas as pontas.
- [ ] Implementar verificação concorrente com duas conexões autenticadas locais: mesma chave simultânea retorna mesmos IDs; duas correções na mesma revisão geram uma confirmação e um CONFLICT; chaves diferentes permitem contribuições legítimas iguais. Script recusa host fora de loopback.
- [ ] Executar npm test -- src/modules/finance, SQL finance_commands_verification.sql e node scripts/verify-finance-concurrency.mjs. Esperado: efeitos únicos e saldos reconciliados. Commit: feat(finance): persist atomic financial operations.

## Tarefa 4 — Regras e versões mensais

**Arquivos:** criar validações/serviço/ações finance-statement e testes; migração finance_statement_calculation; SQL finance_statements_verification.sql.

**Interfaces:** saveStatementRules(context,{congregationId,effectiveMonth,items:StatementRuleInput[],retroactiveReason?}): Promise<{ruleSetId,revision}>; copyStatementRules(context,{fromCongregationId,toCongregationId,effectiveMonth}): Promise<{ruleSetId}>; generateStatement(context,{month,operationKey}): Promise<StatementVersionDTO>; getStatementVersion(context,versionId): Promise<StatementVersionDTO>.

StatementRuleInput define nome, destino CATHEDRAL/LOCAL_PASTOR, papel DISTRIBUTION/GROSS_PREBEND/PREBEND_DEDUCTION e cálculo ELIGIBLE_INCOME_PERCENT/GROSS_PREBEND_PERCENT/FIXED, com percentual decimal textual ou centavos. StatementVersionDTO inclui fontes, departamentos, base, itens, bruto/dízimo/líquido, total Catedral, distribuição, restante, versão e sinal de alteração posterior.

- [ ] Escrever assertivas SQL para recebido 18.000 e base 15.000: repasse 4.500; bruto 5.250; dízimo 525; líquido 4.725; sistema 25; seguro 86; contador ilustrativo 150:
  ~~~sql
  select pg_temp.assert_true(cathedral_total = 5286 and distribution_total = 10011 and remainder = 4989, 'dízimo sem dupla subtração');
  ~~~
  Testar arredondamento por item, base zero com fixos, restante negativo e ausência de regras retornando CONFIGURATION_REQUIRED.
- [ ] Rodar testes e confirmar falha antes de implementar.
- [ ] Implementar cálculo autoritativo em SQL numeric com arredondamento de cada item. Bases e totais vêm do banco. Validar dependências da prebenda e impedir ciclo; nomes de departamento/categoria não definem fórmula.
- [ ] Implementar vigência no primeiro dia do mês, cópia independente e revisão retroativa justificada. Selecionar versão vigente pelo mês; preservar configurações anteriores. Alteração retroativa requer caminho explícito administrativo.
- [ ] Gerar snapshot consistente com revisões das fontes/configuração. Concorrência com lançamentos pode deixar a versão imediatamente desatualizada, mas não misturar fontes. Gerar/regerar não modifica transações, ledger, saldo ou pagamento.
- [ ] Rodar serviço/SQL incluindo despesa que não reduz base, transferência excluída, alteração retroativa afetando dois meses e concorrência de geração. Commit: feat(finance): calculate versioned descriptive statements.

## Tarefa 5 — Identificação e documentos privados

**Arquivos:** criar tipos/serviços/ações de contribuinte e documento do mapa, testes, migração finance_contributor_lookup_and_documents e SQL finance_identity_documents_verification.sql. Reutilizar formatos/hash em src/modules/members/services/member-credential-token.service.ts e padrões de upload de src/modules/organization/services/congregation-document.service.ts.

**Interfaces:** searchFinanceContributors(context,{kind:"NAME"|"CPF"|"MEMBER_CODE"|"CREDENTIAL",value:string}): Promise<ContributorOption[]>; opção contém id, name, memberCode, congregationName, suggestedClassificationId nullable. prepareFinanceDocument(context,{name,type,size}): Promise<{uploadId,path,token}>; finalizeFinanceDocument(context,uploadId): Promise<{documentId}>; getFinanceDocumentUrl(context,documentId): Promise<{url,expiresAt}>.

- [ ] Escrever testes de membro de outra congregação no mesmo campo sem CPF/cadastro completo/finanças na resposta; homônimos distinguíveis; outro campo, token revogado e perfil sem permissão negados:
  ~~~ts
  expect(result[0]).not.toHaveProperty("cpf");
  expect(result[0]).not.toHaveProperty("transactions");
  ~~~
  Testar PDF/JPEG/PNG, arquivo disfarçado, arquivo acima de 10 MiB e caminho de outro campo.
- [ ] Confirmar falhas dos serviços e SQL.
- [ ] Implementar RPC de lookup restrita, CPF exato validado e hash de credencial calculado no servidor. Não ampliar RLS geral de membros. Permissão finance.contributors.lookup; texto com mínimo de três caracteres e até 20 resultados.
- [ ] Implementar bucket privado financial-documents, caminhos por campo/unidade/upload, assinatura validada no servidor e leitura assinada por 60 segundos. Upload preparado pertence ao autor/contexto; vínculo ocorre na RPC financeira após validação. Falha preserva anexo para retry; descarte remove apenas upload ainda não vinculado.
- [ ] Rodar testes de identidade/documento e SQL. Commit: feat(finance): add contributor lookup and private documents.

## Tarefa 6 — Ambiente financeiro

**Arquivos:** criar src/app/(finance)/financeiro/layout.tsx, loading.tsx e error.tsx; components/finance-shell.tsx, finance-shell.styles.ts, finance-context-bar.tsx, finance-theme-provider.tsx; src/styles/finance-theme.ts; modificar src/components/ui/modal-portal.tsx e src/constants/navigation.ts; criar e2e/finance-shell.spec.ts.

**Interfaces:** FinanceThemeProvider({children}), FinanceShell({context:FinanceShellDTO,children}), FinanceContextBar({units,selectedUnitId,month,onChange}). FinanceShellDTO contém identificação mínima, unidades e capacidades da sessão; não entrega AuthContext completo sem necessidade.

- [ ] Escrever E2E de sede padrão, operador sem seletor de unidade alheia, acesso negado, tema do painel e ida/volta para membros:
  ~~~ts
  await expect(page.getByRole("navigation", {name:"Navegação financeira"})).toBeVisible();
  await expect(page.locator("#finance-modal-root")).toHaveCount(1);
  ~~~
- [ ] Confirmar falha antes da criação das rotas.
- [ ] Implementar layout irmão autenticado com Suspense e fallback útil. Navegação inclui visão geral, lançamentos, atendimento, caixas, demonstrativos e configurações, conforme permissão.
- [ ] Implementar tema e portal próprios, reutilizando UI existente. Parâmetros unidade/mes são validados no servidor; não copiar a página estática.
- [ ] Proteger troca de unidade com formulário modificado: salvar, descartar ou continuar editando antes de trocar. Limpar referências de caixa/método incompatíveis; ignorar resposta antiga de consulta após troca.
- [ ] Executar npm run test:e2e -- e2e/finance-shell.spec.ts e npm run build. Commit: feat(finance): introduce dedicated workspace.

## Tarefa 7 — Configurações e caixas completos

**Arquivos:** criar src/app/(finance)/financeiro/configuracoes/page.tsx e caixas/page.tsx; components/finance-settings.tsx, finance-catalog-form.tsx, finance-cashboxes.tsx e finance-rule-editor.tsx; e2e/finance-settings.spec.ts.

**Interfaces:** FinanceSettings({catalogs,capabilities}), FinanceCashboxes({cashboxes,balances,capabilities}), FinanceRuleEditor({unit,month,rules}). Consumir serviços das tarefas 1–4.

- [ ] Escrever E2E: admin cria categoria/classificação; tesoureiro não edita catálogos; método segue caixa; inativação preserva histórico; caixa não zerado mostra erro:
  ~~~ts
  await expect(page.getByRole("alert")).toContainText("saldo");
  ~~~
- [ ] Confirmar falha antes das telas.
- [ ] Implementar departamentos, categorias, classificações, métodos e caixas. Categoria define natureza, sugestão de departamento e identificação de dízimo/oferta; participação na base mostra vigência mensal. Nenhuma lista é fixada pelos exemplos.
- [ ] Implementar abertura datada, ajuste com justificativa, saldos e inativação. Implementar regras por unidade, cópia independente e revisão retroativa explícita.
- [ ] Rodar E2E e testes de catálogo/validação; opções salvas devem alimentar formulários reais. Commit: feat(finance): deliver settings and cashboxes.

## Tarefa 8 — Consultas e visão geral

**Arquivos:** criar types/finance-query.types.ts, services/finance-query.service.ts e teste; src/app/(finance)/financeiro/page.tsx e lancamentos/page.tsx; components/finance-overview.tsx, finance-charts.tsx, finance-transactions-table.tsx e finance-transaction-details.tsx; migração finance_scoped_queries; SQL finance_queries_verification.sql; e2e/finance-query.spec.ts; modificar getMemberFinance() e seu teste.

**Interfaces:** getFinanceOverview(context,{month}): Promise<{openingCents,openingMovementCents,incomeCents,expenseCents,adjustmentCents,closingCents,dailySeries,categorySeries}>; listFinanceTransactions(context,filters:FinanceFilters): Promise<{items,totalCount,filteredIncomeCents,filteredExpenseCents,page,pageCount}>; getFinanceTransaction(context,id): Promise<FinanceTransactionDetail>. Filtros incluem mês, busca, natureza, departamento, categoria, caixa, método, situação e paginação. openingMovementCents representa aberturas de caixa ocorridas dentro do período, separadas do saldo inicial e das receitas.

- [ ] Escrever testes:
  ~~~ts
  expect(overview.closingCents).toBe(2401000); // 8450 + 18000 - 2440
  expect(result.totalCount).toBe(25);
  expect(result.items).toHaveLength(20);
  ~~~
  Verificar ajuste separado, transferência fora de receitas/despesas e mês passado sem usar saldo atual. Caixa aberto no dia 15 com 100 reais deve gerar openingCents=0, openingMovementCents=10000, incomeCents=0 e closingCents=10000 na ausência de outros movimentos.
- [ ] Confirmar falha em serviço e SQL.
- [ ] Implementar consultas por campo/unidade/data/status; saldo inicial deriva do ledger até início do período. Abertura dentro do mês aparece como efeito separado para reconciliar o saldo. Ordenação determinística por data/ID.
- [ ] Implementar resumo, gráficos por data/categoria e listagem do mês. Resumo/gráficos usam unidade/período; filtros detalhados alteram somente lista e totais claramente identificados.
- [ ] Implementar busca por pessoa/descrição/documento, paginação, histórico e comprovantes em painel sem perder posição. Aplicar o mesmo escopo à aba financeira do membro; lookup de identidade não libera consulta financeira.
- [ ] Rodar testes/SQL, npm run test:e2e -- e2e/finance-query.spec.ts e build. Commit: feat(finance): add scoped queries and overview.

## Tarefa 9 — Lançamentos e manutenção

**Arquivos:** criar components/finance-transaction-drawer.tsx, finance-contributor-picker.tsx, finance-transfer-dialog.tsx, finance-correction-dialog.tsx e finance-document-fields.tsx; hooks/use-finance-entry-session.ts; utils/finance-entry-session.ts e teste; e2e/finance-transactions.spec.ts.

**Interfaces:** nextEntryDefaults(current:EntryFormState): EntryFormState; FinanceContributorPicker({value,onChange,capabilities}); FinanceTransactionDrawer({context,catalogs,initialTransaction?,onSaved}). EntryFormState reúne contribuição, pessoa/favorecido, data, caixa/método, anexos e expansão dos detalhes.

- [ ] Escrever teste de continuidade:
  ~~~ts
  expect(next.date).toBe(previous.date);
  expect(next.cashboxId).toBe(previous.cashboxId);
  expect(next.contributor).toBeNull();
  expect(next.titheClassificationId).toBeNull();
  expect(next.documentIds).toEqual([]);
  ~~~
  Confirmar também categoria/departamento/método preservados; valor/documento/descrição/notas limpos; falha preserva tudo e operationKey.
- [ ] Escrever E2E de dízimo vinculado, não cadastrado separado da descrição, oferta coletiva, despesa com favorecido/anexo, correção, cancelamento e transferência. Confirmar falhas.
- [ ] Implementar painel amplo com campos condicionais e departamento editável. Classificação é sugestão ajustável; detalhes podem permanecer abertos para recibos acumulados.
- [ ] Implementar Salvar, Salvar e continuar e Salvar e imprimir. Nova chave somente para nova operação após confirmação; resposta perdida conserva chave para retry. Após sucesso, atualizar listagem e identificar confirmação.
- [ ] Implementar justificativas, comparação de revisão e mensagens de referência inativada sem perda de dados. Cancelamento preserva histórico; saldo negativo é permitido e destacado.
- [ ] Rodar testes de sessão e E2E. Commit: feat(finance): complete transaction entry and correction.

## Tarefa 10 — Atendimento e comprovantes

**Arquivos:** criar src/app/(finance)/financeiro/atendimento/page.tsx e comprovantes/[receiptId]/page.tsx; components/finance-attendance.tsx, finance-contribution-lines.tsx, finance-credential-reader.tsx, finance-receipt.tsx e finance-print-controls.tsx; services/finance-receipt.service.ts e teste; e2e/finance-attendance.spec.ts e finance-print.spec.ts; migração finance_receipt_print_requests e SQL finance_receipt_print_verification.sql.

**Interfaces:** getFinanceReceipt(context,receiptId): Promise<ReceiptDTO>; recordPrintRequest(context,receiptId): Promise<void>; FinanceAttendance({context,catalogs}); FinanceCredentialReader({onRead:(value:string)=>void,onClose}). Imprimir DTO preservado, não HTML arbitrário legado.

- [ ] Escrever E2E de atendimento 200/20/50:
  ~~~ts
  await expect(page.getByTestId("attendance-total")).toHaveText("R$ 270,00");
  await expect(page.getByTestId("receipt-item")).toHaveCount(3);
  ~~~
  Banco confirma base 220, uma operação e três lançamentos da unidade recebedora; cargo sugerido pode mudar e não passa à próxima pessoa.
- [ ] Escrever cenários QR válido/revogado, câmera negada com alternativa manual, impressão bloqueada/cancelada e reimpressão sem novo lançamento. Confirmar falhas.
- [ ] Implementar identificação única, departamento por item, resumo e defaults visíveis. QR somente identifica; tratar valor lido como dado, nunca navegar para URL externa. Usar leitor compatível com navegadores suportados, verificando documentação antes de escolher dependência; manter matrícula como alternativa.
- [ ] Salvar conjunto pela RPC e preparar próximo atendimento somente após confirmação. Erro em um item preserva tudo; CPF não vai para URL ou armazenamento local.
- [ ] Implementar impressão autenticada com @media print, padrão 80 mm e opção estreita 58 mm. Janela aberta por interação do usuário; bloqueio apresenta acesso ao comprovante confirmado. Não depender de servidor de impressora.
- [ ] Contabilizar solicitação ao navegador, não sucesso físico, por RPC record_finance_print_request(p_church_id uuid,p_receipt_id uuid), autorizada pelo escopo de leitura do comprovante; não reabrir escrita direta na tabela. A RPC não altera conteúdo, versão ou lançamentos. Reimpressão mantém versão; antiga mostra Substituído e cancelada mostra Cancelado. Correção de item preserva demais itens e emite nova versão agrupada.
- [ ] Rodar testes e E2E de atendimento/impressão. Commit: feat(finance): deliver attendance and browser printing.

## Tarefa 11 — Demonstrativo na interface

**Arquivos:** criar src/app/(finance)/financeiro/demonstrativos/page.tsx e demonstrativos/[versionId]/page.tsx; components/finance-statements.tsx, finance-statement-detail.tsx e finance-statement-print.tsx; e2e/finance-statements.spec.ts.

**Interfaces:** consumir geração/leitura da tarefa 4; acrescentar listStatements(context,{month}): Promise<{id,version,createdAt,createdBy,stale,superseded}[]> e FinanceStatementDetail({statement:StatementVersionDTO}).

- [ ] Escrever E2E do exemplo da tarefa 4:
  ~~~ts
  await expect(page.getByTestId("statement-cathedral-total")).toHaveText("R$ 5.286,00");
  await expect(page.getByTestId("statement-pastor-net")).toHaveText("R$ 4.725,00");
  ~~~
  Gerar, corrigir lançamento, ver aviso e regerar preservando anterior. Confirmar falha.
- [ ] Implementar unidade/mês, configuração ausente, ausência de movimento, base e departamentos excluídos, memória de cálculo e destinos. Restante da distribuição não se chama saldo do caixa.
- [ ] Implementar consulta de versões, indicação de substituição/desatualização e impressão limpa. Nenhum botão cria despesas ou marca pago/entregue.
- [ ] Rodar E2E e SQL de demonstrativos; tela e impresso iguais ao snapshot, sem novos movimentos. Commit: feat(finance): present monthly statement versions.

## Tarefa 12 — Homologação e entrega

**Arquivos:** criar e2e/finance-integration.spec.ts e docs/finance/validation-and-rollout.md; atualizar README.md onde necessário. Corrigir somente falhas demonstradas.

**Interfaces:** consumir todas as tarefas; produzir relatório de verificação, pendências de ambiente/dados e sequência de implantação.

- [ ] Escrever jornada: admin configura, operador recebe, acesso de outra unidade é negado, corrige/reimprime, transfere, gera demonstrativo e revisa configuração retroativa. Incluir chamada direta às ações/rotas, não apenas botão oculto.
- [ ] Rodar jornada/concorrência e resolver falhas; testar regressão de navegação e aba financeira de membros.
- [ ] Conferir teclado, foco, zoom 200%, movimento reduzido, larguras 320/375/1024 px e impressão 58/80 mm. Nomes/observações com HTML aparecem como texto, sem execução.
- [ ] Executar npm run lint -- --max-warnings=0; npm run typecheck; npm test; npm run build; npm run test:e2e. Executar SQL financeiro e Advisors em ambiente local ou desenvolvimento aprovado. Relatar falha/skips e requisito exato ausente. Rodar npm run analyze:routes se mudar estratégia de desempenho/carregamento.
- [ ] Conferir diff e tipos gerados, ausência de segredos/dados reais e imutabilidade de migrações antigas. Documentar reconciliação abertura/ledger/saldos e valores mensais.
- [ ] Preparar migrações ordenadas e diagnóstico. Se dados legados forem ambíguos, apresentar mapeamento antes de saneá-los. Solicitar autorização remota apenas com entrega concreta e verificações prontas.
- [ ] Commit: test(finance): verify complete financial workflows. Revisão final do conjunto conforme método escolhido e integração após resolver pendências relevantes.

## Rastreabilidade e autorrevisão

| Requisito | Tarefas |
| --- | --- |
| Campo, Catedral, congregação, permissões e identidade restrita | 1, 5, 6, 12 |
| Cadastros, classificação e métodos por caixa | 2, 7 |
| Abertura, ajuste, saldo negativo e inativação | 2, 3, 7–9 |
| Entradas/saídas, vínculo pessoal, coletivo e não cadastrado | 3, 5, 9 |
| Recibo físico, favorecido, detalhes e anexos | 5, 9 |
| Continuidade, falhas e idempotência | 3, 9, 10 |
| Transferência, correção, cancelamento, concorrência e auditoria | 2, 3, 9, 12 |
| Atendimento múltiplo, CPF/matrícula/QR e impressão | 3, 5, 10 |
| Base, vigência, cópia e revisão retroativa | 2, 4, 7 |
| Demonstrativo descritivo, fórmulas e versões | 4, 11 |
| Resumo, gráficos, filtros, totais e painel | 8 |
| Tema, responsividade, acessibilidade e Next.js | 6, 8–12 |

Autorrevisão: requisitos mapeados; contratos compartilhados precedem consumidores; permissões e atomicidade são verificadas também abaixo da interface; cinco riscos ligados a testes. Dados legados e disponibilidade do ambiente são condições a verificar durante execução, não resultados comprovados neste planejamento.

## Aprovação e método de execução

Recomendação: implementar por tarefas com implementação e revisão independentes, pois falhas podem afetar saldos, isolamento, concorrência e histórico. Alternativa: execução direta nesta conversa com revisão independente ao final. Em ambos os casos, apresentar este plano para aprovação antes do desenvolvimento, conforme combinado com o usuário.
