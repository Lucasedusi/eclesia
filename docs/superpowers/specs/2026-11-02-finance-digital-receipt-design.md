# Comprovante digital financeiro

Implementação autorizada pelo usuário em 02/11/2026, diretamente e sem subagentes.

## Fluxo aprovado

Somente nos detalhes do lançamento, ao lado da impressão existente, oferecer Comprovante digital. Abrir uma pequena janela com telefone, acesso à prévia e download do PDF. Abrir WhatsApp prepara a conversa com uma mensagem e o link; o operador confere a conta conectada e conclui o envio. Não afirmar entrega nem integrar disparos automáticos. Preservar integralmente o cadastro, atendimento, confirmação e impressão térmica.

O destinatário acessa uma página responsiva sem login, com marca da igreja, congregação, pessoa/beneficiário, data da movimentação, itens, forma de pagamento, total e número do documento. Página branca, espaços generosos, detalhes verdes e tipografia Rubik. PDF compacto, legível, com continuação para muitos itens. Não expor observações, CPF, caixa/conta bancária ou identificadores internos de transações.

## Abordagens

PDF anexado manualmente exigiria baixar e anexar a cada conversa. API de WhatsApp adicionaria custo e configuração. O usuário escolheu mensagem manual com link para visualizar e baixar PDF; a Brevo foi descartada para este fluxo.

## Decisões de implementação

- Links aleatórios de 256 bits, armazenados somente como hash, com validade de 30 dias. Quem possui o link pode acessá-lo; essa informação aparece ao operador. O telefone não é persistido.
- Emissão exige finance.view e escopo da congregação, com checagem no serviço e no banco. Uma nova tabela com RLS sem acesso direto de anon/authenticated guarda o vínculo e o autor. Chaves compostas impedem referências a outro campo/congregação.
- Cada abertura consulta a versão atual: cancelamento, substituição, exclusão e expiração invalidam o acesso. Atendimento mantém todos os itens do recibo original.
- Emissão limitada a 20 links por recibo/10 minutos; leitura a 60 acessos por link/10 minutos, persistida no banco. Apenas hash é enviado ao banco, sem log do token ou telefone.
- Página pública independente do layout autenticado, através de Route Handler e HTML escapado; PDF pelo mesmo acesso validado. Respostas no-store, no-referrer, noindex e CSP restritiva; sem prévia social com dados financeiros.
- Usar NEXT_PUBLIC_SITE_URL configurada, sem confiar em Host fornecido pelo cliente. HTTP apenas em loopback local.
- Nova migração aplicada apenas no Supabase local. Publicação, migração online e main continuam dependendo de autorização específica.

## Validação

Vitest: telefone, URL, permissões, estados do recibo, projeção mínima, expiração, limitação, HTML escapado, PDF e privacidade das rotas. SQL: grants/RLS, autorização, isolamento, expiração e limites. Playwright com dados fictícios locais: desktop/mobile, conversa simulada, destinatário sem sessão, PDF e regressão térmica. Lint, typecheck, suíte completa e build. Revisão final direta, sem subagentes.
