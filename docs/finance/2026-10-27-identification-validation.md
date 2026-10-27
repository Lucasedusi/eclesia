# Identificação dos lançamentos e ajustes do extrato

Implementado em `codex/finance-bank-statement-import`, sem subagentes, publicação ou alteração da main. A implementação e os testes iniciais usaram somente o banco local; a aplicação online autorizada está registrada ao final.

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

## Banco local e preparação da implantação

Criadas e aplicadas inicialmente **somente localmente**, na ordem:

1. `20261027132246_finance_counterparty_identification.sql`: vínculo, chaves estrangeiras compostas, índices, busca mínima, comandos atômicos e consulta.
2. `20261027133937_finance_counterparty_history_guards.sql`: proteção contra tipo nulo com vínculo e preservação da identidade histórica nas correções agrupadas.

Migrações anteriores permaneceram intactas. Não houve reclassificação de registros existentes. Os tipos foram regenerados pelo CLI a partir do banco local. RLS, permissões, auditoria, idempotência e origem dos lançamentos importados foram revisadas.

O uso completo deste código contra o banco online dependia dessas duas atualizações. Após autorização posterior, ambas foram aplicadas conforme registro abaixo.

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

Revisão final feita pelo próprio implementador, conforme proibição de subagentes. Não houve teste online nesta etapa inicial. Análise de tamanho de rotas não se aplica: não há objetivo de otimização de carregamento nesta alteração. Logs e imagens fictícias ficam em `tmp/identity-*`, ignorados pelo Git.

## Aplicação online autorizada — 27/10/2026

O usuário autorizou somente as duas migrações acima. O projeto `eclesias_bd_sp` foi confirmado como o destino configurado na aplicação. A simulação do CLI mostrou exatamente `20261027132246` e `20261027133937`; a aplicação terminou com sucesso, sem seeds, roles ou atualização de Vault. O histórico remoto confirmou ambas as versões.

As verificações de leitura confirmaram as duas colunas UUID, as chaves compostas com `church_id`, a restrição de identificação e a proteção do nome histórico. As tabelas mantêm RLS. A busca de congregações tem `search_path` vazio, não permite execução anônima e permite usuários autenticados com autorização interna; a função privada de comandos não pode ser chamada diretamente por esses papéis.

Na sessão autenticada do Chrome, foram conferidos:

- Nova entrada: **Recebido de**, tipos disponíveis, busca real de congregação e nome selecionado na prévia.
- Nova saída: **Pago a**, opção **Empresa, instituição ou outros** e campo **Nome ou identificação**.
- Importação: abertura na Catedral e listagem de importação existente em Canaã.
- Conferência: fila e formulários de uma entrada e uma saída, caixa bancário fixado, identificação correspondente à direção, opção **Congregação** e botão único **Salvar**.

As páginas responderam HTTP 200; a conferência abriu em aproximadamente três segundos no servidor de desenvolvimento. Não houve `UNAVAILABLE` nos registros conferidos nem erro no console da aba de importação. Os preenchimentos de teste foram descartados ao fechar as abas; nenhum lançamento, rascunho, upload ou exclusão foi gravado online. O diálogo de descarte teve limitação de controle pela ferramenta de navegador; a aba de teste foi fechada sem salvar.

Advisors sem erros: permanecem os 16 avisos de desempenho em políticas existentes. A nova busca aparece no [aviso de execução autenticada de funções SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), acesso intencional com verificação interna de permissão e igreja. Também há [informações de índices novos ainda sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) e o [aviso existente de proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Nenhuma alteração adicional foi aplicada.

Não houve mudança no código ou no SQL já testado, nem repetição dos testes de gravação no banco online. Os tipos gerados anteriormente correspondem às mesmas migrações. O servidor foi encerrado e a porta 3000 ficou livre. A branch foi mantida, sem push ou merge; a `main` permanece em `b83b43c5ad59176a814b4b2d92f0f062edbdfa35`.
