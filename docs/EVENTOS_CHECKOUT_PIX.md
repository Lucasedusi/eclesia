# Checkout público de eventos e Pix

## Configuração do ambiente

Copie as variáveis documentadas em `.env.example` para o ambiente de execução:

- `MERCADO_PAGO_ENV=test` durante desenvolvimento e homologação;
- `MERCADO_PAGO_ACCESS_TOKEN`: Access Token da aplicação Mercado Pago, somente no servidor;
- `MERCADO_PAGO_WEBHOOK_SECRET`: assinatura secreta configurada em Webhooks;
- `MERCADO_PAGO_WEBHOOK_URL`: URL HTTPS pública do endpoint de notificação;
- `MERCADO_PAGO_PIX_EXPIRATION_MINUTES=30`;
- `EVENT_CREDENTIAL_SECRET`: segredo aleatório com pelo menos 32 caracteres, independente dos demais segredos;
- `EVENT_CHECKOUT_SECRET`: segredo aleatório com pelo menos 32 caracteres para os tokens opacos de checkout;
- `NEXT_PUBLIC_SITE_URL`: origem pública da aplicação.

Nunca use credencial de produção durante os testes e nunca prefixe Access Token ou segredo de Webhook com `NEXT_PUBLIC_`.

## Webhook Mercado Pago

Cadastre no painel do Mercado Pago:

```text
https://SEU-DOMINIO/api/payments/webhooks/mercado-pago
```

Selecione notificações de pagamentos. A rota valida `x-signature`, `x-request-id` e `data.id`, consulta novamente o pagamento no provedor e só então atualiza a inscrição.

## Banco de dados

As migrations desta entrega são:

1. `20260819143000_event_public_checkout_pix.sql`;
2. `20260819150500_event_public_checkout_security_policies.sql`.

Elas criam a sessão opaca de checkout, campos de conciliação, histórico idempotente de Webhooks e funções transacionais. As tabelas sensíveis têm RLS ativo, negação explícita para `anon` e `authenticated` e acesso somente do backend via `service_role`.

## Fluxos de teste

### Inscrição gratuita

1. Abra a página pública de um evento com total zero.
2. Preencha os dados e confirme.
3. Verifique o salto da etapa de pagamento.
4. Baixe o PDF e valide o QR Code da credencial no check-in.

### Pix em teste

1. Use um evento público com inscrições abertas e item com valor.
2. Selecione Pix, conclua os dados e informe e-mail e CPF válidos de teste.
3. Gere o QR Code e valide código Copia e Cola, valor e vencimento.
4. Conclua o pagamento no ambiente de teste do Mercado Pago.
5. Aguarde a atualização automática ou use “Já paguei — verificar novamente”.
6. Confirme que comprovante e credencial só aparecem após o status aprovado.

### Pagamento presencial

1. Selecione Dinheiro, Cartão de Débito ou Cartão de Crédito.
2. Confirme que nenhum dado de cartão é solicitado.
3. Verifique o protocolo e a credencial bloqueada.
4. Registre a quitação no modal interno de pagamento.
5. Reabra/atualize a página pública e confirme a liberação da credencial.

### Expiração e idempotência

1. Gere um Pix e aguarde o vencimento configurado.
2. Execute `POST /api/cron/events/cleanup` com `Authorization: Bearer $CRON_SECRET`.
3. Confirme a expiração da reserva e a opção de gerar novo Pix sem duplicar a inscrição.
4. Repita uma requisição com a mesma `idempotency-key` e confirme que não surgem inscrição ou cobrança duplicadas.

## Verificações recomendadas antes da produção

- trocar credenciais de teste por credenciais de produção apenas no gerenciador seguro do ambiente;
- manter o Webhook em HTTPS e validar a entrega no painel do Mercado Pago;
- agendar a limpeza de eventos/checkouts;
- testar aprovação, rejeição, expiração e estorno;
- confirmar que Access Token, segredo do Webhook, CPF e código Pix não aparecem em logs;
- executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
