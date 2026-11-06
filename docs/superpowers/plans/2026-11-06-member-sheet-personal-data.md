# Ficha de membro: dados pessoais e apresentação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execução e revisão pelo próprio agente, sem subagentes, conforme pedido.

**Goal:** Completar a ficha com nacionalidade, naturalidade/UF, profissão e escolaridade, seguindo a apresentação aprovada dos relatórios.

**Architecture:** Ampliar a projeção explícita do serviço existente e organizar seus grupos para o renderizador PDF. Reutilizar cabeçalho, marca d'água e fontes compartilhados. Manter o endpoint e as permissões atuais.

**Tech Stack:** Next.js 16, TypeScript, Supabase autenticado, PDF-lib, Vitest e Playwright.

**Spec:** Pedido e autorização direta do usuário em 06/11/2026, limitando os novos campos de membro aos cinco campos de banco `nationality`, `natural_city`, `natural_state`, `profession`, `education_level`.

## Global Constraints

- Sem subagentes; implementação direta autorizada, sem nova etapa de aprovação.
- Preservar permissões, igreja/escopo, exclusão lógica, auditoria e opções de histórico/eventos.
- Não acrescentar tipo, país, início do cargo, igrejas de origem, observações ou notas pastorais à ficha.
- Marca d'água central a 5%, nomes pastorais no cabeçalho, rótulos discretos, endereço mais legível; permitir mais de uma página sem cortar conteúdo.
- Sem migrações nem alterações online; apenas dados fictícios na verificação local.
- Preservar `output/pdf/capinhas-pacoca-a4.pdf`.

## Review Focus

- Naturalidade parcialmente preenchida: exibir cidade ou UF sem separador pendente.
- Novos campos vazios: manter “Não informado”.
- Textos extensos: preservar conteúdo, rodapé e identificação nas páginas seguintes.
- Logo inválida e nomes pastorais vazios: continuar exportando sem decoração vazia.
- Identidade restrita: os novos campos não podem ampliar o acesso a CPF/RG ou notas.

### Task 1: Campos e PDF

**Files:** `src/modules/members/services/member-sheet.service.ts`, `member-sheet-pdf.service.ts`, `member-sheet.fixtures.ts`, respectivos testes, `src/modules/members/types/member-sheet.types.ts`.

**Interfaces:** manter `loadMemberSheetDocument(context, memberId, options)` e `createMemberSheetPdf(data)`. A identidade da igreja admite `pastorNames?: string[]`; grupos continuam usando título e pares rótulo/valor.

- [x] Cobrir projeção e saída dos campos aprovados, naturalidade parcial/vazia, preservação das exclusões e nomes pastorais da igreja correta.
- [x] Executar testes focados e observar falhas esperadas antes da implementação.
- [x] Acrescentar os campos, reorganizar endereço sem acrescentar país, formatar CEP, incorporar identidade visual compartilhada e preservar paginação.
- [x] Verificar PDF real, texto e geometria com dados curtos/longos, sem logo/com logo inválida e várias páginas.

### Task 2: Verificação e documentação

**Files:** `e2e/member-sheet.spec.ts`, `docs/member-sheet-pdf.md` e artefatos fictícios ignorados em `tmp/`.

**Interfaces:** reutilizar POST `/api/members/[memberId]/sheet/pdf` e as opções atuais.

- [x] Executar lint, typecheck, suíte completa e os cenários E2E afetados com Supabase local.
- [x] Renderizar e inspecionar os PDFs; confirmar os campos no download real.
- [x] Revisar diff, atualizar documentação e registrar resultados e limitações.
