# Event Public Mobile, Tracking and Receipts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar todos os ajustes mobile, acompanhamento público, comprovantes internos/térmicos e cabeçalhos de relatórios do módulo de Eventos.

**Architecture:** Reutilizar os tokens opacos já persistidos por hash em `event_public_checkouts`, expondo consultas somente por Route Handlers POST sem cache. Extrair regras puras de apresentação/status para utilitários testáveis e compartilhar os componentes mobile de hero, resumo e acompanhamento entre os fluxos individual e coletivo sem alterar o layout desktop.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Styled Components, Supabase, Zod, pdf-lib e Vitest.

**Spec:** `docs/superpowers/specs/2026-09-05-event-public-mobile-and-receipts.md`

## Global Constraints

- Preservar o desktop e aplicar mudanças estruturais somente nos breakpoints mobile.
- Não criar migration nem expor `service_role` ou tabelas Supabase ao navegador.
- Usar os tokens existentes e Route Handlers POST sem cache.
- Como o ZIP não contém `.git`, checkpoints substituem commits durante esta execução.
- Validar com testes, lint, typecheck e build antes de gerar o ZIP.

---

### Task 1: Regras puras do fluxo público

**Files:**
- Create: `src/modules/events/utils/public-registration-flow.ts`
- Create: `src/modules/events/utils/public-registration-flow.test.ts`

**Interfaces:**
- Produces: `trackingKind`, `isTerminalPublicStatus`, `shouldPollPublicStatus`, `publicStatusTone`, `buildTrackingHash`, `readTrackingHash`, `shouldShowPublicSummary`.

- [ ] Escrever testes que cubram status pendente/final, visibilidade da aba, hash individual/caravana e visibilidade do resumo por etapa.
- [ ] Executar o teste e confirmar falha pela ausência das funções.
- [ ] Implementar as funções puras com validação de token de 40–120 caracteres.
- [ ] Executar o teste e confirmar aprovação.

### Task 2: Consulta persistente de status individual e caravana

**Files:**
- Modify: `src/modules/events/types/event.types.ts`
- Modify: `src/modules/events/services/event-public-checkout.service.ts`
- Modify: `src/modules/events/services/event.service.ts`
- Modify: `src/modules/events/validations/event.schemas.ts`
- Modify: `src/modules/events/validations/event.schemas.test.ts`
- Create: `src/app/api/public/events/[publicCode]/[slug]/tracking/route.ts`

**Interfaces:**
- Produces: `PublicTrackingStatus` discriminado por `kind: "INDIVIDUAL" | "CARAVAN"` e `getPublicTrackingStatus(publicCode, slug, token, refreshProvider)`.
- Consumes: hash SHA-256 do token e vínculos `registration_id`/`group_id` existentes.

- [ ] Adicionar primeiro os testes de validação do payload de acompanhamento.
- [ ] Confirmar falha do teste.
- [ ] Implementar schema, tipos e consulta segura com seleção mínima de dados.
- [ ] Criar Route Handler POST com `cache-control: no-store`.
- [ ] Rodar testes direcionados e typecheck.

### Task 3: Componentes compartilhados e layout mobile

**Files:**
- Create: `src/modules/events/components/public-event-mobile.tsx`
- Modify: `src/modules/events/components/events.styles.ts`
- Modify: `src/modules/events/components/public-registration.tsx`
- Modify: `src/modules/events/components/public-caravan-registration.tsx`

**Interfaces:**
- Produces: `PublicEventHeroMeta`, `PublicMobileToast`, `PublicCollapsibleSummary` e helpers de ação.
- Consumes: regras de `public-registration-flow.ts`.

- [ ] Criar primeiro testes das regras de abertura/ocultação usados pelos componentes.
- [ ] Implementar metadados no hero e ocultar `EventInfoCard` apenas no mobile.
- [ ] Implementar toast mobile fino mantendo mensagens globais desktop e validações inline.
- [ ] Posicionar o CTA da etapa 1 abaixo do resumo no mobile.
- [ ] Implementar resumo expandido na etapa 1, recolhido da etapa 2 em diante e oculto na confirmação.
- [ ] Padronizar botões públicos com ícones e dimensões.

### Task 4: Fluxos de pagamento e confirmação

**Files:**
- Modify: `src/modules/events/components/public-registration.tsx`
- Modify: `src/modules/events/components/public-caravan-registration.tsx`
- Modify: `src/modules/events/utils/payment-payload.ts`
- Modify: `src/modules/events/utils/payment-payload.test.ts`

**Interfaces:**
- Produces: payload coletivo sem valor/arquivo para dinheiro e links de acompanhamento após conclusão.

- [ ] Escrever teste falho para normalização do pagamento coletivo em dinheiro.
- [ ] Implementar retorno `{ amount: 0 }` sem comprovante para dinheiro.
- [ ] Mover botão “Voltar” da caravana para o cabeçalho da etapa.
- [ ] Preservar upload e valor somente no Pix coletivo.
- [ ] Padronizar confirmação presencial, WhatsApp e botões finais.
- [ ] Redirecionar ou oferecer link para a página de acompanhamento sem misturar o formulário.

### Task 5: Página pública de acompanhamento

**Files:**
- Create: `src/app/inscricoes/[publicCode]/[slug]/acompanhar/page.tsx`
- Create: `src/modules/events/components/public-registration-tracking.tsx`
- Modify: `src/modules/events/components/events.styles.ts`

**Interfaces:**
- Consumes: `POST .../tracking`, token no fragmento e `shouldPollPublicStatus`.

- [ ] Implementar cliente que lê o fragmento sem enviar token na requisição de página.
- [ ] Consultar ao carregar e oferecer atualização manual.
- [ ] Polling conservador a cada 90 segundos apenas pendente e com `document.visibilityState === "visible"`; atualização do provedor no carregamento, retorno à aba e ação manual.
- [ ] Parar polling em status terminal e consultar imediatamente ao voltar à aba.
- [ ] Renderizar comprovante/credencial/WhatsApp conforme tipo e status.

### Task 6: Comprovantes individual, workspace e térmica

**Files:**
- Modify: `src/modules/events/types/event.types.ts`
- Modify: `src/modules/events/services/event-public-checkout.service.ts`
- Modify: `src/modules/events/services/event-receipt-pdf.service.ts`
- Create: `src/modules/events/services/event-registration-receipt.service.ts`
- Create: `src/app/api/events/[eventId]/registrations/[registrationId]/receipt/route.ts`
- Create: `src/app/api/events/[eventId]/registrations/[registrationId]/thermal/route.ts`
- Modify: `src/modules/events/components/event-workspace.tsx`

**Interfaces:**
- Produces: carregamento interno protegido do comprovante, PDF e HTML térmico de 80 mm para inscrições individuais e caravanas.

- [ ] Expandir status individual com regional e acrescentar congregação/regional ao PDF.
- [ ] Implementar serviço interno protegido por permissão para carregar inscrição e credencial.
- [ ] Criar endpoint PDF interno e ação “Comprovante de inscrição”.
- [ ] Criar HTML de impressão térmica com `@page { size: 80mm auto; }`, badge de situação e QR quando liberado.
- [ ] Adicionar ação “Imprimir em térmica” ao menu individual.
- [ ] Adicionar a mesma impressão térmica ao menu de caravanas.

### Task 7: Badges e relatórios

**Files:**
- Modify: `src/modules/events/components/event-workspace.tsx`
- Modify: `src/modules/events/services/event-caravan-report-pdf.service.ts`
- Modify: `src/modules/events/services/event-general-report-pdf.service.ts`
- Modify: `src/modules/events/services/event-participant-report-pdf.service.ts`
- Modify: `src/modules/events/services/event-financial-report-pdf.service.ts`

**Interfaces:**
- Consumes: padrão visual existente de `StatusDot`.

- [ ] Uniformizar pendências em amarelo e estados negativos em vermelho.
- [ ] Remover “EKLESIA · EVENTOS” de cabeçalhos de relatórios.
- [ ] Corrigir hierarquia, espaçamentos e alinhamento de título/evento/metadados.
- [ ] Verificar PDFs por geração automatizada e inspeção estrutural.

### Task 8: Verificação e entrega

**Files:**
- Modify: arquivos identificados durante correções de verificação, se necessário.
- Create: ZIP final fora da pasta `project`.

**Interfaces:**
- Produces: entrega completa e reproduzível.

- [ ] Rodar todos os testes.
- [ ] Rodar ESLint.
- [ ] Rodar TypeScript sem emissão.
- [ ] Rodar build de produção.
- [ ] Revisar o diff lógico contra cada requisito da especificação.
- [ ] Executar revisão de código e corrigir achados críticos/importantes.
- [ ] Gerar ZIP sem `node_modules`, `.next` e arquivos temporários.
