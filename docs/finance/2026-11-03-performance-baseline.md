# Medição de desempenho do módulo financeiro

Data: 3 de novembro de 2026. Código avaliado: `637c737b27abde7e648aafe1d715f1a9ed36a55d`.

O cenário de até **1.000 lançamentos por congregação/mês**, informado pelo usuário, respondeu sem falhas nas medições isoladas: a visão geral apareceu em aproximadamente **1,04 s**, os lançamentos em **0,61 s** e as demais telas medidas em **0,36–0,39 s** no desktop. Há, entretanto, um custo comprovado de crescimento: mantendo 1.000 lançamentos mensais, um ano de histórico elevou a consulta da visão geral a **5,62 s**. Com 9.900 lançamentos no mesmo mês, visão geral e relatórios atingiram o limite de 8 segundos do banco.

A prioridade sugerida é otimizar as verificações repetidas de permissão nas leituras financeiras e o processamento do histórico de saldo. A evidência não justifica uma reformulação geral da interface.

## Condições da medição

- Aplicação em produção local: Next.js 16.3.5, Node v24.21.0, `next build` e `next start`, porta 3221. Build concluído com sucesso.
- Computador: Apple M1 Pro, 16 GiB de memória. Banco no Colima, limitado a 2 CPUs e 2 GiB; PostgreSQL 17.6. Última migração local: `20261102194716`, 107 migrações registradas.
- Somente Supabase local e dados fictícios de uma igreja de teste. Nenhuma consulta ou alteração no banco online foi usada nesta avaliação.
- Chamadas medidas com usuário autenticado e controles normais de acesso. RLS permaneceu habilitada. Nenhuma função, política, índice, migração ou código de aplicação foi alterado.
- Desktop de 1440 × 900 e janela móvel de 393 × 852 no Chromium. Rede local e CPU sem limitação artificial; service worker bloqueado. A janela móvel mede o layout e as requisições, sem reproduzir o hardware ou a rede de um telefone.
- Volumes independentes do uso real: 100, 1.000 e 9.900 lançamentos no mês; a mesma quantidade de contas a pagar na Catedral. Entradas fictícias de R$ 10, distribuídas em 28 dias, uma categoria principal, com movimentos correspondentes no razão e projeção automática dos saldos.
- Histórico adicional em outra congregação fictícia: 1.000 lançamentos por mês de novembro/2025 a outubro/2026, totalizando 12.000. O mês consultado continuou com 1.000.

## Telas no navegador

Medianas em segundos, do início da navegação até o conteúdo financeiro esperado ficar visível e transcorrerem dois ciclos de pintura. A primeira observação está separada nos dados brutos; a tabela usa cinco repetições seguintes. Isso não é uma medição completa de tempo até toda interação possível estar pronta.

| Tela | 100 registros desktop | 1.000 registros desktop | 9.900 registros desktop | 1.000 registros janela móvel |
| --- | ---: | ---: | ---: | ---: |
| Visão geral | 0,37 s | 1,04 s | Limite de 8 s excedido | 1,04 s |
| Lançamentos | 0,34 s | 0,61 s | 4,59 s | 0,65 s |
| Caixas | 0,38 s | 0,39 s | 0,37 s | 0,37 s |
| Relatórios | 0,37 s | 0,36 s | 0,36 s | 0,36 s |
| Contas a pagar | 0,39 s | 0,38 s | 0,40 s | Disponível no desktop |

A tela de relatórios representa a abertura das opções; a emissão do documento está medida separadamente. Contas a pagar usa a quantidade de contas fictícias, e não o número de lançamentos financeiros. Na visão geral com 9.900, o navegador não apresentou o conteúdo esperado; a chamada ao banco correspondente foi cancelada após 8 segundos. O teste de visibilidade foi encerrado após 15 segundos, que não deve ser interpretado como tempo de resposta do banco.

Foram completadas 150 navegações medidas e registrados dois cenários de falha de conteúdo na visão geral de 9.900 registros, um por tamanho de janela. A abertura do formulário de entrada também foi exercitada nos três volumes. Não houve exceções JavaScript capturadas nas navegações concluídas.

O primeiro byte frequentemente chegou em poucos milissegundos porque a estrutura da página é transmitida antes dos dados. Esse valor isolado não representa o tempo de carregamento do financeiro. O comando de análise de rotas registrou 8 arquivos de referência e 123,2 KiB comprimidos para `/financeiro`; o navegador registrou cerca de 300 KiB transferidos em recursos estáticos na primeira abertura, incluindo recursos compartilhados. São medidas de escopo diferente.

## Consultas autenticadas

Tempo completo da chamada HTTP ao Supabase local, incluindo recebimento e leitura do resultado. Uma primeira observação e sete repetições por consulta bem-sucedida; mediana das sete repetições. Falhas são registradas separadamente, sem convertê-las em tempos de sucesso.

| Consulta | 100 lançamentos | 1.000 lançamentos | 9.900 lançamentos |
| --- | ---: | ---: | ---: |
| Visão geral | 0,09 s | 0,88 s | Limite de 8 s excedido |
| Lançamentos — primeira página | 0,05 s | 0,45 s | 4,40 s |
| Lançamentos — última página | 0,05 s | 0,44 s | 4,42 s |
| Lançamentos — busca textual | 0,05 s | 0,44 s | 4,40 s |
| Contas a pagar | 3,9 ms | 5,4 ms | 11,9 ms |
| Relatório sintético — dados | 0,10 s | 0,90 s | Limite de 8 s excedido |
| Relatório analítico — dados | 0,11 s | 0,91 s | Limite de 8 s excedido |

As listas retornaram páginas de 20 itens. Os relatórios bem-sucedidos foram conferidos contra a quantidade esperada de lançamentos. A busca textual e a última página cresceram de forma semelhante à primeira página, coerente com a consulta que materializa o conjunto filtrado para calcular totais antes de paginar.

## Emissão dos PDFs

Tempo do POST autenticado até receber o PDF completo. A assinatura do arquivo e sua leitura pelo parser PDF foram verificadas. Três emissões por combinação bem-sucedida: primeira emissão separada e mediana das duas seguintes.

| Documento | 100 lançamentos | 1.000 lançamentos | Páginas com 1.000 | 9.900 lançamentos |
| --- | ---: | ---: | ---: | --- |
| Sintético | 0,18 s | 0,98 s | 2 | HTTP 500 após cerca de 8,04 s |
| Analítico | 0,29 s | 1,98 s | 45 | HTTP 500 após cerca de 8,04 s |

O erro no maior volume acontece durante a consulta dos dados, antes de concluir a renderização do PDF. A contagem de 9.900 foi escolhida abaixo do limite de 10.000 linhas imprimíveis, que também conta resumos e movimentos auxiliares.

## Efeito do histórico acumulado

Nesta comparação, o mês de outubro continuou com 1.000 lançamentos. Foram feitas uma primeira leitura e três repetições por operação, com conferência dos totais de entrada e saldo anterior.

| Operação no banco | Somente 1 mês | 12 meses acumulados |
| --- | ---: | ---: |
| Visão geral | 0,88 s | 5,62 s |
| Lista mensal | 0,45 s no cenário base | 0,45 s |
| Dados do relatório sintético | 0,90 s no cenário base | 5,64 s |

A visão geral e os relatórios leem movimentos anteriores para reconstruir o saldo. Portanto, manter o movimento mensal abaixo de 1.000 não mantém essas consultas com o mesmo custo ao longo dos anos. Esses valores são tempos da consulta, sem uma medição adicional da página ou do PDF no cenário anual.

## Consultas simultâneas e gravação

20 solicitações da visão geral em cada rodada, com 1.000 lançamentos e um mês de histórico. As rodadas foram sequenciais e usaram o mesmo usuário e a mesma congregação; representam concorrência de requisições, não uma simulação completa de usuários e igrejas distintos. O p95 é o percentil empírico da amostra local.

| Requisições simultâneas | Sucessos | Mediana | p95 |
| --- | ---: | ---: | ---: |
| 1 | 20/20 | 0,87 s | 0,89 s |
| 5 | 20/20 | 2,29 s | 2,38 s |
| 10 | 20/20 | 4,61 s | 4,83 s |

A gravação de lançamentos pela chamada autenticada teve mediana de **11 ms**, em sete operações. O replay de uma mesma operação não criou um segundo lançamento. Isso mede a chamada de gravação ao banco; não inclui todo o fluxo de preenchimento e atualização da tela.

O teste de concorrência de importação passou: dois operadores não duplicaram a contabilização, e a disputa entre exclusão e contabilização foi serializada. A verificação de leitura de extrato com 50 linhas e 15 unidades passou: **589 ms** para pendentes e **820 ms** para concluídas, com 5 e 7 avaliações de escopo, respectivamente. São observações únicas. Não foi executada uma série crescente de tamanhos de arquivos XLSX.

## Causa observada no PostgreSQL

O diagnóstico `EXPLAIN (ANALYZE, BUFFERS)` executou as duas leituras centrais do saldo com os mesmos filtros de igreja, congregação, período e exclusão lógica da aplicação, usando o papel `authenticated`:

| Leitura | Linhas | Tempo |
| --- | ---: | ---: |
| Lançamentos confirmados do mês | 9.900 | 4.212 ms |
| Movimentos de saldo até o fim do mês | 9.902 | 4.207 ms |

Os contadores da sessão registraram **19.802 chamadas** de `private.can_access_finance_unit`, com **8.397 ms** de tempo inclusivo. Dentro desse total, `private.access_has_permission` consumiu **7.271 ms**. Os dois valores se sobrepõem e não devem ser somados. Os planos usaram índices, mas a permissão de acesso foi reavaliada por linha.

Como controle diagnóstico local, as mesmas leituras com papel privilegiado levaram cerca de 2,19 ms e 1,05 ms. Essa comparação isola o custo das políticas; ela não é um resultado válido de desempenho para usuários nem uma proposta de retirar RLS. O limite de tempo foi elevado somente na transação de diagnóstico, que terminou com rollback. O limite normal de `authenticated` permaneceu em **8 s**.

Referências do código: `supabase/migrations/20261003210536_finance_scoped_access.sql`, `20261003211033_finance_catalogs_and_ledger.sql`, `20261004205135_finance_operator_assignments.sql`, `20261004194420_finance_scoped_queries.sql`, `20261027132246_finance_counterparty_identification.sql` e `20261014175242_finance_synthetic_cashbox_summary.sql`. Essas migrações são históricas e não foram editadas.

## Verificações e pendências

- Build de produção: passou.
- `npm run analyze:routes -- financeiro`: executado.
- `e2e/finance-query.spec.ts`: 1 teste passou na aplicação de produção local.
- `supabase/tests/finance_access_verification.sql`: passou.
- `supabase/tests/finance_bank_import_read_performance.sql`: passou.
- `scripts/verify-finance-bank-import-concurrency.mjs`: passou.
- Os testes originais `finance_queries_verification.sql`, `finance_reports.sql` e `verify-finance-concurrency.mjs` falharam na preparação por `INVALID_INPUT`: suas configurações fixas de outubro/2026 passaram a ser retroativas em novembro e não fornecem a justificativa exigida. Os originais foram preservados. Cópias temporárias receberam apenas as justificativas de retroatividade para permitir o diagnóstico.
- Nessas cópias, consultas e concorrência de lançamentos passaram. O relatório com **9.995 linhas levou 8.541 ms** e falhou na asserção de menos de 8 segundos. Os testes posteriores a essa asserção não foram executados. A conexão encerrou a transação sem persistir a massa dessa suíte.
- Advisors locais de segurança e performance, níveis WARN e ERROR: **13 avisos, nenhum erro**. São 9 avisos `auth_rls_initplan` e 4 `multiple_permissive_policies`, em tabelas fora das três tabelas financeiras centrais. Esse resultado não substitui o diagnóstico de funções de permissão por linha.
- A primeira preparação da congregação do teste anual omitiu a regional obrigatória; a cópia temporária foi corrigida e a medição anual foi reexecutada com sucesso.
- Lint, typecheck, suíte Vitest completa e suíte E2E completa não foram reexecutados: não houve alteração de código de aplicação e esta atividade cobriu medições e verificações selecionadas. Não há aprovação de regressão completa do módulo implícita neste relatório.

## Prioridades sugeridas

1. **Reduzir verificações repetidas do mesmo escopo nas leituras financeiras.** A validação deve manter permissões, igrejas, congregações, escopos e exclusão lógica, além de testar acessos negados. Qualquer alteração de banco deve usar nova migração. Repetir esta base de medição antes/depois.
2. **Tratar o custo do histórico de saldos.** Avaliar a consulta após a melhoria de autorização e só então decidir se são necessários resumos históricos ou outra estratégia. O cenário de um ano já mostra impacto no volume mensal esperado.
3. **Atualizar as fixtures antigas para sobreviver à mudança de mês.** A justificativa de configuração retroativa precisa fazer parte dos dados fictícios quando aplicável.
4. **Confirmar resultados na hospedagem e em dispositivos reais.** Medir latência de rede, recursos do banco online e tráfego representativo em uma etapa autorizada. Nenhuma dessas condições é inferida a partir do computador local.

## Evidências e reprodução

As amostras e resultados estão em [2026-11-03-performance-measurements.json](2026-11-03-performance-measurements.json). Os scripts e logs locais desta rodada permanecem em `tmp/finance-performance-20261103/`, incluindo `measure.mjs`, `explain.sql`, `all-results.json`, `stress-results.json`, `history-results.json` e os logs das verificações. Sessões e chaves locais permanecem somente nessa pasta ignorada e não integram os artefatos em `docs/`.

Ao finalizar, o servidor da porta 3221, os serviços locais do Supabase e o Colima foram encerrados. Os volumes foram preservados, e o contexto Docker voltou ao estado anterior.

Para repetir a medição, iniciar os serviços locais, gerar uma nova fixture com `local.mjs setup`, compilar e iniciar com `local.mjs build` e `local.mjs start`, e executar os modos de `measure.mjs` sequencialmente. A preparação recusa Supabase fora de `127.0.0.1`. O modo `all` usa a nova fixture para os três volumes; `stress` permite inspecionar separadamente a fixture já expandida e `history` prepara outra congregação com histórico anual. As massas locais permanecem no volume de testes para inspeção; não foram exportadas do ambiente online.

Os tempos são uma referência controlada deste código e hardware. As poucas repetições não caracterizam p95 de produção, capacidade máxima, redes móveis ou todas as combinações de categorias, anexos, operadores e igrejas. Atendimento, demonstrativos, comprovantes digitais, integração de pagamentos e fluxos de anexos não receberam uma bateria própria de desempenho nesta rodada.
