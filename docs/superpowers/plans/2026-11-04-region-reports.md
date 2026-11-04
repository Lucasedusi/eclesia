# Relatórios de regionais — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans, sem subagentes por instrução do usuário. Execução direta já autorizada.

**Goal:** Exportar lista simplificada em PDF/XLSX e ficha individual em PDF.
**Architecture:** Serviço autenticado de organização consulta DTO mínimo; geradores server-only produzem arquivos; POST validado audita cada emissão; modal compartilhado atende os dois pontos de entrada.
**Tech Stack:** Next.js 16, React 19, Supabase, Zod, pdf-lib, ExcelJS, Vitest, Playwright.
**Spec:** `docs/superpowers/specs/2026-11-04-region-reports-design.md`

## Global Constraints

- Sem subagentes. Branch `codex/relatorios-regionais`. Sem dependências novas.
- WhatsApp → Telefone → `Não informado`.
- Preservar RLS, escopos, igreja, soft delete e auditoria sem dados pessoais.
- Migração nova e imutável; banco online autorizado, dados de teste somente localmente.

## Review Focus

- Registros acima de uma página de consulta: exportação completa ou erro explícito (tarefa 1).
- Escopo congregacional: não apresentar subconjunto como toda a regional (tarefa 1).
- Textos grandes e caracteres fora da fonte: conteúdo legível dentro da folha (tarefa 2).
- Valores de planilha iniciados com `=`: continuar como texto (tarefa 2).
- Download falha/duplo clique/fechamento e retorno ao modal: recuperação sem perder contexto (tarefa 3).

### Task 1: Contrato, dados e autorização

**Files:** `src/modules/organization/{types,validations,services}/region-report.*`, `src/modules/auth/constants/permissions.ts`, `supabase/migrations/*_region_reports_export_permission.sql`, `supabase/tests/region_reports_verification.sql`.
**Interfaces:** `regionReportSchema`; `RegionReportOptions`; `RegionReportDocument`; `loadRegionReportDocument(context, options)`; `generateRegionReportDownload(context, options)`.
- [x] Escrever e executar testes falhando: permissões, campos mínimos, contato, filtros, escopo e paginação.
- [x] Implementar schema, DTO, serviço e migração de permissão ADMIN/SECRETARY.
- [x] Executar testes focados e verificação SQL local.

### Task 2: Documentos

**Files:** `src/lib/pdf/church-document.ts`, `src/modules/members/services/member-sheet-pdf.service.ts`, `src/modules/organization/services/region-report-{pdf,workbook}.service.ts` e testes.
**Interfaces:** `createRegionReportPdf(document): Promise<Uint8Array>`; `createRegionReportWorkbook(document): Promise<Buffer>`; helpers PDF compartilhados.
- [x] Testes falhando para PDF paginado, textos longos, dados ausentes e XLSX texto/filtros.
- [x] Extrair helpers limitados e implementar documentos.
- [x] Executar testes novos e regressão da ficha do membro; renderizar PDFs sintéticos e inspecionar.

### Task 3: Endpoint e interface

**Files:** `src/app/api/organization/regions/reports/route.ts`, `src/modules/organization/components/region-report-modal.tsx e region-report.styles.ts`, `organization-management.tsx`, `organization-details-modal.tsx`, `organization.service.ts`, `organization.types.ts`, `e2e/region-reports.spec.ts`.
**Interfaces:** POST recebe `RegionReportOptions` e devolve attachment PDF/XLSX; `RegionReportModal` recebe regionais, filtros e regional inicial opcional.
- [x] Testes falhando de endpoint: sessão, permissão, validação, origem, resposta e falhas seguras.
- [x] Implementar endpoint, permissão de UI independente de edição, modal e retorno aos detalhes.
- [x] Executar E2E local de PDF/XLSX, ficha individual, erro e tela estreita.

### Task 4: Verificar e aplicar

**Files:** documentação de uso e histórico de verificação.
- [x] Lint, typecheck, suíte completa e build; revisar diff e segurança sem subagentes.
- [x] Validar migração, grants/RLS e advisors localmente; conferir estado remoto e aplicar somente a migração desta entrega.
- [x] Regenerar tipos, conferir migração online, documentar resultados e limitações reais.
- [x] Registrar commit na branch.
