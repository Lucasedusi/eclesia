# Individual Event Payment Methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar Pix automático ou estático, Dinheiro e Cartão por evento para inscrições individuais, incluindo comprovante opcional no Pix estático.

**Architecture:** `event_payment_settings` recebe configuração individual separada da caravana e `event_public_checkouts` recebe o snapshot `payment_flow`. A página pública deriva as opções dessa configuração; o banco repete a autorização do método e um endpoint autenticado por token opaco processa comprovantes estáticos no bucket privado.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Supabase/Postgres, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-20-individual-event-payment-methods-design.md`

## Global Constraints

- Não alterar o comportamento das caravanas.
- Somente um modo de Pix individual pode existir por evento.
- Dinheiro e Cartão exigem WhatsApp da organização.
- O servidor e o banco não confiam no método enviado pelo cliente.
- Comprovantes ficam em Storage privado, com tipo, tamanho, assinatura e prefixo validados.
- Migrações existentes são imutáveis; tipos do Supabase são regenerados, nunca editados manualmente.

## Review Focus

- Um cliente adulterado não pode selecionar uma forma desabilitada no evento.
- Pix estático não pode chamar Mercado Pago nem receber expiração de 30 minutos.
- Alterar a configuração do evento não muda o fluxo de um checkout já iniciado.
- Upload sem token válido, com caminho de outro evento ou assinatura inválida deve ser rejeitado.
- Eventos mistos mantêm configurações independentes para caravana e inscrição individual.

---

### Task 1: Modelo e validação das configurações individuais

**Files:**
- Modify: `src/modules/events/validations/event.schemas.test.ts`
- Modify: `src/modules/events/validations/event.schemas.ts`
- Create: `src/modules/events/utils/individual-payment.ts`
- Create: `src/modules/events/utils/individual-payment.test.ts`
- Modify: `src/modules/events/types/event.types.ts`

**Interfaces:**
- Produces: `IndividualPixMode`, `IndividualPaymentSettings`, `individualPaymentSettingsSchema`, `individualPaymentOptions()` e `resolveIndividualPaymentFlow()`.
- Consumes: formas existentes `PIX`, `CASH`, `DEBIT_CARD`, `CREDIT_CARD` e `NOT_APPLICABLE`.

- [ ] **Step 1: Escrever testes que rejeitam dois modos de Pix, exigem dados no Pix estático e WhatsApp nos métodos presenciais.**
- [ ] **Step 2: Executar `npm test -- src/modules/events/validations/event.schemas.test.ts src/modules/events/utils/individual-payment.test.ts` e confirmar falha pela ausência das novas interfaces.**
- [ ] **Step 3: Implementar schemas e funções puras mínimas, incluindo opções públicas e fluxo correspondente.**
- [ ] **Step 4: Reexecutar os testes focados e confirmar aprovação.**
- [ ] **Step 5: Commitar o modelo de domínio.**

### Task 2: Persistência, integridade e snapshot do checkout

**Files:**
- Modify: `supabase/migrations/20260920175632_individual_event_payment_methods.sql`
- Modify: `supabase/tests/events_verification.sql`
- Regenerate: `src/lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: modos e fluxos definidos na Task 1.
- Produces: colunas individuais em `event_payment_settings`, `payment_flow` em `event_public_checkouts`, validação transacional em `start_event_public_checkout` e RPC `submit_event_public_static_pix_receipt` restrita a `service_role`.

- [ ] **Step 1: Acrescentar verificações SQL para colunas, constraints, fluxo permitido e privilégios da nova RPC.**
- [ ] **Step 2: Executar a verificação contra o banco local antigo e confirmar falha estrutural esperada.**
- [ ] **Step 3: Implementar a migração com backfill compatível, constraints, função de checkout e submissão idempotente do comprovante.**
- [ ] **Step 4: Aplicar a migração apenas no Supabase local, regenerar tipos e executar `supabase/tests/events_verification.sql`.**
- [ ] **Step 5: Commitar migração, verificação e tipos gerados.**

### Task 3: Cadastro e persistência administrativa

**Files:**
- Modify: `src/modules/events/components/event-form.tsx`
- Modify: `src/modules/events/actions/event.actions.ts`
- Modify: `src/modules/events/services/event.service.ts`
- Modify: `src/modules/events/types/event.types.ts`

**Interfaces:**
- Consumes: `IndividualPaymentSettings` e as novas colunas tipadas da Task 2.
- Produces: formulário por evento, leitura/gravação tenant-aware e upload separado do QR individual.

- [ ] **Step 1: Ampliar testes de schema para a carga produzida pelo formulário e executar em RED.**
- [ ] **Step 2: Persistir as configurações individuais sem reutilizar ou apagar dados da caravana.**
- [ ] **Step 3: Adicionar controles de Pix exclusivo, Dinheiro, Cartão, WhatsApp, instruções e QR individual na etapa de pagamentos.**
- [ ] **Step 4: Adicionar preparação/finalização/remoção segura do QR individual e reexecutar testes focados.**
- [ ] **Step 5: Commitar o cadastro administrativo.**

### Task 4: Checkout público e comprovante de Pix estático

**Files:**
- Modify: `src/modules/events/components/public-registration.tsx`
- Modify: `src/modules/events/services/event-public-checkout.service.ts`
- Modify: `src/modules/events/types/event.types.ts`
- Modify: `src/modules/events/validations/event.schemas.ts`
- Create: `src/app/api/public/events/[publicCode]/[slug]/payments/pix/static/uploads/route.ts`
- Create: `src/app/api/public/events/[publicCode]/[slug]/payments/pix/static/route.ts`
- Create: `src/app/api/public/events/[publicCode]/[slug]/payments/pix/static/route.test.ts`
- Modify: `src/app/api/public/events/[publicCode]/[slug]/payments/pix/route.test.ts`

**Interfaces:**
- Consumes: `paymentFlow`, configuração pública individual e RPC da Task 2.
- Produces: UI dos métodos habilitados, fluxo estático sem Mercado Pago, upload privado opcional e status pendente para aprovação.

- [ ] **Step 1: Escrever testes de rotas para fluxo errado, arquivo inválido, token inválido e submissão válida; executar em RED.**
- [ ] **Step 2: Restringir Pix automático a `AUTOMATIC_PIX` e expor `paymentFlow` no DTO.**
- [ ] **Step 3: Implementar preparação e submissão segura do comprovante estático.**
- [ ] **Step 4: Atualizar a UI para mostrar somente métodos habilitados, selecionar o primeiro método válido e renderizar Pix estático ou automático.**
- [ ] **Step 5: Executar testes focados e commit do checkout público.**

### Task 5: Documentação e verificação completa

**Files:**
- Modify: `docs/EVENTOS_CHECKOUT_PIX.md`

**Interfaces:**
- Consumes: comportamento final das Tasks 1–4.
- Produces: instruções operacionais coerentes e evidência de validação.

- [ ] **Step 1: Documentar configuração por evento, comprovante estático e diferença entre webhook automático e aprovação manual.**
- [ ] **Step 2: Executar `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test` e `npm run build`.**
- [ ] **Step 3: Executar a verificação SQL local e revisar o diff por segredos, dados pessoais e alterações não relacionadas.**
- [ ] **Step 4: Solicitar revisão independente do branch e corrigir achados importantes com RED→GREEN.**
- [ ] **Step 5: Commitar documentação ou correções finais necessárias.**

