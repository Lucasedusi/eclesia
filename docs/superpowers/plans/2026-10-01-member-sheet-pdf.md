# Member Sheet PDF Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Execução nativa, sem subagentes, por solicitação explícita do usuário.

**Goal:** Exportar a ficha A4 do membro com histórico não sensível e eventos opcionais.

**Architecture:** DTO exclusivo para impressão, carregado no servidor com autorização por seção; renderer PDF isolado; Route Handler POST e modal de seleção usando os componentes existentes.

**Tech Stack:** Next.js 16, React 19, Supabase autenticado, Zod, pdf-lib/fontkit, Styled Components, Vitest e Playwright.

**Spec:** `docs/superpowers/specs/2026-10-01-member-sheet-pdf-design.md`

## Global Constraints

- Contribuições, notas pastorais, registros sensíveis e documentos não entram nesta entrega.
- Eventos seguem a consulta do modal, incluindo inscrições pagas e gratuitas.
- Dados atuais, todas as páginas, permissões e escopos preservados.
- Sem dependências novas, migrações desnecessárias ou subagentes.

## Review Focus

- Membro de outra igreja/escopo ou arquivado não produz documento.
- Privilégios de administrador não incluem conteúdo sensível no histórico exportado.
- Histórico/eventos com mais de 20 registros não são truncados.
- Nomes, endereço e descrições longos não sobrepõem conteúdo/rodapé.
- Falha de consulta/auditoria não resulta em PDF incompleto ou mensagem interna.

### Task 1: Dados e regras da ficha

**Files:** criar `types/member-sheet.types.ts`, `validations/member-sheet.schemas.ts`, `services/member-sheet.service.ts` e testes no domínio de membros; atualizar capabilities e filtro do histórico em `member.service.ts`.

**Interfaces:** produzir `MemberSheetOptions`, `MemberSheetDocument`, `MemberSheetError`, `loadMemberSheetDocument(context, memberId, options)`; manter `getMemberEvents` compartilhado e acrescentar `includeSensitive` opcional em `getMemberHistory`.

- [x] Escrever testes para seleção padrão, permissão da ficha/seções, campos permitidos, igreja/membro/soft delete, histórico não sensível, paginação integral e falhas de consulta.
- [x] Executar os testes e observar falhas por comportamento ausente.
- [x] Implementar schema, DTO e serviço sem buscar notas/documentos/financeiro.
- [x] Rodar testes focados e suite; registrar resultado.

### Task 2: PDF A4

**Files:** criar `services/member-sheet-pdf.service.ts`, testes e fixture sintética para verificação.

**Interfaces:** consumir `MemberSheetDocument`; produzir `createMemberSheetPdf(document): Promise<Uint8Array>`.

- [x] Testar PDF A4, conteúdo selecionado, ausência das seções não selecionadas, caracteres acentuados, textos longos e múltiplas páginas.
- [x] Observar os testes falharem; implementar o renderer com fontes locais e layout baseado no modelo.
- [x] Renderizar PDFs sintéticos e inspecionar as páginas; verificar sem logotipo e com PNG/WebP.
- [x] Rodar testes focados e suite; registrar resultado.

### Task 3: Download, interface e entrega

**Files:** criar `src/app/api/members/[memberId]/sheet/pdf/route.ts` e testes; criar `member-sheet-modal.tsx`/estilos; integrar em `member-details-modal.tsx`; criar `e2e/member-sheet.spec.ts`.

**Interfaces:** POST `{ includeHistory: boolean, includeEvents: boolean }`; resposta `application/pdf` com nome seguro e `private, no-store`. Serviço de download registra auditoria existente após gerar o arquivo.

- [x] Testar autenticação, origem, validação/limite de corpo, erros genéricos, opções e cabeçalhos; observar falhas antes da implementação.
- [x] Implementar endpoint e modal com seleções desmarcadas, feedback e bloqueio durante geração.
- [ ] Testar navegador: abrir ficha, baixar básica/complementada, opções condicionadas às permissões, falha recuperável e dispositivo estreito.
- [x] Rodar lint, typecheck, suite, build e E2E; revisar o diff e as exclusões de dados.
- [ ] Criar ZIP do projeto e verificar integridade e exclusão de segredos/arquivos locais.

## Resultado da execução

Execução nativa sem subagentes. Os testes de navegador foram preparados, mas permanecem pendentes: faltam sessão e membro de teste autorizados; banco local e prévia local não tiveram autorização para iniciar. O build padrão foi bloqueado pelo ambiente; a compilação foi validada com Webpack. Ver `docs/member-sheet-pdf.md` para resultados e instruções de uso.
