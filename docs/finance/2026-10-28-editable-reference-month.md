# Mês de referência informativo

Implementação na branch `codex/finance-bank-statement-import`, sem publicação na main e sem execução no banco online.

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

**A migração foi aplicada somente no banco local. É necessária autorização específica antes de aplicá-la online. Aplicar a migração antes de usar o novo campo contra o banco online: a função antiga ainda deriva a referência da data.**

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
- Revisão própria do diff, sem subagentes. Nenhuma alteração em migrações anteriores, dados reais, banco online ou main.

Testes usam exclusivamente dados fictícios no Supabase local. A execução inicial do teste de importação precisou expandir o arquivo de fixture referenciado antes de enviar o SQL ao contêiner; após esse ajuste no comando de teste, passou. Os testes de alinhamento reproduziram a diferença de 23,5px antes da correção e passaram depois. Não restam falhas nos checks exigidos para esta alteração.
