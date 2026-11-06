# Listagens de membros — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Execução e revisão próprias, sem subagentes, na branch existente `codex/ficha-membro-dados-pessoais`.

**Goal:** Exportar listagem simplificada em PDF/XLSX, completa em XLSX e personalizada em PDF/XLSX com matrícula/nome fixos e até quatro campos opcionais.

**Architecture:** Catálogo explícito de campos compartilhado por validação/interface; serviço autenticado próprio para leitura paginada e projeção mínima; renderizadores PDF e ExcelJS; POST privado e modal carregado sob demanda na página de membros.

**Tech Stack:** Next.js 16, React, TypeScript, Styled Components, Zod, Supabase, PDF-lib, ExcelJS, Vitest e Playwright.

**Spec:** Avaliação e recomendações aprovadas pelo usuário em 06/11/2026. Observações pastorais restritas excluídas expressamente. Alterações de banco autorizadas se necessárias; nenhuma prevista nesta solução.

## Global Constraints

- Simplificada: Matrícula, Nome do Membro, Congregação, WhatsApp, Cargo atual, nessa ordem.
- Completa: campos cadastrais atuais, uma linha por membro; endereço/naturalidade em colunas separadas; observações gerais incluídas. Sem anexos, finanças, linha do tempo, notas pastorais, identificadores técnicos ou histórico de cargos.
- Personalizada: dois campos fixos, de zero a quatro opcionais distintos; catálogo agrupado, contador e limite no cliente e servidor. Naturalidade/UF e endereço completo são opções compostas.
- Todos os registros não arquivados autorizados ou resultados dos filtros (busca, regional, congregação, cargo, situação, tipo, lote, arquivados e ordenação). Limite de 10.000 registros antes da busca textual, como nos relatórios existentes, sem truncamento silencioso.
- Requer members.view_basic, members.view_full e members.export. CPF/RG exigem members.view_sensitive_identity; cargo exige member_roles.view; arquivados exigem members.restore. Em escopo de ministério, a consulta dos vínculos exige ministries.view e é restrita ao ministério do contexto.
- PDF reutiliza identidade, marca d'água 5%, nomes pastorais, quebra de linhas, cabeçalhos repetidos, contagem e rodapé. Personalizada em paisagem com seis colunas ou campos extensos; simplificada em retrato.
- XLSX com filtros, painéis congelados, datas utilizáveis e textos literais, preservando zeros iniciais. Dados não informados claramente identificados.
- Auditoria registra formato/tipo/colunas/quantidade/presença de filtros, sem dados pessoais ou texto pesquisado. Falha impede download.
- Preservar trabalho anterior da ficha e `output/pdf/capinhas-pacoca-a4.pdf`. Não publicar nem alterar banco remoto.

## Review Focus

- CPF/RG/cargo solicitados sem permissão; notas pastorais injetadas no payload.
- Escopos regional, congregacional e ministerial, dados de outra igreja e arquivados.
- Mais de uma página de consulta, resultados vazios, contagem alterada e registros duplicados.
- Textos extensos, seis colunas, logos inválidas e nomes pastorais nas páginas seguintes.
- Literais iniciados por `=`, telefones/CEP/CPF com zeros, recuperação de erro e clique duplicado.

### Task 1: Catálogo, validação e leitura

**Files:** `src/modules/members/constants/member-report-fields.ts`, `validations/member-report.schemas.ts`, `types/member-report.types.ts`, `services/member-report.service.ts` e respectivos testes.

**Interfaces:** `MemberReportFieldKey`; `memberReportSchema`; `loadMemberReportDocument(context, options)` produz colunas e linhas de valores seguros. `generateMemberReportDownload` renderiza e audita.

- [x] Escrever testes de catálogo/limites/permissões/projeção/filtros/escopos/paginação e observar falhas.
- [x] Implementar leitura paginada com cliente autenticado, filtros de igreja/escopo/exclusão e seleção explícita apenas dos campos necessários.
- [x] Validar falhas de consulta e auditoria sem expor informações internas.

### Task 2: Documentos

**Files:** `services/member-report-pdf.service.ts`, `member-report-workbook.service.ts`, testes de documentos com dados fictícios.

**Interfaces:** `createMemberReportPdf(document)` e `createMemberReportWorkbook(document)` recebem o mesmo DTO.

- [x] Testar documentos reais com formatos, campos, paginação, vazios, textos extensos, identidade visual e literais de planilha.
- [x] Implementar renderizadores; gerar amostras fictícias e inspecionar visualmente.

### Task 3: Endpoint, interface e validação final

**Files:** `src/app/api/members/reports/route.ts`, hook/modal/estilos em members, integração em `member-management.tsx`, testes de rota, `e2e/member-reports.spec.ts`, harness local e `docs/member-reports.md`.

**Interfaces:** POST `/api/members/reports`; modal recebe filtros atuais e capacidades existentes, sem informações de igreja vindas do cliente.

- [x] Cobrir autenticação, permissões, origem, limite de corpo e validação estrita do endpoint.
- [x] Implementar botão e modal estável, opções de formato/abrangência/campos, feedback e proteção de clique duplicado.
- [x] Executar lint, typecheck, suíte completa, build e E2E local com dados fictícios; revisar arquivos baixados, segurança e diff.
- [x] Documentar resultados, limites e revisão própria; remover dados fictícios locais.

## Revisão própria

- Catálogo compartilhado, payload estrito, somente os campos selecionados atravessam o serviço de exportação. Observações pastorais não são lidas.
- Testes locais confirmaram igreja, arquivo, identidade restrita, cargo, todos os escopos e um acesso regional com segundo vínculo mais amplo.
- A política de congregações impede leitura por escopo exclusivamente ministerial. A listagem usa relação opcional e marca o nome como indisponível nesse caso, preservando os membros autorizados e as políticas existentes. Restrições regionais continuam usando relação obrigatória.
- PDFs reais revisados em retrato e paisagem, com e sem marca d'água; testes também verificam texto extenso, campos inteiros e cabeçalhos repetidos. A revisão visual levou ao ajuste das larguras mínimas de matrícula, CPF e telefone.
- Excel reaberto com ExcelJS, conferindo datas, texto literal, zeros iniciais, filtros e congelamento.
- Interface verificada em desktop e celular; seleção limitada a quatro extras, tamanho estável, recuperação após erro e bloqueio de download duplicado.
- Nenhum esquema, política, tipo gerado ou dado remoto foi alterado. Não houve publicação nem envio para o repositório remoto.

## Resultado da verificação — 06/11/2026

- `npm run lint -- --max-warnings=0`: aprovado.
- `npm run typecheck`: aprovado.
- `npm test`: 856 testes em 135 arquivos aprovados.
- `node scripts/member-reports-local.mjs build` (`npm run build`, configurações locais): aprovado.
- `node scripts/member-reports-local.mjs e2e`: sete cenários de navegador aprovados na versão final.
- `git diff --check`: aprovado.
- PDFs renderizados e inspecionados em retrato/paisagem; amostra de observação extensa preservada por inteiro. Planilhas reabertas e conferidas.
- Dados e sessões fictícios removidos; servidor local de teste encerrado. Alterações permanecem na mesma branch, sem commit ou publicação.
- Verificações de migração, regeneração de tipos e Advisors não se aplicam: não houve migração nem mudança de esquema, políticas ou configuração de banco. Nenhum teste obrigatório de aplicação ficou pendente.
