# Refinamentos da importação — validação local de 24/10/2026

Implementação na branch `codex/finance-bank-statement-import`, sem subagentes, push, merge ou alteração no banco online.

## Comportamento

- Upload destacado com seleção ou arrastar arquivo, nome, tamanho, substituição e remoção da seleção.
- Histórico com paginação discreta e exclusão disponível somente sem histórico financeiro.
- Três cartões independentes, faixa de contagens e pendências em amarelo. Os totais considerados excluem os itens removidos.
- Itens sem histórico financeiro podem ser excluídos e recuperados pelo filtro **Excluídos**. Confirmação, revisão, escopo e auditoria são preservados.
- Reenviar o mesmo arquivo mantém as exclusões de itens. Excluir toda uma importação permite importar o arquivo novamente.
- Entradas e saídas usam formulário e prévia lateral; botões com ícones alinhados ao Atendimento. Em telas intermediárias a prévia fica abaixo do formulário.
- Transferências, vínculos e decisões ficam em **Mais opções**. Duplicidade e divergência real mantêm avisos compactos e resolução explícita.
- Novos movimentos têm uma classificação e valor fixo. Rascunhos antigos rateados só são unificados mediante confirmação.

Cancelar um lançamento ou desfazer um vínculo não libera a exclusão do histórico. Excluir dados da conferência nunca cancela movimentações financeiras.

## Banco local e implantação pendente

Migrações criadas e aplicadas exclusivamente ao Supabase local:

1. `20261024235420_finance_bank_import_lifecycle.sql`: remoção/restauração auditadas, autorização, idempotência, trava compartilhada com lançamentos, filtro de excluídos e contadores.
2. `20261025000047_finance_bank_import_history_totals.sql`: totais do histórico sem itens excluídos e ajuste da página após remoção.

O segundo arquivo corrige um caso detectado pelo teste de totais do histórico, preservando a primeira migração já aplicada. Migrações anteriores permaneceram intactas. Tipos regenerados pelo CLI local.

As duas atualizações ainda dependem de autorização para aplicação online. Na base anterior, as ações de exclusão ficam desabilitadas por ausência da capacidade retornada pelo banco; o filtro novo de excluídos requer as migrações. A configuração normal `.env.local` continua apontando para o banco online; para testar todas as alterações, use o ambiente local abaixo.

## Evidências

| Verificação | Resultado |
| --- | --- |
| Lint sem warnings e TypeScript | Aprovados |
| Vitest completo | 585 testes em 111 arquivos aprovados |
| Build com configuração local | Aprovado |
| Playwright | Cinco cenários aprovados, incluindo perda de resposta, vínculo, transferência, duplicidade, exclusão/restauração, totais, prévia de saída e rascunho antigo |
| SQL do ciclo de vida | Aprovado: autorização, igreja/congregação, anônimo, histórico após cancelamento/desvínculo, replay, revisão, exclusão/restauração e última página de itens/histórico |
| SQL de regressão | Aprovado: 5.000 movimentos, consultas, auditoria, vínculos, reconciliação e isolamento |
| Concorrência | Dois operadores; lançamento único; exclusão de item/lote versus lançamento tem um único vencedor e não oculta dinheiro |
| Performance local | Página de 50 pendentes: 357 ms e quatro avaliações de escopo; 50 concluídos: 1.117 ms e sete avaliações |
| Advisors locais | Nenhum erro; 16 avisos gerais preexistentes de desempenho, sem achados nas estruturas novas |
| Revisão visual | Capturas fictícias inspecionadas em desktop e largura intermediária; sem rolagem horizontal na conferência a 1.024 px |

Os avisos gerais são 11 de `auth_rls_initplan` e cinco de `multiple_permissive_policies`, nas mesmas tabelas documentadas na validação anterior. Não foram feitas mudanças fora deste requisito para tratá-los. Não houve teste nem escrita online, conforme solicitado. A análise de rotas não se aplica: este ajuste não pretende modificar a estratégia de carregamento ou o tamanho dos pacotes.

Logs e capturas ficam no diretório ignorado `tmp/`, principalmente `import-refinement-*`. As capturas não contêm dados reais. O servidor temporário na porta 3217 foi encerrado.

## Teste manual no ambiente local

Com o Supabase local já em execução e as migrações aplicadas:

```sh
SUPABASE_TELEMETRY_DISABLED=1 node scripts/finance-local.mjs dev
```

Use a sessão fictícia local; o harness guarda sessões e catálogo em `tmp/`. A suíte autenticada pode ser reproduzida em outro terminal:

```sh
SUPABASE_TELEMETRY_DISABLED=1 node scripts/finance-local.mjs e2e e2e/finance-bank-import.spec.ts --workers=1
```

O teste SQL `supabase/tests/finance_bank_import_lifecycle.sql` inclui `finance_fixture.sql` da mesma pasta e termina com rollback. O teste de concorrência usa exclusivamente o contêiner local.
