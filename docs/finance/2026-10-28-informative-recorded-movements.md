# Informativos baseados nos lançamentos

Implementado em `codex/finance-bank-statement-import`, diretamente e sem subagentes. Nenhuma publicação na main ou alteração no banco online.

## Regra dos dois relatórios

- **Repasse:** entradas confirmadas na Catedral, na categoria marcada como Repasse, atribuídas pelo vínculo com a congregação pagadora. Usa a data financeira do recebimento. Uma saída de R$ 1.000 na congregação e um recebimento de R$ 700 na Catedral resultam em R$ 700 no informativo.
- **Prebenda bruta:** saídas confirmadas da própria congregação nas categorias marcadas como Prebenda. Uma saída de R$ 4.000 permanece R$ 4.000, sem deduzir o dízimo do pastor. Se o lançamento registrar somente o líquido, o sistema não inventa nem recompõe o bruto.
- As colunas informativas não alteram novamente o saldo. Demonstrativos não alimentam essas colunas. Relatórios sintético e analítico preservam suas regras.
- Sem movimento válido no período: zero. Sem configuração da categoria selecionada: mensagem para configurar, sem produzir um zero enganoso.
- No geral, recebimentos sem congregação identificada e recebimentos de congregações fora da seleção aparecem separados. O total atribuído nas linhas mais esses dois grupos deve coincidir com os repasses recebidos pela Catedral. A linha da Catedral não duplica repasses.
- Recebimentos cancelados ou excluídos não entram; rascunhos de formulário e pendências de importação não são lançamentos confirmados.

## Configuração após autorização da atualização online

1. Aplicar somente `20261028142727_finance_informative_recorded_movements.sql` após autorização específica.
2. Em **Financeiro → Configurações → Categorias**, editar cada categoria correspondente e selecionar **Uso nos informativos**:
   - **Repasse recebido pela Catedral**, em categoria de entrada ou entrada e saída;
   - **Prebenda bruta paga pela congregação**, em categoria de saída ou entrada e saída.
3. Nos recebimentos da Catedral, usar a identificação **Congregação** para atribuir cada valor à pagadora. Nomes digitados livremente não são convertidos em vínculos automaticamente.
4. Gerar os dois informativos e conferir as colunas e os valores sem identificação.

O vínculo é com o ID da categoria, não com seu nome. Renomear ou inativar preserva o histórico. Alterar explicitamente o uso da categoria reclassifica também seus lançamentos anteriores nas novas emissões dos informativos; a tela informa esse efeito e a alteração fica auditada. A migração deixa as categorias com uso “Nenhum”, sem inferências automáticas pelo nome.

## Validação local

- Lint sem avisos, TypeScript e 607 testes Vitest em 113 arquivos aprovados.
- Build de produção aprovado com o harness `scripts/finance-local.mjs`, que força conexão ao Supabase local e integrações de teste.
- Navegador: 10 testes Playwright aprovados com uma igreja fictícia local nova, incluindo os dois PDFs, quatro combinações de colunas, acesso por perfil e persistência da classificação após renomear a categoria. O teste de informativo agora dispensa a geração prévia de demonstrativo.
- SQL: informativo, administrativo, catálogos, sintético/analítico, importação e identificação aprovados. Dados fictícios revertidos ao final de cada suíte.
- Casos cobertos: recebimento parcial, data do recebimento, bruto da prebenda, mês vazio, ausência de configuração, categorias renomeadas/inativas, recebimento cancelado, vínculo ausente, congregação inativa, não duplicação na Catedral, geração de demonstrativo sem efeito no resultado, saldos preservados, outro tenant e perfis não autorizados.
- Tipos de banco regenerados pelo CLI a partir do banco local; nenhuma edição manual da estrutura gerada.
- Advisors locais: segurança sem achados; desempenho com 16 avisos existentes, nenhum relativo aos objetos alterados.
- A análise global SQL encontrou dois problemas preexistentes fora deste escopo: `public.claim_stale_administrative_document_cleanups` (referência ambígua a `storage_path`) e `private.count_congregation_dependencies` (lista de tabelas tratada como nome de relação). Nenhum erro nas rotinas novas/alteradas. Essas rotinas antigas não foram modificadas.
- Revisão própria de autorização, RLS, filtros por igreja, exclusão lógica, auditoria e conciliação dos valores. Nenhuma nova função privilegiada: os auxiliares e relatórios usam SECURITY INVOKER; o comando de catálogo mantém as verificações e privilégios anteriores.
- PDFs verificados visualmente, incluindo colunas opcionais e paginação; evidências fictícias em `tmp/reports/` (ignoradas pelo Git).

Servidor web de teste encerrado; portas 3000 e 3217 livres ao final.

A atualização online permanece pendente de autorização. Não foram criados lançamentos reais nem inferidos vínculos de registros antigos.
