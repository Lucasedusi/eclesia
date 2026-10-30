# Contas a pagar da Catedral — implementação e validação local

Data: 30/10/2026. Branch: `codex/finance-accounts-payable`, criada da main sincronizada em `2fd1da3`. Planejamento, implementação e revisão diretos, sem subagentes. Nenhuma operação no banco online, push ou merge.

## Comportamento entregue

- Lista administrativa única da sede ativa da igreja autenticada, independente da congregação selecionada no restante do Financeiro. Administração ativa com escopo CHURCH e permissão `finance.payables.manage`; tesoureiro continua bloqueado mesmo com override explícito.
- Cadastro com nome, categoria de saída e vencimento; valor e observação opcionais. Valor ausente é `null`, apresentado como “Não informado”. Nova categoria reutiliza o cadastro existente e preserva o formulário.
- Abas A pagar/Pagas por vencimento, filtros, paginação, aviso de pendências anteriores independente da busca e resumo “Contas da Catedral” independente da congregação/mês da visão geral.
- Confirmação manual com data real, autor e horário; desfazimento com justificativa; edição/exclusão de pendentes; exclusão lógica e histórico. Nenhuma operação gera ou altera lançamento, saldo ou relatório financeiro.
- Cópia mensal com seleção entre páginas, conferência, ajuste de fim de mês, valores/categorias editáveis e prevenção de cópia repetida por origem/mês.
- Computador e PWA/celular, incluindo 320 px. Proteção de preenchimento, controles bloqueados durante atualização e repetição da mesma operação após perda de resposta, sem duplicação.

## Persistência e revisão

Migrações aplicadas **somente localmente**, preservadas como histórico imutável:

1. `20261030140816_finance_cathedral_payables.sql`: contrato, autorização, RLS/grants, titularidade composta, checklist, auditoria privada e recibos de idempotência.
2. `20261030144454_finance_payables_category_index.sql`: índice composto de categoria apontado na revisão dos Advisors.
3. `20261030144935_finance_payables_conflict_response.sql`: conflito de revisão usa erro de negócio P0001. O teste em duas janelas detectou que usar 40001 fazia o serviço repetir a transação, atrasando indefinidamente o aviso. A regressão HTTP passou após a correção.

Dados antigos de `accounts_payable` permanecem fora do novo checklist, sem reatribuição ou conversão automática. As relações compostas são NOT VALID para preservar dados legados, mas validam novas alterações. Tipos gerados pelo CLI a partir do banco local, com normalização automática apenas da quebra de linha final.

Revisão própria: autenticação em cada ação/serviço, igreja e sede resolvidas no servidor, rejeição de titularidade enviada pelo cliente, restrição de leitura direta e documentos vinculados, ausência de escrita direta por authenticated, funções privilegiadas com search_path vazio e grants mínimos, histórico preservado, atualizações com revisão e bloqueio de linha, lotes atômicos, proteção contra repetição e invalidação de navegação. Nenhum uso novo de cliente administrativo ou serviço externo.

## Evidências

| Verificação | Resultado |
|---|---|
| Baseline antes da implementação | 618 testes aprovados |
| Testes focados de regras, contratos e serviço | 14 aprovados; falha por módulo ausente observada antes da implementação |
| `npm run lint -- --max-warnings=0` | Aprovado |
| `npm run typecheck` | Aprovado |
| `npm test` | 632 testes, 116 arquivos aprovados |
| Build com `scripts/finance-local.mjs` | Aprovado com URL/chaves locais |
| Playwright na versão compilada | 28 cenários aprovados (9 novos e 19 regressões) |
| SQL local, com fixtures fictícias e rollback | 5 scripts aprovados |
| Advisors locais, Security e Performance, nível INFO | Sem WARN/ERROR de segurança; detalhes abaixo |
| `git diff --check` | Aprovado |

SQL: `finance_payables.sql`, `finance_access_verification.sql`, `finance_commands_verification.sql`, `finance_identity_documents_verification.sql` e `finance_reference_month.sql`. Cobrem isolamento, acesso indevido, operações, histórico, revisão obsoleta, idempotência, lote inválido sem gravação parcial, valor zero, pagamento futuro, período personalizado, categoria inativa e preservação de legado. O checklist não altera o conteúdo dos lançamentos financeiros (contagem e checksum antes/depois).

A última execução completa aprovou 27/28 cenários. O cenário preexistente de atendimento/mês de referência encontrou dois lançamentos fictícios iguais acumulados pelas execuções anteriores. Após `scripts/finance-local.mjs setup` criar outra igreja/sessões fictícias, somente esse cenário foi repetido e aprovado (1/1), sem alteração em código ou teste.

Playwright: ciclo completo em desktop, 390 px e 320 px; proteção de formulário; categoria sem perder dados; fevereiro bissexto; cópia repetida; seleção em páginas diferentes; pendências antigas e resumo; tesoureiro bloqueado; resposta perdida depois de gravação; duas edições concorrentes. Regressões também cobrem navegação, mobile, visão geral, mês de referência e importação bancária.

Os Advisors mantêm 13 avisos de desempenho em estruturas preexistentes (9 `auth_rls_initplan`, 4 `multiple_permissive_policies`). Nenhuma chave estrangeira nova ficou sem índice de cobertura. Os INFO `rls_enabled_no_policy` nas duas tabelas privadas novas são deliberados: acesso direto negado, zero grants de usuário e acesso somente pelas funções autorizadas. Há também INFO de índices ainda não utilizados e relações legadas fora deste escopo. O CLI emitiu `MaxListenersExceededWarning` durante a geração dos tipos, que terminou com sucesso; não houve falha da geração.

`analyze:routes` não se aplica: não foi uma alteração destinada a otimizar carregamento ou bundle. Não houve teste online nem teste com pagamentos reais.

## Encerramento

Dados fictícios restritos ao Supabase local. Servidor Next.js e perfil Colima `eclesia` encerrados após a validação. Branch preservada localmente para revisão; migrações online e publicação continuam aguardando autorização específica.
