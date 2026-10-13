# Validação — relatórios financeiros (12/10/2026)

## Entrega

Nova aba Relatórios com modelos analítico e sintético, seleção de caixa, prévia do PDF, download e impressão. Congregação/mês reaproveitam o contexto financeiro autorizado. O tesoureiro comum tem somente a congregação permitida, verificada na página, no endpoint e no banco.

Documento A4 com identidade da igreja, fontes incorporadas, resumo do mês, categorias/classificações, departamentos, caixas e movimentos auxiliares. Fonte de dados consistente por emissão, sem lançamentos automáticos ou alteração de saldos. Guia: `docs/finance/financial-reports.md`.

## Verificações executadas

- Baseline: 404 testes anteriores passaram.
- Suíte final: **436 testes em 84 arquivos passaram**.
- Lint com zero avisos e TypeScript passaram.
- Compilação de produção com o harness financeiro local passou, incluindo a nova rota e o endpoint.
- **5 cenários Playwright em Chromium** passaram na versão de produção: relatórios (3), navegação financeira (1) e consulta mensal (1).
- Os testes verificaram os mesmos bytes no Blob da prévia e no download, invalidação da prévia por mudança de tipo, descarte de resposta antiga, loading, layout mobile sem overflow, seletor do tesoureiro limitado a uma congregação, geração autorizada para a própria congregação e HTTP 403 para outra unidade.
- SQL local com fixtures fictícias e rollback: mesmos totais nos dois modelos; dízimos/classificação consolidados entre caixas; departamentos fora da base incluídos; saldo inicial/final; abertura no mês; ajuste negativo; transferência/cancelamento; correção de data e caixa; cancelamento de lançamento; caixa inativo; nomes históricos; mês vazio com saldo; isolamento entre igrejas e congregações; anon sem execução.
- Volume SQL: 1.005 linhas completas; exatamente 10.000 linhas imprimíveis aceitas; excedente rejeitado sem truncamento; sintético continua agregando além do limite do analítico. Transação sem registro correspondente no livro bloqueia a emissão.
- PDF: 0, 1, 49, 1.000 e 9.995 lançamentos; logo válido/ausente; acentuação; saldo negativo; texto longo; continuação de linhas; cabeçalhos e rodapés. Extração de texto confirmou todas as referências dos 1.000 lançamentos.
- Inspeção visual das páginas inicial/de continuação, sintético em tons de cinza e tela desktop/mobile. Ajustes decorrentes: largura da data, identificação da pessoa na continuação e reserva de espaço após a última linha de tabela.

## Desempenho

O primeiro teste de 9.995 lançamentos identificou consulta de aproximadamente 23,4 segundos. O EXPLAIN local mostrou releituras dos mesmos caixas e meios de pagamento 9.995 vezes. A segunda migração materializa os catálogos autorizados uma vez por emissão e reduz as colunas intermediárias.

Após a otimização, a mesma consulta levou aproximadamente **5,93 segundos** no banco local. O teste exige menos de 8 segundos, limite do papel autenticado no banco online. RLS, permissões e SECURITY INVOKER foram mantidos. A bateria de geração de PDF, incluindo 9.995 lançamentos, concluiu em aproximadamente 18 segundos no ambiente local; esse tempo não constitui garantia para qualquer hardware/volume histórico. A execução isolada do teste de 9.995 linhas levou 16,27 segundos, com RSS máximo de aproximadamente 680 MiB para o processo de testes (não uma medição isolada do endpoint em hospedagem).

## Banco online

Migrações da entrega:

- `20261012235135_finance_reports.sql`: nova RPC de leitura consistente e protegida.
- `20261013002041_finance_report_catalog_projection.sql`: otimização de leitura dos catálogos; preserva contrato e controles de acesso.

Não foram aplicados dados de teste online nem modificados valores financeiros. Tipos TypeScript gerados a partir do banco vinculado. Verificação da RPC: `SECURITY INVOKER`, `STABLE`, `search_path` vazio, sem execução por `anon`, com validação de escopo antes de ler os dados.

Advisors comparados por achado antes/depois: sem novos achados. Permanecem os alertas anteriores: RLS sem política (2), funções definer existentes (56), proteção de senha vazada (1), FKs sem índice (141), initplans RLS (11), índices sem uso (332), políticas permissivas múltiplas (5). Referência de interpretação: https://supabase.com/docs/guides/database/database-linter

## Limites e revisão

- Revisão direta, sem subagentes, por solicitação do usuário.
- Testado com Chromium em desktop e viewport mobile. Safari/Firefox e impressora física não foram testados: não havia esses navegadores/impressora configurados no ambiente de testes.
- Documentos refletem a emissão; não há fechamento contábil, gravação permanente de versões ou envio automático à contabilidade.
- Alterações restritas ao financeiro e às novas consultas; nenhuma migração anterior à entrega foi modificada.
- Envio ao GitHub e implantação do aplicativo não fazem parte desta execução. A atualização do banco online está separada da publicação do aplicativo.
