# Informativo geral e entrega de relatórios

Implementação na branch `codex/finance-ranking-deliveries`, baseada na `main` em `59cdbf2`. Execução, revisão e validação diretas, sem subagentes. A aplicação não foi publicada nem integrada à main.

## Decisões aprovadas

- Ambos os recursos restritos a administradores ativos da igreja, com acesso financeiro. Tela, ações, PDF e banco verificam autorização e escopo.
- Ranking em **Relatórios → Informativo geral por congregação**. Meses inicial/final inclusivos; catedral incluída; todas as congregações ativas autorizadas, com opção de inativas. A unidade selecionada no cabeçalho não restringe o ranking.
- Ordem por entradas decrescentes, depois nome e identificador. Entradas/saídas somadas no intervalo; saldo final acumulado ao final do último mês; total geral somando as congregações.
- Repasse e prebenda bruta opcionais, com as mesmas regras do informativo individual. Repasse somente percentual da base elegível; bruto após teto e antes de descontos. Meses ausentes e versões desatualizadas ficam identificados; totais com ausências são parciais.
- PDF enxuto com cabeçalho institucional, faixa verde, tabela, totais e notas apenas quando necessárias. Abertura em nova aba com carregamento e alternativa para baixar.
- Controle em **Relatórios → Acompanhar entregas**: mês, busca, inativas opcionais, Todas/Entregues/Não entregues com contagens. Catedral excluída. PDF reproduz os filtros e a busca.
- Recebimento com data civil informada, posterior ao encerramento do mês de referência e até o dia atual em São Paulo. Correção e desfazimento exigem motivo e conservam histórico.
- Prazo em **Configurações financeiras → Prazo de entrega**, com padrão inicial dia 8 do mês seguinte. Novas regras a partir do mês de referência atual ou futuro; meses anteriores preservados. Dias inexistentes usam o último dia do mês de entrega.

## Banco e integridade

Migração `20261022201843_finance_ranking_deliveries.sql` aplicada e validada localmente, depois aplicada ao projeto online `dhgrfvakdbtedqfgecys`, sob a autorização anterior do usuário. Nenhum seed, usuário fictício ou lançamento de teste foi enviado ao projeto online. Tipos regenerados do banco online.

As consultas são `STABLE SECURITY INVOKER`, sob RLS, com verificação administrativa explícita. O ranking reutiliza `get_finance_informative_report` e os cálculos existentes em uma única consulta consistente. Há limite de 60 meses e de 3.000 combinações congregação/mês por emissão, sem truncamento silencioso.

O controle reaproveita `report_deliveries` e adiciona duas tabelas imutáveis: regras de prazo e eventos de recebimento. Relacionamentos incluem a igreja nas chaves compostas. As tabelas negam escrita direta; leituras administrativas têm RLS. As duas RPCs de gravação usam `SECURITY DEFINER`, `search_path` vazio e autorização explícita, porque o domínio financeiro permite gravação somente por comandos validados. Elas usam o mesmo bloqueio transacional por igreja dos demonstrativos, chave de idempotência e revisão esperada. Alterações também são registradas em `audit_logs`.

Registrar, corrigir ou desfazer entrega não cria demonstrativos, pagamentos nem lançamentos financeiros. Gerar demonstrativo não confirma recebimento. A autorização de papel e permissão nas novas funções é verificada no mesmo acesso ativo ADMIN/CHURCH.

## Validação

- Lint sem avisos e TypeScript aprovados.
- 541 testes Vitest, em 105 arquivos, aprovados.
- Build de produção com ambiente local aprovado, incluindo a nova rota e os limites Server/Client.
- Treze cenários Playwright dos relatórios passaram, incluindo quatro novos. Os quatro novos foram repetidos com extração e verificação do PDF real pelo link de download, usando base fictícia renovada.
- Testes SQL transacionais com rollback: catedral/inativas, isolamento, negação a tesoureiro e anônimo, entrega sem demonstrativo, idempotência, revisão concorrente, correção, desfazimento, histórico e auditoria, datas futuras, prazo histórico, fevereiro bissexto/comum e virada do ano. Regressões do informativo individual e demonstrativos executadas separadamente.
- PDFs renderizados e inspecionados, incluindo totais parciais, colunas opcionais, PDF real do navegador e três páginas de entregas. Tela mobile sem transbordamento horizontal.
- Advisors locais: 16 avisos preexistentes, nenhum envolvendo as novas estruturas.
- Advisors online: nenhum erro novo. Dois avisos novos do [lint 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), referentes às RPCs administrativas de gravação intencionalmente expostas a usuários autenticados, foram revisados com testes de autorização e negação de escrita direta. Quatro informações de [índices ainda não utilizados](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) correspondem aos índices recém-criados para consultas e chaves estrangeiras; preservados.

Os testes intermediários detectaram seletores ambíguos ao reutilizar o histórico de uma fixture e ao capturar conteúdo oculto durante a renderização. Foram ajustados para selecionar a ocorrência recente/visível, com nova execução aprovada. A captura do PDF passou a validar os bytes do arquivo acessível ao usuário.

Não foram repetidos testes de outros módulos, impressão física, Safari ou Firefox. O servidor temporário de testes na porta 3217 foi encerrado. Não foi iniciado servidor na porta 3000.

## Teste manual

1. Inicie a aplicação nesta branch e entre como administrador.
2. Em Relatórios, escolha **Informativo geral por congregação** e confira ordem, saldo final, total geral e opções de repasse/prebenda/inativas.
3. Em **Acompanhar entregas**, selecione um mês encerrado e registre uma data. Confira as abas, corrija a data com motivo e consulte o histórico.
4. Gere o PDF nas três situações; use a busca e confira que ela é reproduzida.
5. Em Configurações, cadastre o prazo para uma referência atual/futura e confira que meses anteriores mantêm dia 8 ou sua regra histórica.
