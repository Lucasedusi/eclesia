# Especificação — ajustes públicos mobile, acompanhamento e comprovantes de Eventos

## Objetivo

Padronizar a inscrição pública individual e de caravanas em dispositivos móveis, separar o acompanhamento de uma inscrição já criada do formulário de uma nova inscrição e ampliar os comprovantes e relatórios internos.

## Requisitos aprovados

- No mobile, retirar a caixa “Informações do evento” e mostrar data e local no banner. Não usar o texto genérico “Participe deste evento.”.
- Na etapa 1, manter o resumo expandido e posicionar o botão de avanço abaixo dele. A partir da etapa 2, usar um resumo retrátil; não mostrar o resumo após a conclusão.
- Usar toast mobile fino para mensagens globais, inclusive cópia do Pix; manter erros de validação junto aos campos.
- Padronizar todos os botões públicos com ícones, altura e largura coerentes.
- Na inscrição individual presencial, orientar o contato pelo WhatsApp após a inscrição existir e alinhar os dois botões finais.
- Na caravana, colocar “Voltar” no topo. Para Pix coletivo, manter valor pago e comprovante. Para dinheiro, não solicitar valor nem comprovante e liberar WhatsApp somente após a conclusão.
- Criar acompanhamento persistente individual e coletivo por token opaco, sem dados pessoais na URL, com consulta inicial, atualização manual e polling somente com aba visível e situação pendente.
- Incluir congregação e regional nos comprovantes gerados.
- Usar badges amarelos para pendências e vermelhos para falha, cancelamento ou vencimento.
- Adicionar “Comprovante de inscrição” às ações individuais no workspace.
- Adicionar impressão térmica interna de 80 mm para inscrições individuais e caravanas.
- Organizar os cabeçalhos dos relatórios e remover “EKLESIA · EVENTOS”.

## Restrições

- Preservar a experiência desktop existente.
- Não criar migration: reutilizar `event_public_checkouts.access_token_hash`, os tokens atuais e os relacionamentos já existentes de congregação/regional.
- Manter tokens validados somente no servidor e tabelas de checkout sem acesso direto do cliente.
- Não manter conexão Realtime pública permanente.
- Preservar o ZIP original e gerar uma nova entrega.

## Critérios de aceite

- Refresh e reabertura pelo link mostram somente o acompanhamento, para individual e caravana.
- Polling para quando a aba fica oculta e quando o status se torna terminal.
- Dinheiro em caravana nunca apresenta upload de comprovante.
- O resumo está expandido na etapa 1, recolhido por padrão nas etapas intermediárias e ausente na confirmação.
- PDF individual e impressão térmica mostram congregação e regional quando disponíveis.
- A ação individual do workspace respeita as mesmas permissões das demais ações de gerenciamento.
- Testes, lint, typecheck e build passam.
