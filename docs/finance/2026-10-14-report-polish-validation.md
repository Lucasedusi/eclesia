# Validação — indicadores, dados bancários e descrição coletiva

## Entrega aprovada

- Analítico: mais 20 pt de espaço após os indicadores iniciais; os mesmos quatro valores consolidados são repetidos no resumo final, fora dos blocos por caixa.
- Banco, agência e conta aparecem abaixo do nome da conta, em 7 pt e cor discreta, incluindo cabeçalhos de continuação. Dados vazios são omitidos. Caixas locais não exibem dados bancários.
- Descrição coletiva opcional junto da identificação em Nova entrada, correção e Atendimento, reutilizando o mesmo estado/campo persistido. Sem duplicação nos detalhes adicionais. Itens adicionais de atendimento têm descrição independente.
- Sintético preservado, incluindo sua projeção SQL e o conteúdo gráfico das páginas.

## Validações

- 444 testes em 85 arquivos passaram; lint sem avisos, TypeScript e build de produção passaram.
- 10 cenários Chromium passaram na versão compilada local: contribuições coletivas nos dois formulários, persistência e limpeza da descrição, alternância de identificação, múltiplas contribuições, lançamentos/cancelamento, comprovantes e relatórios, loading e permissões do tesoureiro.
- Os testes novos falharam na versão anterior pela ausência dos indicadores finais, dos dados bancários e da descrição junto à identificação. Passaram após a implementação.
- Na primeira execução paralela, um seletor antigo de radio encontrou também uma cópia oculta durante streaming. Foi substituído por seleção pelo papel acessível, que considera o controle visível. Os dez cenários passaram depois desse ajuste no teste.
- Extração dos PDFs gerados pelos cenários de contribuição coletiva confirmou as descrições gravadas e o resumo final. PNGs de resumo, contas bancárias/continuação e formulários revisados.
- SHA-256 dos streams gráficos descomprimidos do sintético permaneceu `5cd4239cab72e1c5d9f3d61053a496c0cedf09ba975d74257276c6815503c78b`.
- SQL local com rollback passou: dados bancários por caixa, ausência em caixa local, sintético sem alteração de projeção, conciliação, limite de linhas, tenant/escopo e ausência de execução anônima. Consulta de 9.995 lançamentos em aproximadamente 5,78 segundos (limite do teste: 8 segundos).

## Banco online

Migração `20261014165736_finance_report_bank_details.sql` aplicada localmente e online com autorização. Acrescenta metadados bancários ao JSON analítico da função de leitura existente, usando o catálogo já limitado à igreja/congregação. Nenhum valor financeiro foi alterado; nenhuma fixture foi aplicada online.

SECURITY INVOKER, search_path vazio, grants e escopo preservados e verificados após aplicação. Tipos regenerados a partir do banco vinculado, idênticos ao arquivo versionado porque a assinatura da RPC continua retornando JSON. Advisors Security/Performance comparados por achado: nenhum novo achado; os alertas preexistentes permanecem. [Referência de interpretação](https://supabase.com/docs/guides/database/database-linter).

## Limites

Revisão e execução diretas, sem subagentes. Impressora física e Safari/Firefox não testados: não estavam configurados no ambiente de validação. Nenhum envio de relatório ou implantação do aplicativo realizado. A atualização online do banco é independente da publicação do código.
