# EKLESIA — Relatório da implementação de performance e fluidez

Data da implementação: 7 de agosto de 2026

## 1. Resultado executivo

Os upgrades previstos no plano foram implementados sem transformar a aplicação em SPA, sem remover Server Components, sem enfraquecer as validações de permissão e sem desativar RLS.

Os principais ganhos estruturais são:

- Sidebar e Header passaram a pertencer a um layout autenticado persistente.
- Toda navegação interna recebe feedback global com atraso visual de 120 ms, timeout de segurança e suporte a redução de movimento.
- As rotas prioritárias possuem skeletons próprios; estatísticas de Membros são entregues por streaming e não bloqueiam a tabela.
- O proxy e o contexto autenticado usam `getClaims()`; perfil, acessos, igreja ativa e permissões são consolidados em uma RPC.
- A listagem de Membros retorna o Cargo ativo no mesmo resultado e elimina consultas auxiliares de Regionais/Cargos e a consulta posterior de `member_roles`.
- Regionais e Congregações compartilham o mesmo conjunto de dados enquanto o layout do módulo permanece montado.
- Prefetch foi habilitado somente em rotas frequentes e desabilitado nas rotas ainda não implementadas.
- A instrumentação de desenvolvimento mede etapas e quantidade de chamadas sem registrar tokens ou dados pessoais.

## 2. Comparação estrutural

Os números abaixo representam viagens lógicas ao Supabase no caminho autenticado normal, com base no fluxo de código antes e depois. Chamadas independentes executadas em paralelo continuam sendo contadas individualmente.

| Cenário | Antes | Depois | Redução |
|---|---:|---:|---:|
| Contexto de acesso da página | 4 | 1 | 75% |
| `/membros`, sem filtros opcionais | 11 | 6 | 45% |
| `/membros`, com filtros de Regional e Cargo | até 14 | 6 | 57% |
| `/membros/novo` | 7 | 3 | 57% |
| Estrutura Eclesiástica, primeiro acesso | 8 | 4 | 50% |
| Troca entre Regionais e Congregações já carregadas | 8 | 0 chamadas de dados | 100% |

Observações:

- A verificação `getClaims()` pode ser local quando o projeto usa assinatura assimétrica e as chaves JWKS estão em cache. Se a configuração exigir validação remota, deve-se somar a chamada de Auth à medição do ambiente publicado.
- A busca de CPF continua isolada e só ocorre quando necessária e autorizada.
- Filtros e opções de formulário continuam em consultas paralelas, de modo que três consultas independentes representam uma única janela de latência, sem dependência sequencial.

## 3. Implementação por upgrade

### 3.1. Instrumentação

- Criado `src/lib/performance/server-performance.ts` com trace por requisição, tempo da operação, tempo acumulado e contagem declarada de chamadas.
- Instrumentados: claims, contexto consolidado, catálogo eclesiástico, listagem, estatísticas, filtros e opções de formulário.
- O proxy envia `Server-Timing: proxy;dur=...` nas respostas normais.
- Logs detalhados existem apenas em desenvolvimento e não contêm CPF, e-mail, cookie, token ou documentos.

### 3.2. Layout autenticado persistente

- Rotas autenticadas movidas para o route group `src/app/(authenticated)` sem alterar nenhum URL público.
- O novo layout carrega o contexto mínimo, compartilha `AppShell`, Sidebar e Header e deixa somente a área central variar.
- `AppShell` mantém compatibilidade com as páginas existentes e evita duplicar o shell quando já está no layout compartilhado.
- A resolução de contexto usa memoização React limitada à mesma requisição.

### 3.3. Feedback de navegação

- Provider global captura Links internos, histórico voltar/avançar, formulários marcados e navegações programáticas relevantes.
- Barra superior aparece somente após 120 ms por CSS, não bloqueia a interface e possui timeout de 20 segundos.
- `useLinkStatus()` fornece spinner no elemento acionado sem alterar sua largura.
- O indicador termina na mudança de pathname/query e respeita `prefers-reduced-motion`.
- Login, cadastro inicial, onboarding, redefinição de senha e salvamento de membro iniciam explicitamente o feedback antes de `router.push/replace`.

### 3.4. Skeletons e streaming

- Criado componente reutilizável para skeleton de dashboard, tabela, formulário, detalhes e shell autenticado.
- Adicionados `loading.tsx` para Membros, novo membro, edição, Cargos, Usuários, Auditoria, Perfil, Configurações e área autenticada.
- A página de Membros inicia listagem/filtros e estatísticas em paralelo, cada parte com seu próprio `Suspense`.
- A tabela pode ser exibida antes dos cartões estatísticos.

### 3.5. Proxy e autenticação

- `getUser()` foi substituído por `getClaims()` no proxy e na resolução de contexto.
- Sessão ausente, claim inválida ou expirada continua sendo tratada como não autenticada.
- Páginas e operações sensíveis continuam chamando `requireAccessContext`; o proxy não é a única barreira de autorização.

### 3.6. Contexto consolidado

- Aplicada a RPC `public.get_my_access_context(uuid)` no projeto Supabase `eclesias_bd`.
- A função retorna perfil mínimo, acessos ativos, igreja selecionada e permissões efetivas em uma chamada.
- A função é `STABLE`, `SECURITY INVOKER`, respeita RLS e só pode ser executada por `authenticated`.
- Existe fallback seguro para o fluxo anterior caso a RPC ainda não esteja presente em outro ambiente.
- Não há cache global de permissões; alterações são refletidas na próxima requisição/refresh.

### 3.7. Membros

- Cargo ativo, nomenclatura feminina, Congregação e Regional são retornados por relações embutidas no mesmo select da listagem.
- Filtro de Regional usa a relação de Congregação; filtro de Cargo usa relação `!inner` com alias.
- Eliminado o padrão de pré-consultas para resolver IDs e a consulta posterior de Cargos dos membros da página.
- Paginação, busca, filtros, ordenação e seleção de colunas permanecem no Supabase.
- A URL dos filtros usa a API nativa de History; isso evita uma segunda navegação Server Component enquanto a server action já carrega a tabela.
- O resultado local é versionado após mutações, evitando estado obsoleto sem efeito de sincronização com render extra.

### 3.8. Estrutura Eclesiástica

- O layout do módulo carrega Regionais, Congregações e Cargos uma vez e entrega o catálogo a um workspace persistente.
- As páginas filhas de Regionais e Congregações preservam URLs e histórico, mas não repetem consultas.
- Acesso direto às URLs continua suportado.
- As mutações existentes atualizam o layout com `revalidatePath` e `router.refresh()`.
- O catálogo também é deduplicado por requisição com `cache()`; nenhum valor é compartilhado globalmente entre usuários ou igrejas.

### 3.9. Prefetch controlado

- Prefetch mantido para Dashboard, Estrutura, Membros, Usuários, Auditoria, Configurações e Design System.
- Novo membro e abas irmãs utilizam o prefetch nativo do Link quando visíveis.
- Rotas marcadas como “em breve” não são antecipadas.

### 3.10. Cache e invalidação segura

- Contexto de acesso: memoização somente por requisição.
- Catálogo eclesiástico: mantido no layout do módulo e deduplicado por requisição.
- Cache de navegação do App Router e prefetch controlado reaproveitam payloads já visitados.
- Mutações de organização, membros, configurações e permissões continuam chamando `revalidatePath` nos escopos correspondentes.
- CPF, documentos, permissões e dados completos do membro não foram colocados em cache compartilhado.

### 3.11. Região

- O projeto permanece em Ohio (`us-east-2`), conforme o plano.
- Não foi feita migração de infraestrutura nesta rodada. A decisão depende de medir a região da hospedagem Next.js e a comunicação servidor–Supabase em homologação.

### 3.12. Desenvolvimento e produção

| Medição local | Antes | Depois |
|---|---:|---:|
| Build completo | 21,195 s | 21,803 s |
| Compilação Next.js | 10,1 s | 9,8 s |
| TypeScript dentro do build | 9,1 s | 9,9 s |

A diferença do tempo total é de aproximadamente 2,9% e está dentro da variação normal de uma execução única. O build prova que a nova arquitetura compila e pré-renderiza as rotas compatíveis, mas não substitui medições de TTFB/P50/P95 com sessão real no ambiente publicado.

O processo `next start` não pôde ser exercitado neste container porque o runtime bloqueou a leitura de interfaces de rede (`uv_interface_addresses`). A compilação de produção foi concluída normalmente. Testes autenticados ponta a ponta exigem uma sessão de homologação e não foram simulados com credenciais artificiais no banco de produção.

## 4. Segurança e banco de dados

Validações executadas no Supabase:

- Migração `performance_access_context` registrada e aplicada.
- RPC executada com formato esperado de perfil, acessos e permissões.
- `SECURITY DEFINER = false`.
- `STABLE = true`.
- `anon EXECUTE = false`.
- `authenticated EXECUTE = true`.
- `PUBLIC EXECUTE = false`.
- RLS ativa em `profiles`, `churches`, `user_church_access`, `regions`, `congregations`, `roles`, `members` e `member_roles`.
- Nenhum finding dos advisors referencia a nova RPC.

Os advisors atuais ainda registram itens anteriores a esta rodada:

| Advisor | Quantidade |
|---|---:|
| Funções `SECURITY DEFINER` executáveis por autenticados | 18 |
| Proteção contra senhas vazadas desabilitada | 1 |
| Foreign keys sem índice | 17 |
| Chamadas Auth/RLS sem initplan | 53 |
| Índices ainda não usados | 318 |
| Múltiplas policies permissivas | 22 |

Esses avisos não foram criados pela migração desta implementação. Alterar em massa as funções e policies anteriores sem uma rodada específica de autorização/regressão poderia mudar regras de negócio e acesso; portanto, foram mantidos como backlog explícito.

Referências de remediação:

- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
- https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
- https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## 5. Verificações executadas

| Verificação | Resultado |
|---|---|
| ESLint | Aprovado, sem erros ou avisos do projeto |
| TypeScript `tsc --noEmit` | Aprovado |
| Build Next.js 16.2.4 | Aprovado |
| Manifesto de rotas | 26 rotas geradas; URLs existentes preservados |
| Migração Supabase | Aplicada |
| Permissões da nova RPC | Aprovadas |
| RLS nas tabelas prioritárias | Ativa |
| Advisors após DDL | Nenhum finding novo para a RPC |
| Smoke HTTP local | Bloqueado pela restrição de interfaces de rede do container |
| Login/convite/logout com usuário real | Requer homologação com contas de teste |

## 6. Principais arquivos alterados

- `src/app/(authenticated)/**`: layout persistente, rotas movidas e loadings por rota.
- `src/components/layout/app-shell.tsx`
- `src/components/layout/app-sidebar.tsx`
- `src/components/layout/app-header.tsx`
- `src/components/navigation/navigation-feedback.tsx`
- `src/components/ui/page-skeleton.tsx`
- `src/lib/performance/server-performance.ts`
- `src/lib/supabase/proxy.ts`
- `src/lib/supabase/database.types.ts`
- `src/modules/auth/services/access-context.service.ts`
- `src/modules/members/services/member.service.ts`
- `src/modules/members/services/member-form-options.service.ts`
- `src/modules/members/components/member-management.tsx`
- `src/modules/members/components/member-create-form/member-create-form.tsx`
- `src/modules/organization/components/organization-tabs.tsx`
- `src/modules/organization/components/organization-workspace.tsx`
- `src/modules/organization/services/organization.service.ts`
- `src/providers/app-providers.tsx`
- `src/proxy.ts`
- `src/styles/global-styles.ts`
- `supabase/migrations/20260807185519_performance_access_context.sql`

## 7. Checklist de homologação recomendado

Antes de promover para produção, executar com contas próprias de teste:

1. Login de administrador e convidado, logout e sessão expirada.
2. Acesso negado a uma rota sem permissão.
3. Convite, primeiro acesso e troca de igreja.
4. Navegação completa da Sidebar, incluindo voltar/avançar.
5. Listagem, busca, filtros, paginação, cadastro, edição e ficha de Membros.
6. CRUD de Regionais, Congregações e Cargos, verificando atualização imediata das abas e filtros.
7. Upload e abertura de documentos privados.
8. Modais, toasts, desktop e mobile.
9. Coletar P50, P75 e P95 frios/aquecidos nas rotas prioritárias.
10. Registrar a região do servidor Next.js antes de decidir qualquer migração do Supabase.

Metas de aceite do plano: feedback até 120 ms quando necessário, skeleton preferencialmente até 300 ms, conteúdo principal preferencialmente abaixo de 800 ms em produção e nenhuma interface aparentemente travada.
