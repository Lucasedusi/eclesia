# Módulo de Eventos

Implementação do ciclo completo de eventos, com isolamento por igreja e escopo eclesiástico, inscrições individuais e em grupo, itens, lotes, cotas, pagamentos manuais, check-in, documentos privados e relatórios.

## Rotas

- `/eventos`: catálogo administrativo, filtros, paginação e lixeira lógica.
- `/eventos/novo`: criação do evento.
- `/eventos/[eventId]`: workspace operacional por permissões.
- `/eventos/[eventId]/editar`: edição do rascunho/configuração permitida.
- `/eventos/[eventId]/check-in`: leitura de QR Code e busca manual.
- `/inscricoes/[publicCode]/[slug]`: inscrição pública individual ou em grupo.
- `/api/events/[eventId]/reports/[report]`: relatórios XLSX/CSV.
- `/api/cron/events/cleanup`: limpeza de uploads pendentes expirados.

## Segurança e consistência

- Todas as tabelas do módulo usam RLS, permissões granulares e validação de escopo.
- A inscrição pública passa exclusivamente por rota server-side com service role, origem validada, limite de corpo, honeypot, idempotência e rate limit no banco.
- Reserva de vaga, estoque, lote, cota, pagamento, lista de espera e check-in são alterados por RPCs transacionais com bloqueio de concorrência.
- O QR Code expõe somente token aleatório; apenas o hash SHA-256 fica persistido.
- Documentos ficam no bucket privado `event-documents`; banners ficam em `event-public-media`.
- Conteúdo de arquivos é validado por assinatura, não apenas por extensão/MIME declarado.
- Auditoria evita documento, telefone, e-mail, token e outros dados pessoais.

## Operação

Configure um agendador autenticado para chamar diariamente `POST /api/cron/events/cleanup` com `Authorization: Bearer $CRON_SECRET`. A rota remove objetos de uploads que ficaram pendentes além do prazo.

As migrações estão em `supabase/migrations`. A verificação estrutural está em `supabase/tests/events_verification.sql`. O rollback destrutivo e manual está em `supabase/rollback/events_module_rollback.sql`.

## Validação local

```bash
npm run typecheck
npm run lint -- --max-warnings=0
npm test
npm run build
```
