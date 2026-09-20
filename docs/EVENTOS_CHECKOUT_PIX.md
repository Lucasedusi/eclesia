# Checkout público de eventos e Pix

## Configuração do ambiente

Copie as variáveis documentadas em `.env.example` para o ambiente de execução:

- `MERCADO_PAGO_ENV=test` durante desenvolvimento e homologação; nesse modo a aplicação confirma em `/users/me` que a credencial pertence a um `test_user` e usa os dados predefinidos exigidos pelo sandbox;
- `MERCADO_PAGO_ACCESS_TOKEN`: Access Token da aplicação Mercado Pago, somente no servidor;
- `MERCADO_PAGO_WEBHOOK_SECRET`: assinatura secreta configurada em Webhooks;
- `MERCADO_PAGO_PIX_EXPIRATION_MINUTES=30` (a aplicação aceita de 30 a 60 minutos e acrescenta uma margem mínima efetiva de 1 minuto para a latência da chamada);
- `EVENT_CREDENTIAL_SECRET`: segredo aleatório com pelo menos 32 caracteres, independente dos demais segredos;
- `EVENT_CHECKOUT_SECRET`: segredo aleatório com pelo menos 32 caracteres para os tokens opacos de checkout;
- `EVENT_PAYMENT_MOCK_ENABLED=true`: usa o simulador local somente fora de produção;
- `NEXT_PUBLIC_SITE_URL`: origem pública da aplicação.

Nunca use credencial de produção durante os testes e nunca prefixe Access Token ou segredo de Webhook com `NEXT_PUBLIC_`.

## Webhook Mercado Pago

Cadastre no painel do Mercado Pago:

```text
https://SEU-DOMINIO/api/payments/webhooks/mercado-pago
```

Selecione o evento **Order (Mercado Pago)**. O evento **Pagamentos (legacy)** não é usado pelas cobranças novas. A rota valida `x-signature`, `x-request-id` e `data.id`, consulta novamente a order no provedor e só então atualiza a inscrição.

As cobranças Pix são criadas pela Orders API (`POST /v1/orders`). O identificador `ORD...` é mantido como recurso principal do provedor e o identificador da transação `PAY...` fica nos metadados do pagamento para auditoria e conciliação. Pagamentos antigos com ID numérico continuam consultáveis pela Payments API apenas para compatibilidade.

## Teste local com URL pública HTTPS

O simulador local continua disponível para desenvolver a interface sem chamar o Mercado Pago. Para testar a integração real usando credenciais de teste, exponha o servidor local por um túnel HTTPS:

1. Inicie a aplicação com `npm run dev`.
2. Em outro terminal, abra um túnel com `ssh -R 80:localhost:3000 nokey@localhost.run`.
3. Copie a URL HTTPS informada pelo túnel, sem reutilizar uma URL antiga.
4. No `.env.local`, configure `NEXT_PUBLIC_SITE_URL` com essa origem.
5. Defina `EVENT_PAYMENT_MOCK_ENABLED=false`, `MERCADO_PAGO_ENV=test` e mantenha somente o Access Token do usuário de teste.
6. Cadastre a mesma URL de webhook no painel do Mercado Pago, selecione **Order (Mercado Pago)** e reinicie `npm run dev` para recarregar o ambiente.

O túnel torna o servidor local acessível pela internet. Mantenha-o ativo apenas durante o teste e nunca coloque tokens, segredos, CPF ou código Pix na linha de comando ou em logs.

Se preferir Cloudflare Tunnel ou ngrok, o requisito é o mesmo: uma URL HTTPS pública encaminhada para `http://localhost:3000`, usada como origem da aplicação e cadastrada no painel do Mercado Pago com o caminho `/api/payments/webhooks/mercado-pago`.

## Banco de dados

As migrations desta entrega são:

1. `20260819143000_event_public_checkout_pix.sql`;
2. `20260819150500_event_public_checkout_security_policies.sql`.

Elas criam a sessão opaca de checkout, campos de conciliação, histórico idempotente de Webhooks e funções transacionais. As tabelas sensíveis têm RLS ativo, negação explícita para `anon` e `authenticated` e acesso somente do backend via `service_role`.

A migração da Payments API para a Orders API não exige alteração adicional de schema: `provider_payment_id` guarda o ID da order e o ID da transação é preservado no campo `metadata` já existente.

## Fluxos de teste

### Inscrição gratuita

1. Abra a página pública de um evento com total zero.
2. Preencha os dados e confirme.
3. Verifique o salto da etapa de pagamento.
4. Baixe o PDF e valide o QR Code da credencial no check-in.

### Pix em teste

1. Use um evento público com inscrições abertas e item com valor.
2. Selecione Pix, conclua os dados e informe e-mail e CPF válidos. Com `MERCADO_PAGO_ENV=test`, a aplicação envia ao sandbox o e-mail `test_user_br@testuser.com` e o nome de aprovação `APRO`, mantendo o e-mail informado apenas na inscrição local.
3. Gere o QR Code e valide código Copia e Cola, valor e vencimento.
4. Aguarde a aprovação automática da order de teste pelo Mercado Pago.
5. Aguarde o webhook de order ou use “Já paguei — verificar novamente”.
6. Confirme que comprovante e credencial só aparecem após o status aprovado.
7. Confirme no histórico de Webhooks do Mercado Pago que o endpoint respondeu com sucesso.

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
4. Dispare duas solicitações simultâneas para gerar o Pix e confirme que a chave idempotente calculada no servidor impede cobranças duplicadas.

## Proteções do fluxo público

- a chave idempotente da cobrança é calculada no servidor e muda somente quando uma nova tentativa é necessária após a cobrança anterior terminar;
- os endpoints de pagamento e webhook limitam o corpo JSON a 16 KB;
- a criação do Pix permite 6 tentativas por checkout a cada 10 minutos;
- a atualização no provedor permite 60 tentativas por checkout a cada 10 minutos, compatível com a consulta automática da tela;
- excesso de tentativas retorna `429` e `Retry-After: 900`;
- o webhook exige assinatura válida, é idempotente e nunca confia no status recebido no corpo: o pagamento é consultado novamente no Mercado Pago;
- QR Code, CPF, Access Token e segredo do webhook não são gravados em logs.

## Verificações recomendadas antes da produção

- trocar `MERCADO_PAGO_ENV` para `production` e usar credenciais de produção apenas no gerenciador seguro do ambiente;
- manter o Webhook em HTTPS, selecionar **Order (Mercado Pago)** e validar a entrega no painel do Mercado Pago;
- agendar a limpeza de eventos/checkouts;
- testar aprovação, rejeição, expiração e estorno;
- confirmar que Access Token, segredo do Webhook, CPF e código Pix não aparecem em logs;
- executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
