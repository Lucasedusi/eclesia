# Ranking e entrega de relatórios — plano de implementação

> Execução direta com superpowers:executing-plans, sem subagentes, conforme autorização do usuário.

**Objetivo:** entregar ranking financeiro e controle administrativo de recebimentos para teste local.
**Especificação:** proposta aprovada no chat em 22/10/2026: saldo final acumulado, catedral somente no ranking, ativas por padrão com opção de inativas; PDF limpo, totais e colunas opcionais; entregas por mês, filtros, data, prazo versionado e histórico.
**Arquitetura:** leitura do ranking reutiliza a projeção mensal existente em uma única consulta consistente. Recebimentos aproveitam report_deliveries e acrescentam eventos imutáveis e regras de prazo versionadas. Serviços validam acesso ADMIN/CHURCH e DTOs; ações e PDFs repetem autorização. Sem pagamentos automáticos.
**Stack:** Next 16/React 19/TypeScript/Supabase/Zod/pdf-lib/Vitest/Playwright.

## Restrições e decisões
- Branch codex/finance-ranking-deliveries; não publicar na main.
- Autorização online do Supabase dada neste chat permanece válida; somente migrações após validação local, nunca fixtures remotas.
- Prebenda bruta após teto, repasse percentual elegível; ausências geram total parcial, não zero completo.
- Configuração inicial padrão dia 8; novas regras valem a partir do mês de referência atual ou futuro. Histórico de meses anteriores permanece estável.
- Data de entrega civil em São Paulo, após encerramento do mês de referência e nunca futura. Responsável pelo registro é obtido da sessão.
- Correções/desfazimentos exigem motivo, revisão esperada e chave idempotente; nenhum dado financeiro é criado.
- Modelos globais deixam explícito que não usam a unidade selecionada no cabeçalho.

## Tarefas
- [x] Banco: testes SQL para ranking, filtros, somas, ausência, acesso; entrega sem demonstrativo, datas, correção, desfazimento, prazo histórico, duplicação e auditoria. Migração nova em supabase/migrations; teste supabase/tests/finance_administrative_reports.sql.
- [x] Contratos: finance-administrative.schemas.ts e types; utilitários de soma/classificação com testes de limites e dados parciais. Serviço finance-administrative.service.ts e ações finance-delivery.actions.ts com testes de autorização.
- [x] PDFs: ampliar finance-report-pdf.service.ts com ranking/totais e entrega/contagem usando o cabeçalho e tabelas existentes; testes de opções, filtros e paginação.
- [x] Interface: ranking no seletor FinanceReports; página relatorios/entregas com filtros e modal de recebimento/histórico. Configuração de prazo nas configurações financeiras; estilos responsivos existentes.
- [x] Validação: SQL local, advisors, tipos regenerados; lint/typecheck/testes/build; E2E autorizado com fixtures locais e PDF renderizado. Revisão direta de segurança e diff; documentar resultados e deixar branch pronta para teste.

## Foco de revisão
- Cadastro inativo não pode desaparecer quando solicitado; catedral nunca deve criar pendência de entrega.
- Empates ordenados por nome, totais seguros em centavos e saldo apenas na data final.
- Meses sem demonstrativo não podem transformar valores desconhecidos em total completo.
- Repetição/conflito de recebimento não pode duplicar evento nem sobrescrever outra correção.
- Regras novas de prazo não podem reclassificar entregas antigas; datas no fim de fevereiro e virada do ano.
