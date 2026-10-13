# Ajustes do analítico e abertura de relatórios — 13/10/2026

## Entrega

- Analítico: logo e identificação centralizadas verticalmente; fontes das tabelas em 8,5 pontos; ENTRADAS/SAÍDAS e seus totais em faixas; categorias e pagamentos em negrito; dízimos agrupados pela classificação histórica, com subtotais à direita; maior separação entre blocos.
- Cabeçalhos monetários alinhados aos valores, incluindo departamentos e caixas. Cabeçalhos repetidos nas continuações e espaço reservado para os subtotais.
- Removidos do analítico o texto de todos os caixas, resultado do mês, efeitos gerais no saldo e tabela de outros movimentos. Mantida a identificação de um caixa filtrado e as observações específicas necessárias para explicar os saldos.
- Geração abre uma aba durante o clique e a direciona ao PDF concluído. Falha/cancelamento fecham a aba de espera. Popup bloqueado oferece Abrir PDF e Baixar PDF. Sem prévia incorporada no sistema.
- Sintético preservado; alteração compartilhada somente no fluxo de abertura.
- Sem alterações de banco, cálculos, permissões ou contratos de consulta. Execução e revisão diretas, sem subagentes.

## Verificações

- Baseline: 436 testes passaram. Final: **439 testes em 85 arquivos passaram**.
- Lint sem avisos, TypeScript e compilação de produção passaram.
- **6 testes de navegador passaram**: nova aba para cada modelo; bytes do download iguais aos do PDF gerado; ausência de iframe; popup bloqueado; erro e nova tentativa disponível; descarte de geração cancelada e layout mobile; acesso do tesoureiro à própria congregação e 403 para outra unidade.
- Os testes usam Chromium completo (`npx playwright install chromium --no-shell`), pois o headless shell baixa PDFs e não contém o visualizador usado pelo usuário. A comparação diagnosticou `ERR_ABORTED` seguido de download no shell; o Chromium completo abriu o Blob na nova aba.
- PDFs testados com 0, 1, 49, 1.000 e 9.995 lançamentos, além de fixture com várias classificações/categorias, ofertas, despesas, logo e classificação ausente. Extração de texto confirmou todas as 1.000 referências de documentos no caso de volume intermediário.
- Inspeção visual de cabeçalho, tabelas, faixas, subtotais, continuação, resumos e impressão em tons de cinza.
- Comparação dos comandos gráficos descomprimidos do PDF sintético de referência antes/depois: SHA-256 idêntico `5cd4239cab72e1c5d9f3d61053a496c0cedf09ba975d74257276c6815503c78b`.

## Limites

Testes de navegador executados no ambiente local, com dados fictícios. Impressora física, Safari e Firefox não foram testados. Nenhuma publicação no GitHub ou implantação remota foi realizada nesta entrega.
