# Mês de referência informativo

Implementação na branch `codex/finance-bank-statement-import`, sem publicação na main. Migração aplicada no banco online em 28/10/2026 após autorização específica do usuário.

## Comportamento

- Data da movimentação continua determinando caixa, saldos, filtros, demonstrativos e os dois informativos.
- Recebimento em 05/11/2026, referente a 10/2026, permanece em novembro no Informativo por Congregação e no Informativo Geral por Congregação.
- Mês de referência começa com o mês da data. Uma escolha manual não é sobrescrita ao mudar a data; salvar e continuar inicia a próxima referência pela data do novo lançamento.
- Entradas, saídas, atendimento e importação compartilham o campo. Na importação a data do banco continua bloqueada, mas a referência é editável.
- Correções carregam a referência persistida; a alteração fica no histórico auditado. Em atendimento, a referência é informativa por item, sem alterar o pagamento compartilhado.
- Rascunhos antigos continuam legíveis. Novos rascunhos preservam o mês e a escolha manual.
- Detalhes e prévia exibem data e referência separadas. O comprovante mantém a data financeira e seus snapshots históricos permanecem intactos.
- Busca de congregação exibe o mesmo indicador animado da busca de pessoas.
- Nos detalhes, nome completo e tipo da identificação ocupam blocos separados com espaçamento e quebra de texto.
- O seletor mensal dos lançamentos no celular chama-se “Mês da movimentação”.

## Atualização do banco

Migração: `supabase/migrations/20261028192325_finance_editable_reference_month.sql`.

Apenas substitui o escritor privado auditado para preencher as colunas já existentes `reference_month` e `reference_year`. Valida a referência em chamadas diretas; preserva a referência em correções de clientes antigos que omitem o campo; novos comandos antigos continuam usando o mês da data. Mantém razão financeiro, permissões, RLS, auditoria e isolamento por igreja/congregação.

Sem atualização em massa nem modificação de lançamentos históricos. Tipos regenerados localmente, sem alteração estrutural.

**Migração aplicada localmente e, após autorização, no banco online. A versão `20261028192325` consta no histórico remoto. Não há migração pendente para este ajuste.**

## Validação

- `npm run lint -- --max-warnings=0`: passou, sem avisos.
- `npm run typecheck`: passou.
- `npm test`: 618 testes em 113 arquivos passaram.
- Build com `node scripts/finance-local.mjs build`: passou.
- Playwright local: 11 cenários passaram (referência, identificação, lançamentos e informativos), incluindo alinhamento dos campos e nomes extensos em 390px.
- SQL: `finance_reference_month`, `finance_commands_verification`, `finance_identification`, `finance_bank_import_verification`, `finance_informative_report` e `finance_reports` passaram com rollback.
- Teste de carga com 9.995 registros: primeira tentativa excedeu o limite de 8s (8,199s) durante atividade concorrente; repetição isolada passou em 7,987s. Nenhuma consulta de relatórios foi alterada.
- Advisors locais: zero avisos de segurança e os mesmos 16 avisos de desempenho preexistentes (11 de inicialização RLS e 5 de políticas permissivas múltiplas).
- Tipos regenerados a partir do banco local; sem mudança estrutural.
- Revisão própria do diff, sem subagentes. Na etapa de implementação local, nenhuma alteração em migrações anteriores, dados reais, banco online ou main.

Testes usam exclusivamente dados fictícios no Supabase local. A execução inicial do teste de importação precisou expandir o arquivo de fixture referenciado antes de enviar o SQL ao contêiner; após esse ajuste no comando de teste, passou. Os testes de alinhamento reproduziram a diferença de 23,5px antes da correção e passaram depois. Não restam falhas nos checks exigidos para esta alteração.


## Conferência online — 28/10/2026

- Autorização: aplicar somente a migração deste ajuste, na branch atual, sem subagentes e sem publicação na main.
- Simulação listou apenas `20261028192325_finance_editable_reference_month.sql`. Aplicação pelo CLI preservou o número da versão; sem seeds, roles ou mudanças de Vault.
- Consulta posterior confirmou a versão aplicada. A definição da função online é idêntica à validada localmente (hash `74b5971dd6805e5a2151dd73aa58697c`).
- Rotina privada continua sem execução direta para `anon` e `authenticated`, com `search_path` vazio; razão financeiro continua usando a data da movimentação. RLS da tabela permanece habilitada.
- Navegador autenticado, aplicação da branch ligada ao banco online: página de lançamentos abriu com HTTP 200, sem `UNAVAILABLE`.
- Nova entrada: data 05/11/2026 preencheu referência 11/2026; ao escolher 10/2026 e mudar a data para 06/11/2026, a referência permaneceu 10/2026. Prévia confirmou os dois campos separados.
- Nova saída: mês de referência presente, editável e preenchido pela data, com a orientação sobre o período do caixa.
- Valores temporários descartados. Nenhum lançamento financeiro de teste foi salvo online; persistência e cenários completos foram validados no banco local com a mesma definição aplicada online.
- Advisors antes/depois: nenhum aviso novo. Permanecem 62 avisos de [funções definer acessíveis por usuários autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), 1 de [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), 11 de [inicialização RLS](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) e 5 de [políticas permissivas múltiplas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).
- Servidor encerrado após a conferência; portas 3000 e 3217 livres. Aba de conferência fechada.
