# Financeiro individual do membro

Na ficha do membro, a aba **Financeiro** consulta os lançamentos vinculados ao cadastro nas unidades financeiras autorizadas. O período pode ser delimitado por data inicial, final ou ambas. Sem datas, a consulta abrange todo o período. O campo **Categoria**, junto às datas, começa em **Todas as categorias**; **Aplicar filtros** combina a categoria e o período na listagem, nos totais e nas exportações de todas as páginas.

As opções vêm do catálogo financeiro da igreja, com as permissões existentes, incluindo categorias inativas ainda disponíveis para consulta histórica. A seleção é validada no servidor pelo identificador; uma categoria indisponível ou de outra igreja não amplia a consulta. PDF e Excel identificam a categoria selecionada e usam os últimos filtros aplicados, mesmo que os campos tenham sido alterados sem aplicar. A seleção permanece disponível quando o resultado está vazio.

A tela apresenta 20 lançamentos por página e três indicadores com ícones: **Entradas**, **Saídas** e **Cancelados**. Entradas e saídas somam apenas os lançamentos confirmados; os cancelados são contabilizados separadamente. Os totais consideram todas as páginas do período, com somas em centavos. Os relatórios exportados também preservam o total de não confirmados.

Na listagem, as badges de tipo usam sucesso para entrada e danger para saída. A situação usa sucesso para confirmado, danger para cancelado, aviso para pendente e neutro para outros estados. Esses estilos ficam restritos à ficha do membro, preservando a identidade do módulo Financeiro.

**PDF** e **Excel** exportam todos os lançamentos autorizados do período aplicado, com data, tipo, categoria, descrição, forma de pagamento, situação e valor. A exportação não depende da página atual. O cabeçalho usa o nome de exibição e a logo configurados do campo, os Presidentes, o nome/matrícula do membro e o período. O PDF mantém marca d'água, data, paginação e rodapé **Eklesias**. A planilha mantém valores monetários numéricos e textos literais, sem interpretar descrições como fórmulas.

No PDF, o texto do cabeçalho fica centralizado verticalmente. A quantidade de lançamentos aparece em destaque à esquerda e os totais à direita, com rótulos curtos e valores em seminegrito; totais extensos quebram em linhas sem sobreposição. O período só aparece quando delimitado por datas. Valores da tabela também usam seminegrito, e saídas têm tipo e valor na cor danger.

## Extrato térmico do contribuinte

O botão **Imprimir extrato**, ao lado de PDF e Excel, abre uma prévia com seleção de papel **80 mm** ou **58 mm**. O extrato inclui somente **entradas confirmadas**, de todas as páginas, respeitando os últimos filtros de data e categoria aplicados. Saídas, cancelados e lançamentos não confirmados não entram na listagem nem no total.

O cabeçalho segue o comprovante térmico financeiro: logo, nome configurado do campo e congregação atual, identificada como **Congregação do membro**. O nome do contribuinte aparece uma vez, seguido do período e da categoria selecionada. Cada lançamento apresenta data curta e valor, com a categoria abaixo. Ao final, aparecem quantidade, total, **Eklesias** e data de emissão. O extrato não inclui descrições, forma de pagamento ou notas internas.

A prévia usa a área imprimível já adotada no módulo Financeiro: 74 mm para bobina de 80 mm e 47 mm para bobina de 58 mm. No diálogo de impressão, selecione a impressora, configure a mesma largura de papel, escala de 100% e desative cabeçalhos/rodapés do navegador. O comprimento e o corte do papel dependem do driver. Não é necessário instalar um serviço de impressão adicional.

Ao clicar em **Imprimir**, o servidor consulta novamente os dados e verifica as permissões antes de abrir o diálogo do navegador. Falhas mantêm a prévia e permitem nova tentativa, sem disparar a impressão. A auditoria registra a preparação e a solicitação; não confirma que houve impressão física.

## Acesso e integridade

- Consulta: `members.view_basic` e `finance.view`, com sessão autenticada e acesso ao membro.
- Exportação: também `members.view_full` e `members.export`.
- O servidor deriva a igreja do contexto autenticado e restringe o membro ao escopo selecionado: igreja, regional, congregação ou vínculo ativo de ministério. Ministério também exige `ministries.view`.
- Membros arquivados só podem ser consultados por quem tem `members.restore`. Lançamentos excluídos não são incluídos.
- Cada unidade financeira precisa permitir consulta. O cliente autenticado conserva a aplicação das políticas do banco.
- Limite de 10.000 lançamentos por período. Acima disso, o usuário deve reduzir o intervalo; a lista não é truncada. Contagens inconsistentes ou IDs duplicados interrompem a leitura.
- Observações pastorais, notas internas financeiras, CPF e RG não são consultados pelo relatório.
- `POST /api/members/finance/reports` valida origem, sessão, corpo limitado a 4 KiB, identificador, formato e datas. Campos desconhecidos, incluindo igreja fornecida pelo cliente, são rejeitados.
- `POST /api/members/finance/statement` aplica as mesmas permissões de exportação e validações de origem, sessão, tamanho e filtros. Aceita apenas as larguras 80/58 e as intenções de prévia/impressão. O HTML tem campos escapados, imagens locais embutidas e scripts bloqueados; a prévia usa um iframe isolado.
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
node scripts/member-reports-local.mjs e2e e2e/member-visual.spec.ts e2e/member-thermal-statement.spec.ts
node scripts/member-visual-local.mjs cleanup
node scripts/member-reports-local.mjs cleanup
```

A extensão cria somente dados fictícios no banco local: 25 lançamentos para a verificação financeira existente (24 confirmados e um cancelado), mais 27 para o extrato térmico de outro membro (24 entradas confirmadas, uma saída confirmada, uma entrada cancelada e uma entrada em rascunho), um membro inativo, um tipo de cadastro legado e eventos de histórico. Ela reproduz a ambiguidade da consulta antiga antes de criar os dados. Limpe a extensão financeira antes do restante dos cadastros e encerre o servidor ao terminar. Nenhum serviço real de e-mail ou cobrança é habilitado.

Os testes de navegador conferem as duas larguras, textos longos, todas as páginas, filtros aplicados, revalidação ao imprimir, recuperação após falha, resultado vazio e restrições de acesso. A chamada de impressão é simulada no teste; a saída em uma impressora física precisa ser conferida com o equipamento e o driver utilizados.
