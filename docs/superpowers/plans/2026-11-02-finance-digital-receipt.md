# Comprovante digital Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execução e revisão diretas, sem subagentes, conforme solicitação do usuário.

**Goal:** Compartilhar um comprovante digital nos detalhes por link manual do WhatsApp.
**Architecture:** Emissão autenticada de token com hash em tabela isolada; leitura pública restrita ao recibo ainda válido; renderização HTML e PDF a partir de projeção mínima.
**Tech Stack:** Next.js 16, React 19, Supabase, Zod, pdf-lib, Rubik, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-11-02-finance-digital-receipt-design.md

## Global Constraints

- Somente detalhes. Não modificar novo lançamento ou impressão térmica.
- Sem subagentes ou operações remotas. Banco e dados de teste exclusivamente locais.
- Token de 256 bits com hash; validade 30 dias; telefone não persistido.
- RLS/grants mínimos e verificações de igreja/congregação. Não compartilhar recibo cancelado/substituído.

## Review Focus

- Reabertura, erro de rede e múltiplos cliques não devem impedir retorno aos detalhes.
- Correção posterior não pode deixar um link antigo válido.
- Atendimento com muitos itens e nomes longos não pode truncar valores ou estourar o PDF.
- Link e telefone não podem aparecer em logs, metadados sociais ou dados de auditoria.
- Público sem sessão deve funcionar em tela pequena e sem cache privado.

### Task 1: Acesso e contrato digital

**Files:** nova migração finance_digital_receipt_links; finance-digital-receipt.service.ts e .test.ts; finance-digital-receipt.ts e .test.ts em utils; schemas/types digitais; action de emissão; supabase/tests/finance_digital_receipts.sql.
**Interfaces:** createFinanceDigitalReceiptLink(context, receiptId) -> {url, expiresAt}; loadPublicFinanceReceipt(token) -> DigitalReceipt | null; buildReceiptWhatsAppUrl(phone, url) -> string.
- [x] Escrever testes de telefone, URL, projeção e autorização e observar falha.
- [x] Implementar migração, emissão e leitura com limite persistente.
- [x] Executar testes direcionados e SQL local; regenerar tipos.

### Task 2: Documento público e PDF

**Files:** finance-digital-receipt-html.ts; finance-digital-receipt-pdf.service.ts; src/app/comprovante/[token]/route.ts e pdf/route.ts; src/proxy.ts; next.config.ts.
**Interfaces:** renderFinanceDigitalReceipt(data, pdfPath) -> HTML; createFinanceDigitalReceiptPdf(data) -> Uint8Array. Consome loadPublicFinanceReceipt.
- [x] Testar HTML malicioso, ausência de dados internos, PDF multipágina e respostas públicas.
- [x] Implementar cartão responsivo e PDF com texto vetorial, quebra de linhas e paginação.
- [x] Verificar testes e renderizar PDF para inspeção visual.

### Task 3: Janela nos detalhes e validação integrada

**Files:** finance-transaction-details.tsx; finance-digital-receipt-dialog.tsx; estilos locais; e2e/finance-digital-receipt.spec.ts; documentação de validação.
**Interfaces:** diálogo recebe link pronto e recibo resumido; cria URL de WhatsApp localmente, sem enviar telefone ao servidor.
- [x] Testar ausência no cadastro e fluxo desktop/mobile com navegação externa simulada.
- [x] Implementar abertura, telefone, prévia, PDF, erro e retorno aos detalhes.
- [x] Executar lint, typecheck, todos Vitest, build, E2E digital e térmico; revisar diff diretamente.
- [x] Registrar evidências, limitações e encerrar serviços de teste. Manter branch local, sem publicar ou integrar main.

## Execution log

- Base: 6919cb9, branch codex/finance-digital-receipt. Escopo implementado conforme autorização expressa, sem novo ciclo de aprovação de design.

- Concluído: emissão/consumo, página e PDF, janela nos detalhes, testes e revisão direta.
- Validação final: 666 testes Vitest, 10 E2E na versão de produção local, lint, typecheck, build e SQL passaram. Advisors: 13 avisos existentes, nenhum nos novos objetos.
- Evidências e publicação: `docs/finance/digital-receipt-validation.md`. Banco local encerrado com backup; nenhuma operação remota realizada.
