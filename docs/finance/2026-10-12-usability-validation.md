# Validação dos ajustes financeiros — 12/10/2026

## Entrega

- Sidebar recolhível com preferência persistida; menu móvel abre/fecha.
- Títulos sem categorias acima deles.
- Seleções de filtro automáticas, classificação histórica do dízimo, limpar preservando unidade/mês, paginação reiniciada, spinner estável no campo de busca.
- Linhas de entrada/saída com cores suaves; cancelamentos continuam distintos; transferências recolhidas.
- Comprovantes apresentados como ações, preservando identificação de cancelados/substituídos.
- Atendimento com ícones nas ações e comprovante como botão secundário.
- Busca de contribuinte ignora acentos e caixa, mantém caracteres de busca literais e limites de acesso.
- Caixas e contas com estrutura uniforme, dados bancários compactos e ações alinhadas; abertura permanece no cadastro.
- Teto mantém regra bruta antes do dízimo; justificativa é identificada e exigida quando a vigência afeta período passado ou já demonstrado. Dados digitados são preservados em falhas.
- Demonstrativo com identificação compacta, cartões com ícones, histórico em painel lateral e remoção visual dos totais de distribuição solicitados. Cálculos e versões permanecem no banco.

## Evidências

Ambiente: Node 24.21.0, Next 16.3.5. Testes usam somente banco e credenciais fictícias locais.

| Verificação | Resultado |
| --- | --- |
| `npm run lint -- --max-warnings=0` | Passou |
| `npm run typecheck` | Passou, inclusive após regeneração dos tipos |
| `npm test` | 404 testes / 79 arquivos |
| Build (`node scripts/finance-local.mjs build`, executa `npm run build`) | Passou |
| Playwright financeiro contra produção local | 17 cenários passaram |
| SQL financeiro | 9 scripts passaram, todos revertidos |
| Revisão visual | Caixas, lançamentos, demonstrativos e celular conferidos |
| Migração online | `20261012162621_finance_usability_search_and_rules.sql` aplicada |
| Verificação online | Busca sem acentos, filtro, erro específico, privilégios e histórico da migração confirmados sem gravar dados de teste |
| Tipos | Regenerados do banco online; assinatura dos RPCs preservada |

Os testes de banco incluem busca literal, acentos/caixa, totais por classificação, acesso autenticado, rejeição entre igrejas, proibição anônima e preservação dos valores históricos. Os E2E incluem largura estável durante carregamento, confirmação de atendimento, justificativa obrigatória, teto persistido, histórico acessível, celular, teclado e movimento reduzido.

## Advisors antes/depois

Nenhum novo achado. Avisos preexistentes mantidos:

- Segurança: 2 tabelas com RLS sem policies (acesso intencional por RPC), 56 funções definer executáveis por autenticados, proteção contra senhas vazadas desativada.
- Desempenho: 141 FKs sem índice, 11 avisos de inicialização de RLS, 332 índices classificados como não usados e 5 avisos de policies permissivas múltiplas.

Referências de diagnóstico: [Security Advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) e [Performance Advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Limites

A validação de navegador foi feita no Chromium com dados fictícios, incluindo resoluções pequenas e desktop. Não foi usado equipamento físico de impressão. Não houve envio de e-mail, cobrança, seed ou dados de teste no banco online. Nenhuma alteração em migrações históricas.
