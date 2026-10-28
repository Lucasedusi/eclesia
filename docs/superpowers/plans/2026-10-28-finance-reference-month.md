# Referência informativa dos lançamentos

**Goal:** permitir referência mensal diferente da data da movimentação sem mudar o caixa nem os dois informativos.

**Spec:** aprovação nesta conversa: recebimento em novembro, referente a outubro, continua em novembro nos dois informativos. Aplicar a entradas, saídas, atendimento e importação; corrigir loading de congregações e quebra de nomes nos detalhes.

**Architecture:** referência `YYYY-MM` independente no formulário/contrato; persistir nas colunas existentes `reference_year` e `reference_month` pelo escritor financeiro auditado. Não alterar consultas de saldo, filtros por data ou relatórios. Migração nova, somente local.

## Global Constraints

- Branch atual `codex/finance-bank-statement-import`; execução direta sem subagentes, sem main ou banco online.
- Preencher pela data até edição manual; preservar escolha explícita após mudança de data. Novo lançamento começa com a referência da sua data.
- Correção carrega a referência persistida; requisições antigas sem referência preservam a existente na correção e usam a data na inclusão.
- Rascunhos antigos continuam legíveis, rascunhos novos preservam referência e escolha manual.
- Referência é informativa por lançamento, inclusive em correção de item de atendimento; não altera os dados compartilhados do pagamento.
- Comprovantes continuam exibindo a data financeira; não há mudança do layout ou snapshots históricos.

## Review Focus

- Referência inválida por RPC direta precisa ser rejeitada sem gravar movimentos.
- Correção não pode apagar referência já salva; histórico deve mostrar valores anteriores/novos.
- Lançamentos em novembro referentes a outubro continuam em novembro no razão e nos dois informativos.
- Rascunho criado antes da mudança não pode ser perdido.
- Nomes extensos precisam quebrar sem colar no subtítulo ou transbordar no celular.

### Task 1: Estado e contratos

Files: `src/modules/finance/utils/finance-entry-session.ts`, validação de comandos e rascunhos, testes correspondentes.

- [x] Adicionar testes para preenchimento automático, preservação manual, reset do próximo lançamento, meses inválidos e rascunho legado.
- [x] Rodar testes focados e observar falha; implementar `referenceMonth`, `referenceMonthManual` e `updateEntryState`.
- [x] Reexecutar testes focados: todos passam.

### Task 2: Persistência e interface

Files: nova migração `finance_editable_reference_month`, `supabase/tests/finance_reference_month.sql`, formulário, consulta/detalhes, seletor de congregação e filtro de período.

- [x] Teste SQL com recebimento de repasse e prebenda em novembro, referência outubro: assertir referência persistida, razão em novembro e ambas projeções em novembro; correções, RPC inválida, autorização, atendimento e importação.
- [x] Observar falha no banco local anterior; substituir apenas o escritor auditado em nova migração; aplicar somente local e regenerar tipos.
- [x] Campo mensal editável e ajuda; referência na prévia/detalhes, leitura preservada em correção; spinner e blocos separados para identificação.
- [x] Testes SQL relevantes passam; nenhuma alteração de regras financeiras.

### Task 3: Verificação e entrega

Files: `e2e/finance-reference-month.spec.ts`, documentação de entrega.

- [x] Verificar no navegador local entrada, saída/correção, atendimento e importação com rascunho; spinner; detalhes em tela estreita; filtro renomeado.
- [x] Rodar lint sem avisos, typecheck, Vitest completo, build local, Playwright dos fluxos afetados e advisors locais.
- [x] Revisão própria (subagentes proibidos pelo usuário), diff sem dados pessoais/segredos, commits na branch atual; registrar limites e migração pendente online.
- [x] Encerrar servidor e confirmar portas livres.
