# Eclésia — Relatório da implementação de performance

Data da implementação: 15/08/2026  
Escopo: plano de implementação Next.js 16.3 + Supabase fornecido com o projeto.

## Resultado executivo

A aplicação foi atualizada para Next.js 16.3.1 e passou a usar Cache Components, Partial Prefetching, Partial Prerendering e React Activity. As rotas prioritárias agora são classificadas pelo build como `Partial Prerender`, os modais e o cliente Supabase do navegador saíram dos bundles iniciais onde aplicável, e o carregamento de Documentos caiu de oito para três chamadas lógicas após o contexto de acesso.

As alterações locais estão concluídas e validadas. A migration foi aplicada no projeto ativo `eclesias_bd_sp`, e as verificações SQL e os Supabase Advisors foram executados antes/depois. Ativação do Cron, E2E autenticado e percentis de produção continuam dependentes do ambiente publicado e estão explicitamente marcados neste relatório.

## Versões e ambiente

| Item | Antes | Depois |
|---|---:|---:|
| Next.js | 16.3.0 | 16.3.1 |
| eslint-config-next | 16.3.0 | 16.3.1 |
| React / React DOM | 19.2.4 | 19.2.4 |
| @supabase/ssr | 0.10.2 com faixa | 0.10.2 fixo |
| @supabase/supabase-js | 2.105.3 com faixa | 2.105.3 fixo |
| Node.js | não fixado | preservado sem fixação; Next.js exige Node ≥ 20.9.0 |

`npm ci --ignore-scripts --offline` foi executado com sucesso após a atualização do lockfile. Os avisos de pacotes obsoletos (`inflight`, `rimraf@2`, `glob@7`, `fstream` e `lodash.isequal`) são transitivos da cadeia já existente, principalmente ExcelJS; ExcelJS permanece externo ao servidor e não foi encontrado nos chunks do cliente.

## Next.js 16.3.1

- `cacheComponents: true` e `partialPrefetching: true` ativos.
- Rotas e componentes com dados de runtime foram colocados sob `Suspense`; não foi necessário manter `instant = false` em nenhuma rota.
- Configurações `dynamic = "force-dynamic"` incompatíveis foram removidas dos Route Handlers de importação.
- Links voltaram ao prefetch padrão do Next 16.3; não há `prefetch={false}` anulando o App Shell.
- AppShells redundantes foram removidos de todas as páginas autenticadas. Sidebar e Header são responsabilidade exclusiva do layout autenticado.
- React Activity preserva formulários, filtros e scroll. Modais e menus transitórios são fechados no cleanup quando uma rota fica oculta.
- O listener global de cliques e `popstate` foi removido do feedback de navegação. `useLinkStatus()` continua fornecendo feedback local e a barra global fica restrita a formulários/navegações programáticas.
- `prefers-reduced-motion` permanece respeitado nos indicadores e skeletons.
- O modo de teste da API Instant Navigation só é exposto quando `E2E_TESTING=true`.

## Bundle inicial por rota

Medição: união dos chunks iniciais declarados no `page_client-reference-manifest`, gzip por arquivo, após build Turbopack. O script reproduzível é `scripts/measure-route-bundles.mjs`.

| Rota | Baseline gzip | Final gzip | Redução | Final bruto |
|---|---:|---:|---:|---:|
| `/membros` | 335,2 KB | 55,2 KB | 83,5% | 180,0 KB |
| `/documentos` | 335,3 KB | 66,5 KB | 80,2% | 220,4 KB |
| `/estrutura-eclesiastica` | 444,9 KB | 56,0 KB | 87,4% | 180,6 KB |
| `/usuarios` | 245,9 KB | 46,1 KB | 81,3% | 145,8 KB |

Principais responsáveis pelo ganho:

- `MemberDetailsModal` em chunk assíncrono;
- formulários, detalhes, confirmação e documentos da Estrutura em chunks assíncronos;
- cliente Supabase do navegador carregado somente ao iniciar upload/substituição;
- remoção dos AppShells de compatibilidade das páginas;
- Partial Prefetching transportando apenas o App Shell reutilizável.

## Supabase e chamadas de dados

| Fluxo | Antes | Depois em operação normal |
|---|---:|---:|
| Contexto de acesso | `getClaims` + RPC consolidada | preservado |
| Documentos | 8 chamadas + cleanup bloqueante | 3 chamadas paralelas: referências, lista e estatísticas |
| Filtro/paginação de Documentos | lista/workspace amplo | 1 chamada de lista |
| Usuários | 6 paralelas + 1 sequencial | 6 paralelas; overrides embutidos com FK explícita |
| Filtros de Membros | 3 por carregamento frio | cache privado curto; 0 no cache aquecido |
| Estrutura Eclesiástica | 3 por renderização | cache privado curto; 0 no cache aquecido |
| Nome/configuração da igreja | 1 por renderização | cache privado curto; 0 no cache aquecido |

As tags sempre incluem `churchId`. `updateTag` é usado nas mutações que exigem leitura imediata; `revalidatePath` foi preservado apenas para atualização da árvore de rota. AuthContext integral, permissões, CPF, notas pastorais, documentos, convites, tokens e perfis completos não recebem cache compartilhado.

### Migration entregue e aplicada

`supabase/migrations/20260815010000_optimize_administrative_documents_workspace.sql` adiciona:

- `get_administrative_document_workspace_stats(uuid)`, com os cinco contadores;
- `get_administrative_document_references(uuid)`, com categorias, pastas, tags e uploaders ativos;
- fila privada durável e RPCs de claim/resultado para o cleanup do Storage;
- RPCs de leitura com `SECURITY INVOKER`, `search_path` fechado e RLS preservada;
- RPCs de cleanup com `SECURITY DEFINER` e `EXECUTE` concedido exclusivamente a `service_role`;
- `EXECUTE` revogado de `PUBLIC`/`anon` e concedido apenas aos papéis necessários.

O arquivo de rollback revisado está em `supabase/rollback/20260815010000_optimize_administrative_documents_workspace.sql`. Nenhuma migration destrutiva ou índice especulativo foi criado.

Aplicação confirmada em 15/08/2026 no projeto `eclesias_bd_sp` (`sa-east-1`), registrada pelo Supabase como migration `20260815223404_optimize_administrative_documents_workspace`. O smoke test da RPC de estatísticas foi aprovado, as quatro funções possuem `search_path` fechado e a fila iniciou sem itens pendentes.

### Cleanup durável

O cleanup não é mais chamado por `getDocumentWorkspace`. O endpoint protegido `POST /api/cron/documents/cleanup` usa credencial administrativa e RPCs restritas a `service_role`. A transição dos metadados e a inclusão do caminho em uma fila privada acontecem atomicamente; só então o arquivo é removido do Storage. Falhas ficam na fila para nova tentativa, leases abandonados são retomados após 15 minutos, cada lote é limitado a 250 itens e logs não registram nomes de arquivo, caminhos ou PII.

Configuração de publicação:

1. Definir `CRON_SECRET` e `SUPABASE_SECRET_KEY`.
2. Opcionalmente ajustar `DOCUMENT_PENDING_TTL_MINUTES` (padrão: 120; mínimo: 15).
3. Publicar a aplicação.
4. Criar no Supabase Cron uma chamada HTTP `POST` periódica para `/api/cron/documents/cleanup` com `Authorization: Bearer <CRON_SECRET>`; sugestão inicial: a cada 15 minutos.
5. Para rollback imediato do job, definir `DOCUMENT_CLEANUP_DISABLED=true` sem desfazer migrations.

## Segurança e Postgres

- O Proxy continua usando `getClaims()`.
- `setAll(cookiesToSet, headers)` agora copia `Cache-Control`, `Expires` e `Pragma` para a resposta; redirects preservam cookies e esses cabeçalhos.
- RLS existente foi preservada; as funções de leitura são invoker e somente as funções operacionais de cleanup são definer, restritas a `service_role`.
- Relações PostgREST sensíveis usam nomes explícitos das foreign keys.
- `select("*")` foi removido das consultas de edição e detalhes de Membros.
- A busca mantém mínimo de três caracteres e limite de 100 IDs para CPF.
- Os índices trigram existentes não foram alterados sem `EXPLAIN (ANALYZE, BUFFERS)` do ambiente real.
- `supabase/verification/performance_audit.sql` reúne verificações somente leitura de RLS, grants, funções, FKs e uso de índices.

Os Supabase Advisors foram executados imediatamente antes e depois da migration, sem novo finding relacionado aos objetos adicionados. O Security Advisor mantém 20 avisos preexistentes: 19 funções `SECURITY DEFINER` acessíveis por usuários autenticados e 1 configuração de proteção contra senhas vazadas. O Performance Advisor mantém 434 apontamentos: 17 foreign keys sem índice, 52 avaliações RLS sem initplan, 343 índices sem uso registrado e 22 grupos de policies permissivas múltiplas. Nenhum índice foi removido automaticamente, pois ausência de uso em uma coleta não comprova inutilidade. `EXPLAIN (ANALYZE, BUFFERS)` das buscas reais ainda exige parâmetros e sessão representativos.

## Observabilidade

- Operações críticas em Auth, acesso, Membros, Documentos, Usuários e Estrutura emitem logs estruturados com rota, duração, chamadas lógicas, status e estado frio/aquecido.
- O Proxy mantém `Server-Timing`.
- `useReportWebVitals` envia LCP, INP, CLS, TTFB e FCP ao endpoint `/api/telemetry/web-vitals`.
- O payload não aceita query string nem PII; registra apenas rota, métrica, valor, rating, tipo de navegação e primeira entrada/navegação interna.
- `PERFORMANCE_TELEMETRY_ENABLED=false` desliga a telemetria de servidor em rollback emergencial.

P50/P75/P95 precisam ser calculados no agregador de logs após tráfego real. A medição local não representa rede, região do banco, cold starts ou concorrência de produção.

## Validação executada

| Verificação | Resultado |
|---|---|
| `npm ci --ignore-scripts --offline` | aprovado |
| ESLint | aprovado, zero warnings |
| TypeScript (`tsc --noEmit`) | aprovado |
| Vitest | 19/19 aprovados em 5 arquivos |
| Build Next 16.3.1/Turbopack | aprovado |
| PPR | rotas prioritárias marcadas `◐ Partial Prerender` |
| ExcelJS no cliente | nenhuma ocorrência nos chunks estáticos |
| Playwright discovery | 11 testes registrados; os 10 fluxos do plano mais preservação de estado |
| E2E autenticado | preparado; omitido localmente por ausência de `E2E_STORAGE_STATE` |
| Migration Supabase | aplicada em `eclesias_bd_sp`; versão `20260815223404` |
| Verificação SQL | RPCs, grants, fila privada, RLS e índices auditados |
| Supabase Advisors | executados antes/depois; nenhum novo finding da migration |

O último build final levou aproximadamente 8,3 s no contêiner local, contra 24,7 s no baseline. A diferença é indicativa; o cache de dependências e a carga do host podem variar.

## Checklist de homologação

### Concluído automaticamente

- [x] Atualização coordenada de Next e ESLint config.
- [x] Cache Components, Partial Prefetching e PPR ativos.
- [x] Sidebar/Header persistentes e AppShell único.
- [x] Modais e Supabase browser client sob demanda.
- [x] Cleanup fora do request e RPCs consolidadas entregues.
- [x] Overrides de Usuários sem janela sequencial.
- [x] Cache privado e tags por igreja.
- [x] Web Vitals e operações de servidor instrumentados sem PII.
- [x] Lint, tipos, testes e build aprovados.
- [x] Migration aplicada em `eclesias_bd_sp` e auditoria SQL executada.
- [x] Supabase Security e Performance Advisors executados antes/depois.

### Exige ambiente autenticado/publicado

- [ ] Executar `EXPLAIN (ANALYZE, BUFFERS)` das buscas representativas.
- [ ] Configurar Supabase Cron e validar uma execução com registros acima/abaixo do TTL.
- [ ] Gerar storage state de Administrador e executar `npm run test:e2e`.
- [ ] Homologar desktop/mobile, logout/troca de igreja e revogação de permissão.
- [ ] Validar upload, substituição, preview, download, lixeira e restauração com Storage real.
- [ ] Coletar P50/P75/P95 frios e aquecidos após publicação.

## Referências oficiais usadas

- https://nextjs.org/docs/app/guides/migrating-to-cache-components
- https://nextjs.org/docs/app/guides/adopting-partial-prefetching
- https://nextjs.org/docs/app/guides/instant-navigation
- https://nextjs.org/docs/app/guides/preserving-ui-state
- https://nextjs.org/docs/app/guides/lazy-loading
- https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals
- https://supabase.com/docs/guides/auth/server-side/nextjs
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/query-optimization
