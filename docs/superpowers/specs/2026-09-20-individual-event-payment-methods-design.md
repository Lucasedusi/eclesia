# Formas de pagamento para inscrições individuais

## Objetivo

Permitir que cada evento configure, de forma independente, quais formas de pagamento aparecem nas inscrições individuais, sem alterar o fluxo atual de caravanas.

## Regras aprovadas

- O fluxo de caravanas continua usando Pix estático e Dinheiro como já funciona hoje.
- O fluxo individual vale tanto para eventos `INDIVIDUAL` quanto para a opção individual de eventos `MIXED`.
- Um evento pago pode habilitar Pix, Dinheiro e Cartão em qualquer combinação válida.
- O Pix individual possui exatamente um modo: `DISABLED`, `STATIC` ou `AUTOMATIC`.
- Pix estático e Pix automático nunca podem ficar habilitados simultaneamente.
- O Pix automático continua usando Mercado Pago e confirmação por reconciliação/webhook.
- O Pix estático mostra chave, titular e QR Code próprios da inscrição individual.
- No Pix estático, o participante pode anexar um comprovante opcional. A inscrição permanece pendente até aprovação manual da organização.
- Dinheiro e Cartão mantêm o fluxo presencial existente e encaminham o participante para a organização pelo WhatsApp.
- Um único controle administrativo de Cartão habilita as opções públicas Cartão de débito e Cartão de crédito.
- Eventos gratuitos continuam usando `NOT_APPLICABLE` e confirmação imediata.

## Arquitetura

As configurações individuais serão colunas próprias de `event_payment_settings`; as colunas atuais de Pix/Dinheiro permanecem exclusivas de caravanas. O checkout gravará um snapshot `payment_flow` (`AUTOMATIC_PIX`, `STATIC_PIX`, `MANUAL` ou `NOT_APPLICABLE`) e dos dados necessários para concluir o pagamento, e o banco validará o método escolhido contra a configuração do evento.

O comprovante do Pix estático será enviado ao bucket privado `event-documents`, validado no servidor e vinculado a um `event_payments` pendente. A aprovação interna já existente confirmará esse pagamento e atualizará a inscrição.

## Compatibilidade

- Checkouts existentes com Pix serão migrados para `AUTOMATIC_PIX`.
- Eventos existentes preservam Pix automático como modo individual padrão.
- Dinheiro e Cartão serão preservados nos eventos legados que já expunham essas opções por meio do WhatsApp compartilhado; eventos novos usam exclusivamente a configuração individual.
- Nenhuma credencial ou dado sensível será exposto ao cliente ou registrado em logs.
