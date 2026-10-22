# Informativo por congregação

Implementado na branch `codex/finance-informative-report`, a partir de `fd63ae6`, para teste local. Execução e revisão diretas, sem subagentes. A publicação na `main` depende de autorização posterior.

## Escopo aprovado

Novo modelo na aba Relatórios, exclusivo para administradores, com congregação herdada do cabeçalho, meses inicial/final inclusivos, prebenda bruta e repasse opcionais, e saldo final. PDF com identidade visual dos modelos existentes, abertura em nova aba e download. O resumo usa os saldos das extremidades e soma entradas/saídas, sem somar saldos mensais.

Prebenda bruta vem do demonstrativo após aplicar o teto, antes dos descontos. Repasse inclui somente a distribuição percentual sobre a base elegível destinada à catedral; taxas fixas e descontos da prebenda não entram. A última versão de cada mês é consultada, com ausência e desatualização explícitas. A geração não altera dados financeiros.

## Implementação e banco

A consulta `get_finance_informative_report` reutiliza `get_finance_report` e `get_finance_statement`. É `STABLE`, `SECURITY INVOKER`, tem `search_path` vazio, bloqueia acesso anônimo e verifica administrador ativo e permissão/escopo financeiros. Retorna somente resumos mensais e os valores opcionais solicitados. O período inteiro usa o mesmo retrato de leitura do banco. Limite de 60 meses por emissão.

A migração aditiva `20261022002235_finance_informative_report.sql` foi validada localmente e aplicada ao projeto online autorizado `dhgrfvakdbtedqfgecys`. Nenhuma migração anterior foi editada. Nenhum seed ou dado fictício foi enviado ao projeto online. Tipos TypeScript regenerados do projeto online; diferença limitada à nova função.

## Validação

- 523 testes unitários em 101 arquivos, incluindo intervalos, autorização, conciliação, saldos consecutivos, campos opcionais, estado dos demonstrativos e PDF paginado.
- Lint sem avisos, TypeScript e build de produção com Supabase local aprovados.
- Nove cenários de navegador dos relatórios atuais e do informativo: opções independentes, período inválido, nova aba, PDF/download, mobile, usuários sem acesso, bloqueio de popup, falhas de geração e invalidação de resultados.
- Teste SQL específico com dados fictícios e rollback: bruto limitado, percentual sobre base elegível, exclusão de taxas/descontos, versão mais recente, ausência, desatualização, período, ausência de escrita e bloqueio entre perfis/igrejas/unidades.
- Regressão SQL dos relatórios existentes aprovada, incluindo transferências, correções/cancelamentos, histórico e mais de 1.000 linhas.
- PDFs renderizados e inspecionados, incluindo as colunas opcionais e continuação de um período de 60 meses; telas desktop/mobile conferidas.
- Advisors locais: 16 avisos preexistentes de desempenho, nenhum relacionado à nova consulta. Advisors online comparados antes/depois: nenhum achado novo e nenhum erro.

O teste antigo de congregação única foi ajustado para selecionar o elemento visível entre as versões desktop/mobile do cabeçalho. Não houve mudança de comportamento de acesso.

Não foi repetida a suíte de navegador de outros módulos, nem foi feita impressão física nesta etapa; as alterações afetam relatórios A4, não comprovantes térmicos.

## Teste manual

Na branch acima, inicie `npm run dev` e entre com um administrador. Em **Financeiro → Relatórios → Informativo por congregação**, escolha os meses e as colunas. Confira um mês com demonstrativo, outro sem demonstrativo e uma versão desatualizada, se disponíveis. Compare o bruto e o repasse com a respectiva versão do demonstrativo, e os saldos com o relatório sintético do mês.
