# Member Visual Refinement Implementation Plan

**Goal:** implementar o escopo aprovado sem modificar a identidade do Financeiro.
**Architecture:** manter Server/Client boundaries, consultas autenticadas e escopos; novos helpers pequenos no domínio e estilos opt-in compartilhados.
**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Styled Components, pdf-lib, ExcelJS.
**Spec:** docs/superpowers/specs/2026-11-09-member-visual-refinement.md

## Global Constraints
Sem subagentes. Sem banco online. Sem alterar o PDF fora do escopo. Respeitar permissões, RLS, auditoria, filtros e histórico.

## Review Focus
- Ativos como padrão não pode impedir Todos/Arquivados ou links existentes.
- Nomes históricos e variantes explícitas não podem ser reescritos pelo cargo atual.
- Financeiro: outra igreja/unidade/membro, paginação, cancelados e erros não podem gerar totais incorretos.
- Campos globais não podem alterar Financeiro, upload, checkbox ou controles desabilitados.
- Nomes longos e PDFs multipágina não podem cortar dados.

## Task 1: Listagem, histórico e apresentação cadastral
- [x] Testar default/total, traduções e nomes históricos antes de corrigir.
- [x] Atualizar member.service, member-formatters, member-management e member-details-modal/styles.
- [x] Verificar os testes específicos e registrar resultado.

## Task 2: Formulários e padrão visual
- [x] Criar padrão opt-in em src/styles; aplicar apenas módulos aprovados.
- [x] Remover badge, limitar novos tipos e ampliar revisão por assunto.
- [x] Verificar navegação, edição de tipos legados e estados de campos em E2E.

## Task 3: Consulta e relatório financeiro individual
- [x] Reproduzir consulta ambígua; testar permissões, intervalos, totais e paginação.
- [x] Criar serviço específico, schema, renderers PDF/XLSX e endpoint autenticado de exportação com auditoria.
- [x] Criar aba financeira dedicada com filtros por período, estados de erro e download.
- [x] Verificar arquivos reabertos e escopos com dados locais sintéticos.

## Task 4: PDFs e validação final
- [x] Padronizar cabeçalhos/nome pessoal nos PDFs de listagem sem alterar banco.
- [x] Rodar testes focados, lint, typecheck, suíte completa e build.
- [x] Rodar E2E afetado, renderizar PDFs/capturas e revisar diff sem subagentes.
- [x] Limpar fixtures locais e documentar resultados.

## Resultado — 09/11/2026

- Execução direta na branch `codex/ajustes-visuais-membros`, base `3ac156f`.
- `npm test`: 911 testes aprovados em 142 arquivos.
- `npm run lint -- --max-warnings=0`, `npm run typecheck` e build de produção com configuração local: aprovados.
- Playwright: 15 cenários aprovados (listagens, indicadores, filtros, histórico feminino/traduções, altura do modal, finance PDF/XLSX completo, permissões/igrejas, revisão, tipo legado, desktop/celular e controles administrativos). Capturas adicionais após estabilização dos modais: aprovadas.
- Consulta antiga reproduzida com `PGRST201` no Supabase local; consulta corrigida confirmou 25 lançamentos, total confirmado de R$ 240 e cancelado de R$ 10.
- PDFs simplificado, personalizado e financeiro renderizados e inspecionados; arquivos XLSX reabertos para validar conteúdo e tipos das células.
- Revisão direta do diff: sem mudanças de banco, dependências, estilos do módulo Financeiro ou dados reais. Permissões, filtros, limites, auditoria e isolamento revisados.
- Fixtures locais, sessões fictícias e servidores de teste removidos/encerrados. O arquivo `output/pdf/capinhas-pacoca-a4.pdf` permanece fora da entrega.
- Verificações SQL/advisors não aplicáveis: nenhuma migração ou alteração de políticas. Análise de bundles não aplicável: não há objetivo de otimização de carregamento. E2E executado nos fluxos afetados, sem rodar módulos não relacionados.
