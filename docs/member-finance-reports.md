# Financeiro individual do membro

Na ficha do membro, a aba **Financeiro** consulta os lançamentos vinculados ao cadastro nas unidades financeiras autorizadas. O período pode ser delimitado por data inicial, final ou ambas. Sem datas, a consulta abrange todo o período.

A tela apresenta 20 lançamentos por página. Os totais consideram todas as páginas do período: entradas e saídas confirmadas, cancelados e não confirmados separadamente. Os cancelados não compõem entradas ou saídas confirmadas. As somas são feitas em centavos.

**PDF** e **Excel** exportam todos os lançamentos autorizados do período aplicado, com data, tipo, categoria, descrição, forma de pagamento, situação e valor. A exportação não depende da página atual. O cabeçalho usa o nome de exibição e a logo configurados do campo, os Presidentes, o nome/matrícula do membro e o período. O PDF mantém marca d'água, data, paginação e rodapé **Eklesias**. A planilha mantém valores monetários numéricos e textos literais, sem interpretar descrições como fórmulas.

## Acesso e integridade

- Consulta: `members.view_basic` e `finance.view`, com sessão autenticada e acesso ao membro.
- Exportação: também `members.view_full` e `members.export`.
- O servidor deriva a igreja do contexto autenticado e restringe o membro ao escopo selecionado: igreja, regional, congregação ou vínculo ativo de ministério. Ministério também exige `ministries.view`.
- Membros arquivados só podem ser consultados por quem tem `members.restore`. Lançamentos excluídos não são incluídos.
- Cada unidade financeira precisa permitir consulta. O cliente autenticado conserva a aplicação das políticas do banco.
- Limite de 10.000 lançamentos por período. Acima disso, o usuário deve reduzir o intervalo; a lista não é truncada. Contagens inconsistentes ou IDs duplicados interrompem a leitura.
- Observações pastorais, notas internas financeiras, CPF e RG não são consultados pelo relatório.
- `POST /api/members/finance/reports` valida origem, sessão, corpo limitado a 4 KiB, identificador, formato e datas. Campos desconhecidos, incluindo igreja fornecida pelo cliente, são rejeitados.
- Downloads usam `private, no-store` e `nosniff`. A auditoria `EXPORT_MEMBER_FINANCE` registra membro, formato, quantidade e presença de filtros; falha de auditoria impede a entrega.

A consulta antiga falhava porque `financial_categories(name)` correspondia a duas relações. O vínculo agora é explícito (`finance_tx_category`), com preferência pelo nome histórico da categoria armazenado no lançamento. Não há migração ou alteração do visual do módulo Financeiro.

## Verificação local

Com Supabase local, dependências e Chromium disponíveis:

```sh
node scripts/member-reports-local.mjs setup
node scripts/member-visual-local.mjs setup
node scripts/member-reports-local.mjs build
node scripts/member-reports-local.mjs start
```

Em outro terminal:

```sh
node scripts/member-reports-local.mjs e2e e2e/member-visual.spec.ts
node scripts/member-visual-local.mjs cleanup
node scripts/member-reports-local.mjs cleanup
```

A extensão cria somente dados fictícios no banco local: 25 lançamentos (24 confirmados e um cancelado), um membro inativo, um tipo de cadastro legado e eventos de histórico. Ela reproduz a ambiguidade da consulta antiga antes de criar os dados. Limpe a extensão financeira antes do restante dos cadastros e encerre o servidor ao terminar. Nenhum serviço real de e-mail ou cobrança é habilitado.
