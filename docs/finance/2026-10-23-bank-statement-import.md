# Importação de extrato bancário — implementação e validação

Implementação de 23/10/2026 na branch `codex/finance-bank-statement-import`, a partir de `b83b43c`. Especificação aprovada: `docs/superpowers/specs/2026-10-23-finance-bank-statement-import-design.md`.

## Como usar

1. No computador, abra **Financeiro → Lançamentos → Importar extrato**.
2. Confira a congregação e escolha a conta bancária ativa correspondente ao arquivo. Envie o XLSX do Sicoob.
3. Confira os três cartões de resumo e a faixa de pendências. A preparação não movimenta dinheiro.
4. Abra um item e confira sua origem. Use **Mais opções** quando precisar vincular um registro existente, tratar uma transferência ou justificar uma decisão.
5. Complete a classificação, a forma de pagamento e a pessoa quando exigida. **Salvar rascunho** permite retomar depois; **Finalizar** registra o movimento; **Finalizar e próximo** abre outra pendência.

Data, direção, conta e total vêm do extrato armazenado. Novos itens usam uma classificação por movimento, com valor fixo e prévia lateral tanto para entradas quanto para saídas. Rascunhos antigos com várias contribuições são preservados; **Usar uma classificação** pede confirmação antes de unificar. O complemento bancário não é copiado automaticamente para a descrição financeira.

Os [refinamentos de 24/10](2026-10-24-bank-import-refinement.md) foram validados apenas localmente. A exclusão e a recuperação dependem das duas migrações novas, ainda não aplicadas online.

**Já lançado:** vincule o lançamento ou o atendimento inteiro compatível. **Transferência interna:** escolha explicitamente essa opção e a outra conta/caixa da mesma congregação. A outra ponta pode ser vinculada quando seu extrato for importado. **Ignorar:** informe um motivo; a linha permanece disponível para restauração.

Reenviar os mesmos bytes para a mesma conta reabre o lote. Linhas idênticas em arquivos diferentes exigem reconhecer o mesmo movimento ou justificar que são distintos. A comparação não usa apenas documento/data/valor e não elimina ocorrências automaticamente.

Cancelamentos e correções posteriores aparecem na conferência. Um registro criado pelo importador só pode ser reaberto após cancelamento integral. Um vínculo com registro que já existia pode ser desfeito com motivo, preservando o lançamento financeiro. Pendências posteriores também aparecem no resumo dos lotes.

## Limites e conservação de dados

- XLSX do Sicoob, uma aba, até 5 MB e 5.000 movimentos. Fórmulas, macros, conteúdo externo e estruturas incompatíveis são rejeitados.
- Linhas inválidas são preservadas para conferência, sem permitir lançamento. Referências de saldo ficam fora da fila de movimentos.
- A conferência de saldos aceita uma única referência inicial no primeiro dia ou no dia imediatamente anterior e uma referência final no último dia. Outros intervalos ambíguos aparecem como indisponíveis. Divergências exigem motivo para prosseguir.
- Conferência pelo computador; em telas pequenas há orientação para usar um computador. Os demais fluxos financeiros mobile continuam disponíveis.
- Rascunhos e campos necessários do extrato ficam no banco, sob o escopo financeiro. O XLSX original não é armazenado. Não há persistência offline dos dados bancários.
- PDF/OCR, classificação automática, lançamentos em massa e rateio entre pessoas ficam fora desta versão.

## Persistência e autorização

Há tabelas próprias de lotes, itens, vínculos, eventos e operações. A confirmação usa a mesma transação e a mesma ordem de travas do núcleo financeiro. Chave de operação, revisão do item e exclusividade dos vínculos protegem retentativas e concorrência.

As rotinas verificam igreja, congregação, conta e permissões; as relações incluem a igreja. RLS permite leitura somente em unidades com consulta e criação autorizadas. As escritas diretas são revogadas. Transferências e identificação de membros mantêm as permissões próprias.

A origem `IMPORT` é definida antes da inserção do histórico imutável. O comando financeiro público continua usando origem `MANUAL`; o núcleo que recebe a origem é privado, sem execução concedida ao cliente.

Na validação inicial, sete migrações novas foram aplicadas exclusivamente no Supabase local. As migrações anteriores permaneceram intactas. Os ajustes descobertos nos testes foram registrados em migrações adicionais, preservando o histórico. Os tipos foram regenerados pelo CLI local. A aplicação online posteriormente autorizada está registrada abaixo.

## Verificação em 23/10/2026

| Verificação | Resultado |
| --- | --- |
| Lint, sem warnings | Aprovado |
| Typecheck | Aprovado |
| Vitest completo | 583 testes, 111 arquivos aprovados |
| Build com configuração local | Aprovado |
| Navegador: importação | 3 cenários aprovados: rascunho/retomada/próximo, ignorar/restaurar, reenvio, perda da resposta após gravação, linha inválida, vínculo manual, transferência e sobreposição |
| Navegador: regressão financeira | 11 cenários aprovados: formulário manual, atendimento, descrição coletiva, mobile, comprovantes e demonstrativos |
| SQL transacional | Preparação sem ledger, revisões, retentativas, vínculos, saldo divergente, manipulação da origem, cancelamento/reabertura, grants e isolamento aprovados |
| Concorrência real | Dois operadores: uma confirmação e um conflito; retentativa devolve o mesmo resultado; uma entrada no ledger |
| Volume | 5.000 linhas preservadas, páginas de 50 itens; preparação e primeira consulta entre aproximadamente 3 e 6 segundos no ambiente local |
| Amostra fornecida pelo usuário, somente em memória | 33 movimentos: 22 créditos, 11 débitos, três saldos, nenhuma linha inválida e reconciliação correspondente |

As capturas de desktop e mobile usam dados fictícios e foram inspecionadas. A planilha real não foi copiada para o repositório nem usada para criar lançamentos no banco.

### Auditoria geral do banco local

Os [Advisors do Supabase](https://supabase.com/docs/guides/observability/advisors) foram executados com `--local`, para segurança e desempenho. Não houve achado ERROR nem WARN nas estruturas novas. Os índices de referência apontados inicialmente foram adicionados e a autorização de leitura foi ajustada para não ser recalculada por linha.

Permanecem informações esperadas sobre índices ainda sem uso no ambiente de teste e sobre `finance_bank_import_operations`: essa tabela tem RLS, nenhuma policy e nenhum grant de leitura/escrita para o cliente, intencionalmente.

No restante do banco local, os Advisors apontam 16 warnings preexistentes: 11 de `auth_rls_initplan` e cinco de `multiple_permissive_policies`. O lint SQL geral também aponta dois erros preexistentes, fora deste recurso:

- `public.claim_stale_administrative_document_cleanups`: referência ambígua a `storage_path`.
- `private.count_congregation_dependencies`: construção incorreta do nome de uma relação em SQL dinâmico.

Essas funções não foram alteradas. Portanto, a verificação do recurso passou, mas o relatório global do banco ainda contém essas pendências.

## Reproduzir localmente

Use o Supabase local em execução e Node conforme `.node-version`. O harness recusa uma URL de API que não seja local e usa usuários fictícios; as sessões ficam no diretório ignorado `tmp/`.

```sh
SUPABASE_TELEMETRY_DISABLED=1 node scripts/finance-local.mjs setup
SUPABASE_TELEMETRY_DISABLED=1 node scripts/finance-local.mjs dev
# Em outro terminal:
SUPABASE_TELEMETRY_DISABLED=1 node scripts/finance-local.mjs e2e e2e/finance-bank-import.spec.ts --workers=1
node scripts/verify-finance-bank-import-concurrency.mjs
```

O roteiro SQL está em `supabase/tests/finance_bank_import_verification.sql`; ele inclui `finance_fixture.sql` da mesma pasta e termina com rollback. A aplicação de migrações deve usar explicitamente `--local` durante esta avaliação.

Os logs completos da validação inicial estão no diretório ignorado `tmp/`, com prefixo `finance-bank-import-`. Nenhum merge, push ou PR foi realizado. A publicação do código continua dependente de autorização do usuário.

## Aplicação online autorizada — 23/10/2026

Após o erro `UNAVAILABLE`, confirmou-se que a aplicação em `localhost:3000` usava o banco online, ainda sem a estrutura de importação. O usuário autorizou explicitamente apenas as sete migrações abaixo, mantendo a branch separada e sem publicar na `main`:

- `20261023191152_finance_bank_statement_import`
- `20261023192322_finance_bank_import_cashbox_reference`
- `20261023192503_finance_bank_import_source_audit`
- `20261023192623_finance_bank_import_decision_reason`
- `20261023194835_finance_bank_import_reference_indexes`
- `20261023195052_finance_bank_import_scoped_reads`
- `20261023195713_finance_bank_import_pending_summary`

A simulação confirmou exatamente essa lista. A aplicação terminou com sucesso, sem seeds, alteração de roles ou atualização do Vault. O histórico remoto confirmou as sete versões e a existência da consulta de importações. As cinco tabelas novas têm RLS habilitado.

A página foi aberta no Chrome com a sessão existente, na congregação Catedral, conectada ao banco online: resposta HTTP 200, título **Importar extrato bancário**, conta bancária disponível, seletor de XLSX e histórico vazio. O erro `UNAVAILABLE` não reapareceu. A verificação não enviou extratos nem criou lançamentos ou dados de teste online.

Os Advisors online não retornaram erros. Apontaram avisos gerais de segurança e os 16 avisos de desempenho já documentados. Para o importador, o aviso sobre funções `SECURITY DEFINER` executáveis por usuários autenticados abrange `prepare_finance_bank_import` e `finance_bank_import_item`: a execução é intencional, com autorização interna por igreja/congregação/permissão, `search_path` vazio e execução anônima revogada. Os auxiliares privados de gravação não são executáveis por usuários autenticados. A tabela interna de operações sem policy e os índices novos ainda sem uso aparecem como informações esperadas. Nenhuma alteração adicional foi aplicada em resposta aos Advisors.

A validação desta etapa foi de implantação e leitura autenticada. Os testes de gravação e concorrência permanecem restritos ao ambiente local, conforme a seção anterior. O código e os tipos gerados não precisaram de ajustes; a branch continua `codex/finance-bank-statement-import`.

## Correção da lentidão após upload

Os logs online do incidente posterior confirmaram sucesso na preparação do arquivo e erro PostgreSQL `57014` ao montar a conferência. As consultas falharam após aproximadamente oito segundos, o limite configurado para o usuário autenticado. O contexto apontou `get_finance_bank_import` → `bank_import_item_dto` → `bank_import_units` → `can_access_finance_unit`: cada item reiniciava a leitura e suas verificações de escopo.

A migração adicional `20261023210550_finance_bank_import_batched_reads` reúne a leitura da página e a conferência dos vínculos em consultas de conjunto. Mantém `SECURITY INVOKER`, RLS, escopo por igreja/congregação, autorização do chamador e o limite de tempo. A leitura de pendências no histórico usa a mesma conferência em conjunto. Não altera lançamentos, rotinas de gravação ou migrações anteriores.

### Evidências locais

- Reprodução com 15 congregações e página de 50 movimentos: antes, 3.829 ms e 55 avaliações do conjunto de escopos; depois, 229–276 ms e três avaliações. O teste de regressão falhou antes da correção e passou depois.
- Página com 50 movimentos finalizados: 661 ms e seis avaliações, com os vínculos conferidos contra os lançamentos atuais.
- 5.000 movimentos fictícios: preparação e leitura das duas primeiras páginas em aproximadamente 0,8 segundo.
- SQL: filtros, ordem/paginação, rascunhos, dados de origem, histórico, transferências, atendimento completo, alias após cancelamento/reabertura, restrição anônima, outras congregações e outras igrejas aprovados. Os dados de teste são revertidos ao final.
- Lint, typecheck e 583 testes unitários aprovados; três cenários de navegador aprovados, incluindo upload e abertura imediata da conferência.
- Tipos regenerados do banco local, sem diferença. Nenhuma alteração de interface pública.
- Advisors locais: nenhum aviso ou erro novo no recurso; permanecem os 16 avisos gerais e os dois erros SQL preexistentes já detalhados acima. Build não foi repetido nesta correção exclusivamente SQL, sem alteração do código da aplicação ou configuração.

Arquivos de teste: `supabase/tests/finance_bank_import_read_performance.sql` e `supabase/tests/finance_bank_import_verification.sql`. Logs adicionais em `tmp/bank-import-reads-*` (ignorados pelo Git).

### Aplicação online autorizada — 23/10/2026

Após autorização específica do usuário, a simulação confirmou somente `20261023210550_finance_bank_import_batched_reads.sql` pendente. Essa oitava atualização foi aplicada com sucesso ao banco online, sem seeds, alteração de roles ou atualização do Vault. O histórico remoto confirmou a versão. As funções de leitura verificadas continuam `SECURITY INVOKER`, com `search_path` vazio e sem execução anônima; as cinco tabelas de importação permanecem com RLS habilitado.

Com a sessão autenticada existente no Chrome, foram abertas as conferências dos extratos já importados em Canaã e na Catedral. Ambas exibiram **Conferência do extrato**, 33 movimentos pendentes e as ações de conferência, sem `UNAVAILABLE` e sem erros no console. A verificação foi somente de leitura: nenhum novo extrato ou lançamento foi criado.

Na janela da verificação (24/10/2026, 00:24–00:25:30 UTC; noite de 23/10 no horário local), os logs online registraram três respostas HTTP 200 de `get_finance_bank_import`, com duração de 344, 370 e 490 ms. As páginas responderam em 3,5 segundos na primeira abertura, incluindo inicialização de sessão, e 982 ms na segunda. Esses valores são observações desta verificação, não uma garantia de latência.

Os Advisors online foram executados novamente: nenhum erro e nenhum achado nas funções modificadas; permanecem os avisos gerais já descritos acima. Não houve alteração adicional em resposta aos avisos. A suíte local descrita nesta seção não foi repetida, pois nesta etapa apenas se aplicou a migração já testada e se verificou a leitura online.

O servidor temporário foi encerrado e a porta 3000 ficou livre. A branch permanece `codex/finance-bank-statement-import`, sem merge ou publicação na `main`.
