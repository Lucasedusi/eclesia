# Validação — relatório sintético por caixa

Data: 14/10/2026.

## Entrega

- Cabeçalho com logo, igreja, endereço, título em caixa alta e congregação/período à direita.
- Indicadores no início e no encerramento, separados das seções.
- Entradas e saídas por caixa, com dados bancários discretos. Não força uma página nova para cada caixa.
- Categorias em negrito; classificações registradas recuadas, com subtotal identificado. Categorias sem classificações têm uma linha com seu total.
- Tabela principal com categoria/classificação e total: sem nomes, descrições individuais, meios de pagamento ou coluna de quantidade.
- Corpo das tabelas em 7,5 pontos, valores e cabeçalhos numéricos alinhados à direita. Faixas verdes/vermelhas identificam entradas/saídas e seus totais.
- Cabeçalhos e categoria repetidos nas continuações; último item acompanha seu subtotal. Indicadores finais acompanham a observação de emissão.
- Resumo por departamento e saldos por caixa mantidos. Aberturas, ajustes e transferências aparecem como notas compactas, sem tabela detalhada de movimentos.

## Banco e compatibilidade

Migração `20261014175242_finance_synthetic_cashbox_summary.sql` aplicada localmente e no projeto online autorizado.

O RPC recebe uma projeção adicional `cashboxCategories`, agrupada pelo identificador do caixa, categoria e classificação histórica. `categories` consolidado permanece disponível para compatibilidade com a versão anterior do aplicativo. Nenhum lançamento ou saldo persistido foi alterado. O serviço confere valores e quantidades de cada caixa antes de gerar o PDF.

Preservados: `SECURITY INVOKER`, `search_path` vazio, RLS, igreja/congregação e filtros de exclusão. Verificação online confirmou execução negada a `anon` e permitida a `authenticated` com as verificações internas de autorização. Tipos TypeScript regenerados do banco online e comparados: sem alteração na assinatura pública.

Advisors de segurança e desempenho comparados antes/depois: nenhum novo alerta; alertas preexistentes permanecem.

## Evidências

- Testes novos de reconciliação sintética e projeção SQL falharam antes da implementação e passaram após a correção.
- `supabase/tests/finance_reports.sql`: passou no banco local, com rollback dos dados fictícios. Cobre totais analítico/sintético, categorias por caixa, filtro, histórico, cancelamentos/correções, permissões e limites. Consulta de 9.995 lançamentos em aproximadamente 6,04 segundos, dentro da referência de 8 segundos da suíte.
- `npm run lint -- --max-warnings=0`: passou.
- `npm run typecheck`: passou.
- `REPORT_PDF_QA=1 npm test`: 452 testes passaram em 85 arquivos.
- Build de produção pelo harness local (`node scripts/finance-local.mjs build`, que executa `npm run build`): passou.
- Playwright de relatórios: 6 cenários passaram — emissão dos dois modelos, nova aba/download, popup bloqueado, falha e tentativa, permissões do tesoureiro e descarte de resposta antiga/mobile.
- PDFs renderizados e inspecionados: simples em uma página, classificações e dados bancários, contas homônimas com movimentação e relatório com continuações. Testes conferem tamanho/recuo, limites de página, ausência de detalhes pessoais, separação por identificador e totais.
- Dez PDFs analíticos de referência: comparação SHA-256 dos fluxos descomprimidos de todas as 760 páginas antes/depois, sem nenhuma diferença. Metadados de criação do PDF não entram nessa comparação.

## Decisões de implementação

- Projeção adicional, preservando o campo legado, permite aplicar a migração antes do novo aplicativo sem quebrar a geração sintética anterior.
- Revisão executada diretamente, sem subagentes, conforme solicitado.
- Testes usam somente dados fictícios no banco local. Nenhum dado de teste foi inserido no projeto online.

Na revisão final, um teste reproduziu um título de caixa isolado na quebra de página. Corrigida a reserva de altura do primeiro grupo, incluindo seu subtotal quando necessário; os três cenários de fronteira passaram.
