# Relatório por categoria — implementação e validação

Implementado diretamente, sem subagentes, na branch `codex/finance-ranking-deliveries`, a partir de `ba0c375`. Nenhuma integração ou publicação na main.

## Escopo aprovado

- Novo modelo na aba Relatórios, disponível a quem tem consulta financeira, incluindo tesoureiros, com as mesmas verificações de igreja e congregação dos modelos mensais.
- Datas livres inclusivas, atalhos do mês/ano atual, Entrada/Saída, seleção múltipla com busca e categorias inativas identificadas. Categorias de uso misto podem ser usadas nos dois tipos. Limpeza da seleção ao mudar a movimentação.
- Resumido por categoria e detalhado por lançamento, ambos com totais; caixa opcional. PDF com identidade existente, faixa verde clara e saídas em vermelho discreto. Sem indicadores de saldo.

## Integridade e banco

Nova função `get_finance_category_report`, em `20261023004947_finance_category_report.sql`, consulta os lançamentos confirmados e confere os valores contra o livro financeiro na mesma fotografia transacional. Usa `STABLE SECURITY INVOKER`, `search_path` vazio, RLS e verificação explícita `can_access_finance_unit(..., finance.view)`. Categorias, caixas e registros são filtrados pela igreja e unidade apropriadas. Anônimo não tem execução. Não altera dados financeiros, saldos, demonstrativos ou histórico.

Intervalos entre 2000 e 2099, até 50 categorias distintas, até 10.000 linhas no detalhado; nenhuma paginação silenciosa. O resumido agrega todo o intervalo e não retorna dados pessoais dos lançamentos. O serviço confere filtros, categorias, contagens e somas em centavos antes de gerar o PDF.

Migração validada localmente e aplicada ao Supabase online sob a autorização já dada no chat, sem seeds ou dados fictícios. Tipos regenerados a partir do banco online. Catálogos, permissões e índices existentes reutilizados.

## Evidências

- Lint sem avisos e TypeScript aprovados. Suíte completa: 567 testes Vitest em 108 arquivos. Build de produção aprovado com ambiente local.

- Testes de contrato, períodos inválidos, datas bissextas, seleção repetida, falta de permissão, filtros divergentes, somas e detalhes inconsistentes.
- SQL local transacional com rollback: tesoureiro autorizado, período anual inclusivo e dia único, múltiplas categorias, tipo misto, categoria inativa, entradas, caixa específico, vazio, cancelamentos/transferências excluídos, outra igreja/unidade/categoria/caixa negados e bloqueio explícito de permissão.
- PDF: totais, apresentações, vazio, paginação com 100 lançamentos e datas inteiras. PDFs renderizados e inspecionados visualmente. PDFs reais do navegador conferidos: R$ 18.000,00 nos dois modelos para a mesma fixture.
- Navegador Chromium: dois cenários novos passaram, incluindo emissão como administrador e tesoureiro, seleção múltipla, troca de movimentação, invalidação do PDF anterior, datas inválidas e largura mobile de 375 px. Os 13 cenários anteriores de relatórios também passaram.
- O primeiro teste de navegador usou um seletor de rótulo que não correspondia ao nome do campo de seleção; corrigido para selecionar pelo papel/nome acessível e repetido com sucesso. A inspeção visual detectou quebra de data no PDF detalhado; largura corrigida e regressão automatizada adicionada.
- Advisors locais: 16 avisos preexistentes, nenhum envolvendo a função nova. Comparação dos advisors online antes/depois: nenhum novo aviso ou erro. Metadados online confirmaram execução negada a anônimo, função invoker estável e search_path vazio.

Não foram repetidos impressão física, Safari/Firefox ou testes de navegador de outros módulos. Nenhuma mensagem, cobrança ou documento de teste foi enviado a serviços externos. Servidor temporário na porta 3217 encerrado ao finalizar.

## Teste manual

1. Inicie a aplicação nesta branch e abra **Financeiro → Relatórios → Por categoria**.
2. Escolha a congregação no topo, um intervalo, Saída e uma categoria de despesa; gere o resumido.
3. Selecione outras categorias e confira total geral e subtotais no detalhado.
4. Alterne para Entrada, escolha novas categorias e confira as duas apresentações.
5. Teste um caixa específico e um período sem movimentos; entre como tesoureiro para verificar a restrição à sua congregação.
