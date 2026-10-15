# Financeiro mobile e PWA — plano de implementação

> **Para execução:** usar `superpowers:executing-plans`, tarefa por tarefa, com caixas de seleção. Execução direta pelo agente principal, sem subagentes, conforme pedido do usuário.

**Objetivo:** entregar uma interface financeira confortável no celular e uma PWA instalável que abre em `/financeiro`, opera online e preserva os fluxos, a segurança e o desktop existentes.

**Arquitetura:** as rotas e serviços financeiros atuais continuam sendo a fonte de dados e autorização. Componentes mobile apresentam os mesmos DTOs com navegação, listas e formulários próprios para toque. Manifesto, service worker mínimo e uma página neutra de falta de conexão completam a PWA sem cache de dados financeiros.

**Tecnologias:** Next.js 16.3.5 App Router com Cache Components, React 19, TypeScript, Styled Components e Tailwind existentes, Supabase, Vitest, Playwright e `sharp` já instalado.

**Especificação:** `docs/superpowers/specs/2026-10-14-finance-mobile-pwa-design.md`.

## Restrições gerais

- Preservar Next.js 16 App Router, Cache Components, Partial Prefetching, React Compiler, Node de `.node-version`, npm e `package-lock.json`; consultar os guias relevantes em `node_modules/next/dist/docs/` antes de editar cada área.
- Reutilizar `requireFinanceContext()`, `PERMISSIONS`, capacidades por unidade, DTOs, serviços, ações, validações, tags, auditoria e RLS atuais. Nenhuma migração ou regra de cálculo nova está prevista.
- Manter a classificação de dízimo histórica, a base por departamento, o teto bruto da prebenda, os demonstrativos orientativos e as transferências fora das receitas/despesas consolidadas.
- Manter a experiência desktop, os PDFs aprovados e a impressão de 58/80 mm. Ações mobile e itens de navegação seguem a autorização da unidade selecionada.
- Preservar preenchimento durante navegação e atualização; não persistir rascunhos ou dados financeiros em `localStorage`, IndexedDB, Cache Storage ou no cache HTTP.
- Não criar lançamentos offline, sincronização, notificações ou autoatendimento em tablet. Testes contra banco local ou ambiente de desenvolvimento explicitamente autorizado; nenhuma escrita remota.
- Executar diretamente, sem subagentes. Usar testes focados antes de cada mudança de comportamento e revisar o diff antes de concluir.

## Mapa de arquivos e responsabilidades

| Área | Arquivos previstos | Responsabilidade |
| --- | --- | --- |
| Estrutura mobile | `src/modules/finance/components/finance-shell.tsx`, `finance-shell.styles.ts`, `finance-context-bar.tsx`, novo `finance-mobile-navigation.tsx` | Cabeçalho, contexto, barra inferior, Mais, navegação protegida e área segura. |
| Visão geral | `finance-overview.tsx`, `finance-shell.styles.ts`, `src/app/(finance)/financeiro/page.tsx`, `src/app/(finance)/financeiro/lancamentos/page.tsx`, `finance-transactions-workspace.tsx`, `src/modules/finance/utils/finance-navigation.ts` | Hierarquia do saldo, atalhos autorizados, lista recente e abertura de entrada/saída por URL no celular. |
| Movimentos | `finance-transactions-table.tsx`, `finance-transactions-workspace.tsx`, novo `finance-mobile-transaction-cards.tsx`, `finance-shell.styles.ts` | Filtros e cartões mobile; detalhes e transferências reutilizam consultas e ações. |
| Registro | `finance-entry-form.tsx`, `finance-attendance.tsx`, `finance-transaction-drawer.tsx`, `finance-shell.styles.ts` | Seções compactas, resumo de confirmação, total e ações acessíveis. |
| Outras áreas | `finance-cashboxes.tsx`, `finance-settings.tsx`, `finance-statements.tsx`, `finance-statement-detail.tsx`, `finance-reports.tsx`, `finance-receipt.tsx`, `finance-shell.styles.ts` | Layout mobile de caixas, cadastros, versões, PDFs e comprovantes. |
| PWA | `src/app/(finance)/financeiro/layout.tsx`, `src/proxy.ts`, `next.config.ts`, novo `finance-pwa-controller.tsx`, novos arquivos em `public/financeiro-*` | Manifesto, ícones, instalação, conexão, cache restrito e atualização segura. |
| Verificação | Novos `e2e/finance-mobile-*.spec.ts`, `docs/finance/mobile-pwa-validation.md` | Fluxos, permissões, segurança de cache, desempenho, Android e iPhone. |

## Foco de revisão

1. **Unidade somente de consulta:** os dados autorizados aparecem, mas Atendimento, Nova entrada, Nova saída e ações de escrita não aparecem nem executam; fixar no teste da tarefa 1.
2. **Tela de 320 px com teclado aberto:** campos e confirmação continuam acessíveis, sem rolagem horizontal ou conteúdo encoberto; fixar no teste da tarefa 4.
3. **Conexão perdida durante a gravação:** preenchimento e chave da tentativa permanecem, sem segunda operação automática; fixar no teste da tarefa 4 e repetir na tarefa 7.
4. **Popup/PDF bloqueado no celular:** Abrir PDF e Baixar PDF permanecem disponíveis, sem alteração do arquivo gerado; fixar no teste da tarefa 6.
5. **Atualização com formulário sujo:** nenhuma recarga ocorre antes de salvar ou descartar; fixar no teste da tarefa 8.

---

### Task 1: navegação e contexto mobile

**Arquivos:** modificar `finance-shell.tsx`, `finance-shell.styles.ts`, `finance-context-bar.tsx`; criar `finance-mobile-navigation.tsx`, `docs/finance/mobile-pwa-validation.md`; testar em `e2e/finance-mobile-shell.spec.ts`.

**Interface:** `FinanceMobileNavigation({ items, pathname, unitId, month, navigate })`, onde `items: ReadonlyArray<{ label: string; path: string; icon: LucideIcon }>` já vem filtrado do `FinanceShell`, `navigate: (url: string) => void` usa a proteção atual e o componente controla o painel **Mais**. Não introduzir uma segunda fonte de permissões.

- [ ] **Medir linha de base:** executar `npm run build` e `npm run analyze:routes` no estado aprovado; registrar tamanho das rotas atuais e pré-requisitos de medição em `docs/finance/mobile-pwa-validation.md` antes de editar a interface.
- [ ] **Teste vermelho:** em 390 e 320 px, verificar barra `Início / Lançamentos / Atendimento / Mais`, seletor de mês e unidade, painel Mais, área segura e ausência da barra desktop; com sessão somente de consulta, Atendimento e ações de escrita somem. Em 1440 px, a barra lateral existente permanece. Mudar mês/unidade com formulário sujo mostra a confirmação atual.
- [ ] **Executar teste:** `npm run test:e2e -- e2e/finance-mobile-shell.spec.ts` com `E2E_STORAGE_STATE` e `E2E_FINANCE_FIXTURE`; esperar falha nas novas expectativas.
- [ ] **Implementar:** montar a barra mobile a partir dos links e capacidades existentes, usando `financeLocation()` e `useFinanceNavigation()`; manter cabeçalho e contexto compactos e acessíveis, com botões de pelo menos 44 × 44 CSS px.
- [ ] **Verificar:** repetir o teste focado e `npm run typecheck`; esperar aprovação. Revisar visualmente 320, 390 e 1440 px.
- [ ] **Commit:** `feat(finance): add mobile navigation shell`.

### Task 2: visão geral orientada à consulta e às ações

**Arquivos:** modificar `finance-overview.tsx`, `finance-shell.styles.ts`, `src/app/(finance)/financeiro/page.tsx`, `src/app/(finance)/financeiro/lancamentos/page.tsx`, `finance-transactions-workspace.tsx`, `src/modules/finance/utils/finance-navigation.ts`; testar em `e2e/finance-mobile-overview.spec.ts` e `src/modules/finance/utils/finance-navigation.test.ts`.

**Interface:** `FinanceOverview` recebe também `capabilities: FinanceCapabilities` da unidade resolvida no servidor. `financeLocation(path, unit, month, extras?: Record<string, string>)` mescla parâmetros extras somente nas rotas financeiras. `FinanceTransactionsWorkspace` troca `newEntry: boolean` por `initialEntry: "INCOME" | "EXPENSE" | null`, derivado apenas dos valores de UI `novo=entrada|saida`.

- [ ] **Teste vermelho:** em 390 px, saldo final tem rótulo inequívoco, entradas/saídas e cinco itens recentes precedem gráficos; atalhos permitidos abrem Atendimento, Nova entrada, Nova saída e Caixas. Os links de entrada/saída preservam `unidade` e `mes` e abrem o drawer correto. Usuário sem `create` não vê atalhos de escrita. Em 1440 px, a visão geral continua sem atalho de Nova entrada. O teste unitário fixa a mesclagem da query.
- [ ] **Executar teste:** `npm run test:e2e -- e2e/finance-mobile-overview.spec.ts` com fixture local; esperar falha nos elementos mobile novos.
- [ ] **Implementar:** reorganizar apenas a apresentação mobile e ligar atalhos às rotas atuais; entrada usa `novo=entrada` e saída usa `novo=saida`, ambos validados como estado de UI na página de Lançamentos. Preservar unidade e mês em `financeLocation()` e não inserir cálculo no cliente.
- [ ] **Verificar:** teste focado, `npm run typecheck` e comparação visual desktop/mobile; esperar aprovação.
- [ ] **Commit:** `feat(finance): prioritize mobile overview actions`.

### Task 3: lançamentos, filtros e transferências em cartões

**Arquivos:** modificar `finance-transactions-table.tsx`, `finance-transactions-workspace.tsx`, `finance-shell.styles.ts`; criar `finance-mobile-transaction-cards.tsx`; testar em `e2e/finance-mobile-transactions.spec.ts`.

**Interface:** `FinanceMobileTransactionCards({ items, onOpen })` recebe `FinanceTransactionRow[]` e `onOpen(id: string)`. Detalhes continuam sendo carregados pela ação `getFinanceTransactionAction`; a tabela desktop e os cartões usam a mesma página de resultados e os mesmos filtros de URL.

- [ ] **Teste vermelho:** cartões agrupados por data exibem categoria, pessoa/descrição, departamento, situação, sinal e valor corretos; chips Todas/Entradas/Saídas e painel avançado conservam unidade/mês, mostram filtros ativos, limpam filtros e preservam totais paginados. Transferências aparecem separadas com origem/destino e não alteram totais de receita/despesa. Abrir cartão e corrigir/cancelar respeita capacidades.
- [ ] **Executar teste:** `npm run test:e2e -- e2e/finance-mobile-transactions.spec.ts` com fixture local; esperar falha na lista mobile.
- [ ] **Implementar:** apresentação em cartões para telas pequenas, tabela desktop intacta, um único estado de filtros e detalhe. Usar `display:none` na apresentação inativa para evitar duplicação na árvore de acessibilidade; nenhuma segunda consulta ou soma financeira.
- [ ] **Verificar:** teste focado e `npm run typecheck`; esperar aprovação.
- [ ] **Commit:** `feat(finance): adapt transactions for touch`.

### Task 4: formulários de entrada, saída e atendimento

**Arquivos:** modificar `finance-entry-form.tsx`, `finance-attendance.tsx`, `finance-transaction-drawer.tsx`, `finance-shell.styles.ts`; testar em `e2e/finance-mobile-entry.spec.ts` e manter `e2e/finance-attendance.spec.ts`.

**Interface:** preservar `FinanceEntryForm` como única implementação de estado, validação, máscara, anexos, idempotência e gravação; adicionar apenas apresentação responsiva e resumo dos campos antes das ações.

- [ ] **Teste vermelho:** a 320 e 390 px, identificar pessoa, caixa/método, itens e total sem rolagem horizontal; teclado aberto não cobre o campo focado nem a confirmação. Digitar `1234` produz `12,34`; duas contribuições geram um comprovante e mantêm classificação por item. Erro foca o primeiro campo inválido. Navegação suja pede confirmação; resposta incerta preserva dados e chave da tentativa.
- [ ] **Executar teste:** `npm run test:e2e -- e2e/finance-mobile-entry.spec.ts` com fixture local; esperar falha nas novas expectativas.
- [ ] **Implementar:** drawer mobile em tela cheia, uma coluna, seções curtas, resumo pré-confirmação e barra de total/ação com `safe-area-inset-bottom`. Conservar botões Salvar e continuar/Salvar e imprimir e o fallback manual da credencial.
- [ ] **Verificar:** novo teste, `e2e/finance-attendance.spec.ts`, testes da máscara e `npm run typecheck`; esperar aprovação.
- [ ] **Commit:** `feat(finance): streamline mobile entry and attendance`.

### Task 5: caixas, demonstrativos e configurações

**Arquivos:** modificar `finance-cashboxes.tsx`, `finance-settings.tsx`, `finance-statements.tsx`, `finance-statement-detail.tsx`, `finance-shell.styles.ts`; testar em `e2e/finance-mobile-secondary.spec.ts`.

**Interface:** dados e ações atuais permanecem; listas de versões e cadastros ganham apresentação mobile em cartões, com tabelas desktop preservadas. Ajuste, transferência e geração usam as ações existentes.

- [ ] **Teste vermelho:** a 320 e 390 px, caixas, contas, saldos, ações permitidas, versões de demonstrativo e cadastros são legíveis sem rolagem horizontal; histórico identifica versão/situação; um perfil sem gestão não vê edição. O texto informa que o demonstrativo é orientativo. Valores e versões coincidem com o desktop para a mesma unidade/mês.
- [ ] **Executar teste:** `npm run test:e2e -- e2e/finance-mobile-secondary.spec.ts` com fixture local; esperar falha nos cartões novos.
- [ ] **Implementar:** cartões e agrupamentos compactos, painéis de edição em largura mobile e detalhes expansíveis, sem mudar cálculos, persistência ou aba Operadores.
- [ ] **Verificar:** teste focado, `e2e/finance-statements.spec.ts`, `e2e/finance-settings.spec.ts` e `npm run typecheck`; esperar aprovação.
- [ ] **Commit:** `feat(finance): adapt secondary finance screens`.

### Task 6: PDFs e comprovantes no celular

**Arquivos:** modificar `finance-reports.tsx`, `finance-receipt.tsx`, `finance-shell.styles.ts`; testar em `e2e/finance-mobile-documents.spec.ts` e manter `e2e/finance-reports.spec.ts`.

**Interface:** `POST /api/finance/reports/pdf` e `FinanceReceipt` permanecem como estão quanto a conteúdo, autorização e impressão; apenas controles e apresentação mobile mudam.

- [ ] **Teste vermelho:** em 390 px, seletor/tipo/botão ocupam a largura útil; PDF pronto oferece Abrir e Baixar mesmo com popup bloqueado, o arquivo começa com `%PDF` e o desktop ainda abre nova aba. Comprovante é legível, escolhe 58/80 mm e o controle de impressão fica acessível.
- [ ] **Executar teste:** `npm run test:e2e -- e2e/finance-mobile-documents.spec.ts` com fixture local; esperar falha no layout novo.
- [ ] **Implementar:** ajustar hierarquia e controles mobile; preservar o `Blob` existente, links de fallback, geração, PDF e CSS de impressão. Não adicionar visualizador embutido nem envio externo.
- [ ] **Verificar:** novo teste, `e2e/finance-reports.spec.ts` e testes de PDF existentes; esperar aprovação.
- [ ] **Commit:** `feat(finance): polish mobile documents`.

### Task 7: instalação, login e falta de conexão

**Arquivos:** modificar `src/app/(finance)/financeiro/layout.tsx`, `src/proxy.ts`, `next.config.ts`; criar `public/financeiro.webmanifest`, `public/financeiro-icon.svg`, `public/financeiro-icon-192.png`, `public/financeiro-icon-512.png`, `public/financeiro-apple-icon.png`, `public/financeiro-sw.js`, `public/financeiro-offline.html`, `src/modules/finance/components/finance-pwa-controller.tsx`; testar em `e2e/finance-mobile-pwa.spec.ts`.

**Interface:** `FinancePwaController({ hasUnsavedChanges }: { hasUnsavedChanges: () => boolean })` registra `/financeiro-sw.js` com escopo `/`, mostra conexão, orientação de instalação no modo navegador e estado da atualização; `FinanceShell` passa uma leitura da guarda atual. Manifesto: `id: "/financeiro"`, `start_url: "/financeiro"`, `scope: "/"`, `display: "standalone"`, cores do tema, ícones 192/512 e Apple.

- [ ] **Teste vermelho:** manifesto e ícones públicos respondem sem sessão, instalação tem início em `/financeiro`; sem sessão, a rota financeira redireciona a `/login?next=/financeiro`, e uma sessão já válida com esse `next` retorna ao Financeiro sem ampliar permissões. Orientações de instalação aparecem somente no navegador. Após controle do service worker, conexão ausente mostra apenas a página neutra; Cache Storage contém somente essa página, sem HTML/RSC/API/PDF financeiro. Durante uma resposta incerta, não é gerado segundo comando. O login completo após expiração é conferido manualmente em dispositivo real se não houver credenciais E2E locais.
- [ ] **Executar teste:** `npm run test:e2e -- e2e/finance-mobile-pwa.spec.ts`; esperar falha nos recursos PWA ausentes.
- [ ] **Implementar:** ligar manifesto apenas à área financeira e definir cor da interface por `viewport` (não pelo metadado depreciado); gerar ícones do SVG com `sharp`, publicar assets PWA no proxy, configurar cabeçalhos `private, no-store` para respostas financeiras/documentos e `no-cache` para o script; service worker usa rede para tudo e serve a página autocontida somente no erro de navegação para financeiro/login. Preservar `next` seguro ao entrar com sessão existente.
- [ ] **Verificar:** teste focado, requisições HTTP reais em build local para cabeçalhos/redirect, `npm run typecheck` e `npm run build`; esperar aprovação.
- [ ] **Commit:** `feat(finance): add online-first finance PWA`.

### Task 8: atualização segura, desempenho e aceite integrado

**Arquivos:** finalizar `finance-pwa-controller.tsx`, `finance-shell.tsx`, `finance-shell.styles.ts`; criar `e2e/finance-mobile-update.spec.ts`; atualizar `docs/finance/mobile-pwa-validation.md`; ajustar apenas arquivos afetados por falhas comprovadas.

**Interface:** nova versão fica em espera; o controlador só envia `SKIP_WAITING` e recarrega após ação explícita e `hasUnsavedChanges() === false`. Um formulário sujo mostra orientação para salvar ou descartar, sem recarga.

- [ ] **Teste vermelho:** interceptar a resposta do script do worker para instalar uma segunda versão, iniciar atendimento com dados, solicitar atualização e verificar que dados/tela permanecem; após salvar ou descartar, atualização explícita recarrega. Em 320, 375, 390 e 430 px, verificar rotas principais e foco; em 1440 px, verificar desktop. Confirmar acesso restrito por congregação e operação.
- [ ] **Executar teste:** `npm run test:e2e -- e2e/finance-mobile-update.spec.ts` com fixture local; esperar falha no fluxo de atualização novo.
- [ ] **Implementar:** completar a política de atualização e estados de conexão. Registrar em `docs/finance/mobile-pwa-validation.md` linha de base e resultado de bundles e Web Vitals, capturas/inspeção visual, cabeçalhos e cache, cenários de Android/iPhone, além de limitações observadas.
- [ ] **Verificar:** `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test`, `npm run build`, `npm run analyze:routes`, `npm run test:e2e` com `E2E_STORAGE_STATE`/`E2E_FINANCE_FIXTURE`, `git diff --check` e revisão do diff. Testar instalação, sessão, PDF e impressão em aparelhos Android e iPhone reais quando disponíveis; registrar o pré-requisito exato de qualquer teste não executado.
- [ ] **Commit:** `test(finance): validate mobile PWA experience`.

## Entrega

Revisar todas as tarefas contra a especificação, comparar resultados financeiros mobile/desktop e confirmar ausência de segredos, dados pessoais, ruído gerado e migrations editadas. Entregar a documentação de validação, o estado dos testes, as limitações de dispositivos físicos e os commits. Publicação da aplicação e mudanças no banco remoto exigem autorização específica se vierem a ser necessárias.
