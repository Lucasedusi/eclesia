# Final Member Credential Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a carteirinha CR80 final com SVG compartilhado, PDF idêntico, QR público revogável e ZIP limpo.

**Architecture:** Um serviço autenticado prepara o DTO e um token pendente. Um renderizador puro cria os dois SVGs; a prévia os exibe diretamente e o PDF rasteriza os mesmos SVGs a 300 DPI antes de inseri-los com `pdf-lib`. Tokens ficam protegidos por hash, RLS e ciclo PENDING/ACTIVE/REVOKED.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/Postgres, Styled Components, SVG, QR Code, resvg, pdf-lib, Vitest e Playwright.

**Spec:** `docs/superpowers/specs/2026-09-22-final-member-credential-design.md`

## Global Constraints

- Não usar as imagens demonstrativas como fundo.
- Não aplicar migrations ao banco remoto.
- Não confiar em DTOs do cliente no endpoint de PDF.
- Não armazenar token original nem incluir dados pessoais no QR.
- Manter RLS, permissão, tenant, auditoria e `no-store`.
- Não quebrar linha dentro da carteirinha.

## Review Focus

- Emissor sem `members.view_sensitive_identity`, mas com `members.credentials.issue`, lê somente o CPF do membro dentro do próprio escopo.
- Token pendente expirado, revogado ou pertencente a outro membro não gera PDF.
- Nomes e dados institucionais muito longos não quebram linha nem saem da área segura.
- Logo ausente, inválida ou indisponível cai para monograma sem impedir emissão.
- A validação pública nunca retorna CPF, nascimento, filiação, matrícula ou IDs.

---

### Task 1: Persistência e regras de token

**Files:**
- Create: `supabase/migrations/*_member_credential_verification_tokens.sql`
- Create: `supabase/tests/member_credential_verification_tokens.sql`
- Modify: `src/lib/supabase/database.types.ts` somente por regeneração

**Interfaces:**
- Produces: tabela `member_credential_tokens` e políticas para os serviços autenticado e público.

- [ ] Criar teste SQL que cobre grants, RLS, tenant, CPF e ciclo do token.
- [ ] Gerar migration com `supabase migration new member_credential_verification_tokens`.
- [ ] Implementar tabela, índices, vínculo composto, políticas e grants mínimos.
- [ ] Aplicar apenas localmente e executar o teste SQL.
- [ ] Regenerar os tipos com a CLI local.

### Task 2: DTO, token opaco e carregamento seguro

**Files:**
- Modify: `src/modules/members/types/member-credential.types.ts`
- Modify: `src/modules/members/services/member-credential.logic.ts`
- Modify: `src/modules/members/services/member-credential.service.ts`
- Create: `src/modules/members/services/member-credential-token.service.ts`
- Test: arquivos `*.test.ts` correspondentes

**Interfaces:**
- Produces: `prepareMemberCredentialPreview`, `validateMemberCredentialToken`, `revokeMemberCredential` e DTO completo.

- [ ] Escrever testes falhos para mapeamento, fallbacks, CPF, token/hash e tenant.
- [ ] Implementar geração com `randomBytes(32).toString("base64url")` e SHA-256.
- [ ] Carregar todos os campos novamente no servidor e formatar os valores.
- [ ] Implementar criação pendente, ativação, revogação e auditoria sem dados pessoais.
- [ ] Executar os testes focados até passarem.

### Task 3: Renderizador SVG compartilhado

**Files:**
- Create: `src/modules/members/services/member-credential-svg.ts`
- Create: `src/modules/members/services/member-credential-svg.test.ts`
- Add: fonte local licenciada em `src/modules/members/assets/`

**Interfaces:**
- Consumes: DTO completo e matriz QR.
- Produces: `renderMemberCredentialSvg(data, "front" | "back")`.

- [ ] Escrever testes falhos para dimensões, escape XML, linha única, redução de fonte, campos e QR.
- [ ] Implementar helpers puros de texto e o SVG frontal.
- [ ] Implementar o SVG traseiro e os fallbacks de logo.
- [ ] Confirmar que nenhum texto usa quebra de linha ou `foreignObject`.

### Task 4: Prévia e ações

**Files:**
- Modify: `src/modules/members/actions/member-credential.actions.ts`
- Modify: `src/modules/members/components/member-credential-modal.tsx`
- Modify: `src/modules/members/components/member-credential.styles.ts`
- Modify: `src/modules/members/utils/member-credential-view.ts`
- Test: actions e utilitários existentes

**Interfaces:**
- Consumes: SVGs, token pendente e estado de credencial ativa.
- Produces: modal responsivo com frente, verso, download e revogação.

- [ ] Escrever testes falhos para autorização, estado e URLs.
- [ ] Fazer a prévia renderizar diretamente o SVG compartilhado.
- [ ] Restringir CSS à apresentação e incluir revogação explícita.
- [ ] Executar testes focados.

### Task 5: PDF idêntico e endpoint protegido

**Files:**
- Modify: `src/modules/members/services/member-credential-pdf.service.ts`
- Modify: `src/app/api/members/[memberId]/credential/pdf/route.ts`
- Test: testes de PDF e Route Handler existentes
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: token validado e SVGs compartilhados.
- Produces: PDF de duas páginas CR80 a 300 DPI.

- [ ] Escrever testes falhos para POST, token inválido, recarga servidor e páginas CR80.
- [ ] Adicionar dependências fixadas de QR e renderização SVG.
- [ ] Rasterizar ambos os SVGs a 300 DPI e inserir com `pdf-lib`.
- [ ] Mudar download para POST com corpo Zod pequeno e `private, no-store`.
- [ ] Ativar o token e auditar somente após geração bem-sucedida.

### Task 6: Validação pública mínima

**Files:**
- Create: `src/app/verificar/membro/[token]/page.tsx`
- Create: `src/app/verificar/membro/[token]/loading.tsx`
- Create: `src/modules/members/components/member-credential-validation.tsx`
- Create: `src/modules/members/services/member-credential-public.service.ts`
- Test: serviço e página/rota pública

**Interfaces:**
- Consumes: token opaco validado por hash.
- Produces: página dinâmica `no-store` com DTO público mínimo.

- [ ] Escrever testes falhos para válido, revogado, expirado e ausência de PII.
- [ ] Implementar lookup server-only e DTO mínimo.
- [ ] Implementar página dinâmica atrás de Suspense.
- [ ] Verificar cabeçalhos e respostas genéricas.

### Task 7: Qualidade visual, regressão e entrega

**Files:**
- Modify: `e2e/member-physical-credential.spec.ts`
- Create: artefatos temporários somente em `tmp/pdfs/`
- Create: `output/eclesia-atualizado.zip`

**Interfaces:**
- Consumes: fluxo completo.
- Produces: evidências de validação e ZIP limpo.

- [ ] Rodar testes focados, lint, typecheck, suíte completa e build.
- [ ] Gerar PDF de QA, renderizar as duas páginas e inspecionar visualmente.
- [ ] Executar E2E quando houver sessão e membro autorizados; registrar pré-requisito ausente.
- [ ] Validar que a migration está pendente e não foi aplicada remotamente.
- [ ] Criar e testar ZIP sem segredos, dependências, caches ou temporários.
