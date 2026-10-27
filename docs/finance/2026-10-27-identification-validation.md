# Identificação dos lançamentos e ajustes do extrato

Implementado em `codex/finance-bank-statement-import`, sem subagentes, publicação, alteração da main ou acesso ao banco online.

## Resultado

- Seção **Identificação**, com **Recebido de** nas entradas e **Pago a** nas saídas.
- Pessoas cadastradas/não cadastradas, congregação vinculada, empresa/instituição/outros com nome livre e contribuição coletiva nas entradas. Saídas mantêm a possibilidade de não informar uma identificação.
- O seletor é compartilhado entre lançamento manual, atendimento, extrato e correção. Rascunhos e prévias preservam o tipo e o nome selecionados. Salvar e continuar limpa a identificação anterior e inicia uma saída sem identificação explícita.
- Congregação contraparte tem ID separado da unidade contábil. Busca autenticada expõe somente ID e nome das congregações ativas da mesma igreja. A unidade que registra o lançamento conserva as verificações de acesso.
- Consultas têm filtro **Congregação que pagou ou recebeu**; comprovantes, relatórios e detalhes exibem o nome gravado. A consulta não aceita silenciosamente um filtro ignorado por um banco desatualizado.
- Nomes antigos não foram convertidos automaticamente em vínculos. A correção de item de atendimento mantém o nome histórico de sua congregação, mesmo após renomeação, e impede trocar o vínculo do grupo.
- Dízimos e categorias que exigem pessoa preservam a exigência de pessoa cadastrada/não cadastrada. Nenhum controle de baixas, transferência automática ou lançamento na contraparte foi criado.
- Após salvar/concluir conferência do extrato, a tela leva rolagem e foco ao início da fila, com mensagem e filtros visíveis. Filtros/página são preservados. Rascunho e falha mantêm o editor.
- O botão único **Salvar** do extrato centraliza ícone e texto sem divisória. O atendimento conserva seus botões adicionais.

## Banco local e implantação futura

Criadas e aplicadas **somente localmente**, na ordem:

1. `20261027132246_finance_counterparty_identification.sql`: vínculo, chaves estrangeiras compostas, índices, busca mínima, comandos atômicos e consulta.
2. `20261027133937_finance_counterparty_history_guards.sql`: proteção contra tipo nulo com vínculo e preservação da identidade histórica nas correções agrupadas.

Migrações anteriores permaneceram intactas. Não houve reclassificação de registros existentes. Os tipos foram regenerados pelo CLI a partir do banco local. RLS, permissões, auditoria, idempotência e origem dos lançamentos importados foram revisadas.

**O uso completo deste código contra o banco online depende da aplicação dessas duas atualizações, ainda não autorizada nem realizada.** Até lá, busca/gravação dos novos tipos e abertura de detalhes que leem a nova coluna não são compatíveis com o banco antigo.

## Validação

| Verificação | Resultado |
| --- | --- |
| Lint, zero warnings | Aprovado |
| TypeScript | Aprovado; também verificado pelo build final |
| Vitest | 596 testes em 113 arquivos aprovados |
| Build | Aprovado com configuração exclusiva do Supabase local |
| SQL financeiro | 18 suítes aprovadas, com dados fictícios e rollback |
| Navegador | 18 cenários distintos aprovados entre as rodadas finais; 17/18 na rodada completa e 5/5 na confirmação final |
| Segurança/desempenho do banco | Advisors executados localmente: nenhum erro; 16 avisos em políticas existentes não alteradas (11 `auth_rls_initplan`, 5 `multiple_permissive_policies`) |
| Revisão visual | Atendimento com congregação, saída no celular, botão Salvar e retorno à fila |
| Encerramento | Servidor web de teste encerrado; portas 3217 e 3000 livres |

Os cenários novos cobrem lançamento manual de entrada/saída, filtro por congregação, correção, continuidade sem reaproveitar favorecido, rascunho de extrato, rolagem/foco após salvar, atendimento, comprovante e formulário móvel. Regressões cobrem importação, descarte/navegação, resposta perdida, duplicidade, vínculo/transferência, exclusão/restauração, contribuições coletivas e acesso restrito.

As falhas iniciais reproduziram os tipos não suportados, a ausência do retorno ao topo e a correção após renomear uma congregação. Ajustes nos testes corrigiram seletores do rótulo antigo e a seleção de um campo Data oculto preservado pelo Next.js. Um teste de exclusão excedeu cinco segundos no servidor de desenvolvimento; passou na versão compilada. Quatro verificações SQL inicialmente falharam por referências relativas ao arquivo de fixture no executor; passaram após incluir corretamente os dados locais. Nenhum desses resultados foi omitido como aprovação.

Revisão final feita pelo próprio implementador, conforme proibição de subagentes. Não houve teste online. Análise de tamanho de rotas não se aplica: não há objetivo de otimização de carregamento nesta alteração. Logs e imagens fictícias ficam em `tmp/identity-*`, ignorados pelo Git.
