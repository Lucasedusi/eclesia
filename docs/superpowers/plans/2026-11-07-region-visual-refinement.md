# Region visual refinement Implementation Plan

> **For agentic workers:** Execute directly with superpowers:executing-plans; no subagents, per user instruction.

**Goal:** Simplificar Regionais e padronizar a marca nos rodapés PDF.
**Architecture:** Componentes existentes, hook de download regional e variante opcional do cabeçalho PDF. Sem alterações de banco ou autorização.
**Tech Stack:** Next.js 16, React 19, TypeScript, Styled Components, pdf-lib, Vitest, Playwright.
**Spec:** `docs/superpowers/specs/2026-11-07-region-visual-refinement-design.md`

## Global Constraints

- Execução no repositório local em branch própria, sem subagentes; preservar PDF fora do escopo.
- Preservar permissões, filtros, isolamento por igreja, auditoria e paginação completa.
- Consultada documentação local Next.js de CSS-in-JS; não mudar limites Server/Client.

## Review Focus

- Status filtrado deve acompanhar a tela sem seletor adicional (teste de navegador).
- Download direto com falha deve liberar nova tentativa e manter os detalhes (navegador).
- Cabeçalhos extensos precisam caber também nas páginas seguintes (teste PDF).
- Rodapés precisam caber em paisagem e credenciais PVC sem alterar corte/QR (PDF e inspeção).
- Grades compartilhadas não devem modificar Congregações (variante regional e regressões).

### Task 1: Regionais e fluxo de exportação

**Files:** `src/modules/organization/components/{organization-management.tsx,organization.styles.ts,organization-details-modal.tsx,organization-details.styles.ts,region-form.tsx,region-report-modal.tsx}`, novo `hooks/use-region-report.ts`, `e2e/region-reports.spec.ts`.
**Interfaces:** hook `useRegionReport()` recebe `RegionReportOptions`, retorna `busy`, `feedback`, `download`, `setFeedback`; mesmos parâmetros da API atual.
- [x] Atualizar E2E para Filtros, status herdado, ficha direta, recuperação de falha e grades responsivas; observar falha antes da implementação.
- [x] Extrair download e ajustar componentes conforme especificação.
- [x] Executar E2E com dados fictícios locais e revisar capturas.

### Task 2: Cabeçalhos regionais e marca PDF

**Files:** `src/lib/pdf/church-document.ts`, `src/modules/organization/services/region-report-pdf.service.ts`, respectivos testes; geradores PDF em eventos, financeiro e membros.
**Interfaces:** `drawChurchHeader` recebe opções opcionais de linhas de detalhes; chamadas existentes preservam padrão. Rodapés mantêm datas e paginação existentes.
- [x] Atualizar testes regionais para Presidentes, omissões, espaçamento e marca; observar falha.
- [x] Implementar variante do cabeçalho e corpo regional; adicionar Eklesias nos geradores PDF inventariados.
- [x] Executar testes focados, gerar PDFs sintéticos e inspecionar páginas renderizadas.

### Task 3: Verificação e documentação

**Files:** `docs/region-reports.md`, plano e registro local de validação.
- [x] Executar lint, typecheck, npm test e build local, verificando resultados.
- [x] Revisar diff, permissões preservadas e cobertura de todos os geradores PDF; documentar resultado e eventuais limitações.
- [x] Manter mudanças locais para revisão; incorporação à main online autorizada pelo usuário após a revisão.

## Registro de execução

- Base: `faf762fb664271f5004cc1e6a3459d5889c451c6`; branch `codex/ajustes-visuais-regionais` no checkout solicitado.
- Decisão: execução direta autorizada pelo usuário substitui novas etapas de aprovação e uso de subagentes; revisão final feita pelo próprio implementador.
- Baseline: 856 testes. Testes regionais falharam antes da alteração por ausência da marca/remoção da descrição; dois E2E falharam pelo seletor redundante e ausência de download direto. Os dois novos testes de rodapé de credencial falharam antes da inclusão da marca.
- Task 1: complete — 8 E2E passaram; filtros de status/ordenação, todas as páginas, tentativa após erro, grids desktop/móvel e permissões.
- Task 2: complete — 49 testes focados passaram; PDFs sintéticos gerados e revisados visualmente; limites e rodapés de credenciais preservados.
- Task 3: complete — 858 testes em 135 arquivos; lint, tipagem e build aprovados. Revisão do diff sem alterações de serviços de autorização ou migrações. Dados e arquivos temporários de teste permanecem ignorados pelo Git.
- Ajuste posterior: removido “Cargos ativos”, com grade de três colunas; lint, tipagem e 858 testes aprovados novamente.
- Incorporação à main online autorizada após revisão pelo usuário; PDF local fora do escopo preservado.
