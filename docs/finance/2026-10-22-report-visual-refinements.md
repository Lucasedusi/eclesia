# Refinamentos visuais dos relatórios — 22/10/2026

Implementação aprovada na branch `codex/finance-ranking-deliveries`, sem publicação na `main`.

## Alterações

- Informativo geral e acompanhamento de entregas consultam somente congregações ativas; removido o controle de inclusão de inativas.
- Relatório por categoria mantém os campos de datas, sem atalhos Este mês/Este ano.
- Entrega de relatórios passa a ser a última opção junto aos demais relatórios, com navegação direta e sem quadro separado.
- Situação e prazo das entregas usam badges, com vermelho discreto para atraso. A coluna de ações termina alinhada à borda direita de Gerar PDF.
- Listas vazias mostram ícone e mensagens específicas para busca, entregues, pendentes ou ausência de congregações ativas.
- Até 760 px, somente Sintético e Analítico são apresentados. Um acesso direto às entregas mostra orientação para usar o computador e retorno aos relatórios. A mudança entre desktop e mobile reinicia a seleção e cancela PDFs pendentes.
- Departamentos, Categorias, Classificações e Formas de pagamento compartilham larguras de colunas no desktop. Editar começa no mesmo alinhamento horizontal de Novo cadastro, cujo texto fica em uma linha.

Permissões, isolamento, auditoria, cálculos financeiros e layouts dos PDFs foram preservados. Sem alterações de banco ou operações no Supabase remoto nesta etapa.

## Validação

- Lint sem avisos e TypeScript aprovados.
- 567 testes Vitest aprovados, em 108 arquivos.
- Compilação de produção aprovada com o ambiente Supabase local.
- 21 cenários Playwright autenticados aprovados em Chromium: relatórios, PDFs, permissões de administrador/tesoureiro, entregas, alinhamentos dos quatro catálogos e telas mobile de 320, 375 e 390 px.
- Três novos testes visuais falharam antes da implementação e passaram após os ajustes. Os seletores foram limitados à interface visível para não capturarem cópias ocultas da navegação do Next.js.
- Capturas locais revisadas para menu de relatórios, badges, estado vazio, configurações e relatórios mobile.
- Não realizada validação em Safari/Firefox ou aparelhos físicos: esta rodada usou o navegador Chromium automatizado local. Nenhuma impressão física foi necessária, pois os layouts dos PDFs não mudaram.
- Verificações SQL e Advisors não repetidas, pois não houve alteração em banco, consultas ou políticas de acesso.

Os arquivos de sessão, dados fictícios e capturas do ambiente de teste ficam fora do controle de versão.
