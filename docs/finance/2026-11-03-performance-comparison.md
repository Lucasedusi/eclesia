# Financeiro: implementação e comparação local — 3 de novembro de 2026

O gargalo de autorização por lançamento foi removido nas duas leituras centrais, preservando a regra existente de permissões e o isolamento por igreja/congregação. Para até 1.000 lançamentos mensais, os resultados locais mostram folga considerável. O histórico de 12 meses deixou de justificar, nesta etapa, a complexidade de criar resumos de saldo.

Implementação na branch `codex/finance-read-performance`, commit medido `7672004`. Somente o Supabase local recebeu as migrações. Não houve alteração na hospedagem, no limite autenticado de 8 segundos, no limite de impressão ou nas regras de gravação.

## Condições da comparação

Mesma máquina Apple M1 Pro, 16 GiB; mesma VM de banco com 2 CPUs/2 GiB; PostgreSQL 17.6, Node 24.21.0 e Next.js 16.3.5. Build de produção, rede local sem limitação artificial e contas fictícias. Os dados antigos foram preservados e as novas massas usam identificadores independentes; portanto, a segunda rodada tem mais dados totais no banco.

Mesmo roteiro e critérios da [linha de base](2026-11-03-performance-baseline.md): RPC com primeira amostra separada e mediana de 7 repetições; navegador com mediana de 5 repetições após a primeira; PDF com mediana de 2 após a primeira; histórico com 3 após a primeira. Consultas e testes pesados não correram simultaneamente à medição. Todos os tempos nas tabelas abaixo são **milissegundos**, antes → depois.

## Consultas autenticadas

| Consulta | 100 lançamentos | 1.000 lançamentos | 9.900 lançamentos |
| --- | --- | --- | --- |
| Visão geral | 94,6 → 20,3 | 881,5 → 11,9 | falha após 8 s → 26,1 |
| Lançamentos — primeira página | 48,7 → 7,7 | 446,9 → 9,8 | 4.397,0 → 33,2 |
| Lançamentos — última página | 48,4 → 6,4 | 444,7 → 8,9 | 4.418,0 → 34,0 |
| Lançamentos — busca textual | 48,7 → 6,1 | 440,0 → 8,3 | 4.398,5 → 24,5 |
| Contas a pagar | 3,9 → 5,7 | 5,4 → 6,1 | 11,9 → 12,5 |
| Relatório sintético — dados | 99,3 → 15,6 | 896,4 → 19,3 | falha após 8 s → 57,1 |
| Relatório analítico — dados | 110,3 → 14,7 | 910,2 → 35,9 | falha após 8 s → 228,5 |

A visão geral com 1.000 teve redução de aproximadamente 98,7%; a primeira página, 97,8%. Contas a pagar serve como comparação de um fluxo que já era rápido e não recebeu essa mudança. Pequenas oscilações, inclusive em 100 lançamentos, não sustentam conclusões sobre regressão de poucos milissegundos.

## Conteúdo visível no navegador

| Tela | 1.000 desktop | 1.000 janela móvel | 9.900 desktop |
| --- | --- | --- | --- |
| Visão geral | 1.041,9 → 388,0 | 1.035,2 → 380,5 | falha → 327,3 |
| Lançamentos | 613,0 → 397,3 | 647,0 → 393,7 | 4.586,9 → 322,9 |
| Caixas | 385,5 → 379,8 | 368,1 → 376,7 | 372,4 → 378,9 |
| Relatórios | 364,4 → 364,3 | 364,8 → 363,7 | 364,9 → 372,5 |
| Contas a pagar | 381,2 → 394,4 | — | 396,0 → 389,8 |

Foram concluídas 162 navegações medidas, sem falhas de conteúdo nem exceções JavaScript capturadas. O tempo inclui navegação até o conteúdo esperado e dois ciclos de pintura; não equivale a medir toda interação possível. A janela móvel foi emulada no computador. A tela de relatórios mede a abertura das opções, não a geração do documento. O pacote de `/financeiro` permaneceu em 123,2 KiB comprimidos; nenhum componente visual mudou.

## PDFs

| PDF | 1.000 lançamentos | Páginas | 9.900 lançamentos | Páginas |
| --- | --- | --- | --- | --- |
| Sintético | 976,6 → 92,2 | 2 | falha HTTP 500 → 133,7 | 2 |
| Analítico | 1.983,6 → 1.093,4 | 45 | falha HTTP 500 → 10.010,9 | 432 |

As 18 emissões retornaram PDF válido. O analítico maior produz 432 páginas e ainda leva cerca de 10 segundos: o custo remanescente é principalmente a geração do documento, enquanto seus dados chegam em 229 ms. Para 1.000 lançamentos, o mesmo documento leva cerca de 1,09 s. O limite existente de 10.000 linhas imprimíveis permanece; 9.900 deixa espaço para resumos auxiliares. Esta entrega não inclui processamento de PDFs em segundo plano.

## Histórico e concorrência

| Consulta com 12.000 no histórico | Antes | Depois |
| --- | --- | --- |
| Visão geral — 12 meses de histórico | 5.616,9 | 19,0 |
| Lançamentos — 12 meses de histórico | 445,5 | 9,6 |
| Relatório sintético — 12 meses de histórico | 5.642,4 | 27,1 |

O mês consultado continua com 1.000 lançamentos; os 11 meses anteriores somam mais 11.000. Entradas e saldo inicial foram conferidos. Não é necessário introduzir resumos históricos para resolver o cenário medido; volumes de vários anos devem continuar sendo acompanhados.

20 consultas de visão geral por rodada, com 1.000 lançamentos e um mês de histórico:

| Simultâneas | Mediana | p95 da amostra | Sucessos |
| --- | --- | --- | --- |
| 1 | 870,7 → 9,7 | 889,6 → 11,1 | 20/20 → 20/20 |
| 5 | 2.292,5 → 23,9 | 2.375,5 → 32,0 | 20/20 → 20/20 |
| 10 | 4.608,7 → 44,9 | 4.828,3 → 47,9 | 20/20 → 20/20 |

Com 9.900 lançamentos, também houve 20/20 sucessos em cada rodada de 1, 5 e 10 solicitações simultâneas; na última, mediana de 116,8 ms e p95 de 125,5 ms. A concorrência usa o mesmo usuário/unidade, não uma população real de igrejas. A gravação teve mediana de 10,4 ms (antes 11 ms), com sete operações e replay sem duplicação.

## O que mudou e como o acesso foi preservado

A função privada `readable_finance_units()` calcula o conjunto de pares igreja/congregação acessíveis na consulta e reutiliza `can_access_finance_unit(..., 'finance.view')`. As políticas de leitura de lançamentos e razão usam esses pares completos e mantêm a exclusão lógica. Não existe cache compartilhado entre requisições ou usuários. A função tem identidade derivada da sessão, caminho de busca vazio e execução restrita; as funções públicas de consulta continuam com as permissões do usuário.

O teste com 1.000 linhas passou de 1.000 avaliações da autorização para **2 por leitura**, mesmo com 80 congregações adicionais de outra igreja. No diagnóstico com 9.900 lançamentos, as duas leituras passaram de 19.802 avaliações para **6** (três congregações candidatas nessa massa). Os planos confirmam uma execução do conjunto por leitura. Os tempos isolados passaram de 4.212/4.207 ms para 10,5/5,3 ms. O diagnóstico ocorreu após adicionar o histórico anual, aumentando o total de dados; não é um teste de capacidade máxima.

Foram necessárias duas migrações novas: a primeira introduz o conjunto e as políticas; a segunda materializa os candidatos para impedir que o planejador avalie permissões em congregações de igrejas sem acesso. A primeira já havia sido aplicada localmente, por isso foi preservada como histórico imutável. Nenhuma migração anterior foi editada.

## Validação

- Lint sem avisos, verificação de tipos, 122 arquivos/669 testes automatizados e build de produção: passaram.
- 23 verificações SQL financeiras: passaram, incluindo permissões, comandos, saldos, relatórios, recibos, demonstrativos, importações e o novo teste de custo/isolamento.
- 11 testes de navegador: passaram (lista, visão geral em três larguras móveis e desktop, PDFs e recusa de PDF de outra congregação).
- Concorrência de lançamentos e de importação bancária: passou, sem duplicação e com conflitos serializados.
- Escopos CHURCH, REGION, CONGREGATION e MINISTRY, ministério local/global, múltiplos acessos/igrejas, negações explícitas, bloqueio, registros excluídos, ausência de sessão e mudança de identidade/permissão em consulta preparada: verificados.
- Totais no maior volume conferidos: 9.900 lançamentos de outubro, 9.900.000 centavos de entradas e saldo final, última página com 20 registros e contagem idêntica no relatório.
- Tipos regenerados a partir do banco local: definições públicas idênticas, sem alteração manual; a única diferença de saída era uma linha vazia final, não incorporada.
- Advisors locais: mesmos 13 avisos prévios (9 `auth_rls_initplan`, 4 `multiple_permissive_policies`), nenhum erro e nenhum aviso novo. Os avisos estão fora das duas tabelas alteradas.

As falhas iniciais de nove suítes SQL e do verificador de concorrência vieram de dados de configuração de outubro sem a justificativa retroativa exigida em novembro. As fixtures receberam justificativas; os casos negativos que intencionalmente omitem a justificativa foram mantidos. O novo teste também revelou uma conversão numérica inadequada e duas necessidades de preparação de dados (regional obrigatória e unidade já arquivada), corrigidas na fixture. A regressão de desempenho foi observada antes da correção: 1.000 avaliações para 1.000 linhas e relatório de 9.995 linhas acima de 8 segundos.

A suíte completa de navegador do produto não foi executada; foram executados os 11 cenários afetados. Rede/hospedagem remota, dispositivos reais, muitas igrejas/operadores distintos, grande quantidade de congregações acessíveis por usuário e histórico superior a 12 meses não foram medidos. Os percentis locais têm poucas amostras e não representam um compromisso de produção.

## Evidências e continuidade

[Amostras após a mudança](2026-11-03-performance-after-measurements.json) e [amostras anteriores](2026-11-03-performance-measurements.json). Roteiros e logs da rodada permanecem na pasta ignorada `tmp/finance-performance-after-20261103/`: `local.mjs`, `measure.mjs`, `diagnostic.mjs`, logs SQL, build e navegador. Sessões ficam somente nessa pasta e não integram os relatórios versionados.

Para reproduzir, iniciar o Supabase local, aplicar as duas migrações locais, executar `local.mjs setup`, `build` e `start`, depois `measure.mjs all` e `history` sequencialmente. O setup cria nova massa fictícia e recusa um Supabase fora de `127.0.0.1`. O banco e as permissões reais de produção exigem uma validação posterior autorizada antes de publicar.
