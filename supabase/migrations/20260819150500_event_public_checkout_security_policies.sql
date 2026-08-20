begin;

-- Políticas explícitas de negação mantêm as sessões e notificações invisíveis
-- aos clientes. O service_role continua operando apenas pelo backend.
drop policy if exists event_public_checkouts_no_client_access on public.event_public_checkouts;
create policy event_public_checkouts_no_client_access
on public.event_public_checkouts
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists event_payment_webhook_events_no_client_access on public.event_payment_webhook_events;
create policy event_payment_webhook_events_no_client_access
on public.event_payment_webhook_events
for all
to anon, authenticated
using (false)
with check (false);

commit;
