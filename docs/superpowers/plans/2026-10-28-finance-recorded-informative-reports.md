# Informativos por lançamentos efetivos

Implementação direta autorizada pelo usuário, na branch atual, sem subagentes e sem alterações online.

## Regras aprovadas
- Repasse: entradas confirmadas na Catedral, em categorias explicitamente marcadas como Repasse, atribuídas à congregação identificada no lançamento. A data é a data financeira do recebimento.
- Prebenda bruta: soma das saídas confirmadas da própria congregação nas categorias marcadas como Prebenda. Não deduzir nem recompor dízimo.
- Os valores informativos não alteram saldos; demonstrativos permanecem consultivos e não alimentam essas colunas.
- Categorias sem configuração geram orientação explícita; configuração existente sem movimentos resulta em zero. Não inferir categorias pelo nome. Categorias inativas preservam histórico.
- No geral, repasses sem congregação identificada e de congregações fora da seleção são apresentados separadamente, conciliados com o total recebido pela Catedral; nunca duplicar na linha da Catedral.
- Sem controle de baixas ou lançamentos automáticos.

## Execução e verificação
1. Cobertura de validação de categorias e contratos de dados reais; observar falhas antes da implementação.
2. Nova migração imutável: classificação explícita da categoria, auditoria e projeções de relatórios autenticadas com isolamento por igreja. Aplicar apenas localmente e regenerar tipos.
3. Ajustar formulário de categorias, serviços e PDFs dos dois informativos; manter sintético, analítico e demonstrativo.
4. Testar SQL: recebimento parcial, mês do recebimento, bruto, rascunho/cancelado/excluído, outra igreja, vínculo ausente, unidade inativa, categoria renomeada/inativa, configuração ausente, autorização e saldos inalterados.
5. Executar testes unitários, lint, tipos, build local, E2E e revisão visual dos PDFs. Revisão própria, sem subagentes.
6. Documentar resultado e atualização online pendente; encerrar servidor web.
