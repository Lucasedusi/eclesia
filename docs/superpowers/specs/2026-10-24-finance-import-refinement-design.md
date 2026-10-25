# Refinamento da importação de extratos

## Aprovação e abordagem
O usuário aprovou em 24/10 os ajustes e recomendações da avaliação, mantendo transferências e vínculos em **Mais opções**, e autorizou implementação e testes locais na branch separada, sem subagentes, publicação ou alterações online.
Consideradas: remover definitivamente as rotinas excepcionais (perderia soluções para duplicidades e transferências); manter tudo expandido (polui a conferência); recolher ações excepcionais (escolhida pelo usuário).

## Interface
Upload destacado e acessível, seleção ou arrastar XLSX, nome/tamanho/substituição; limites visíveis. Paginação compacta, escondida quando única. Três cards de entradas consideradas, saídas consideradas e conferência, com ícones, e faixa de contadores abaixo. Sem referências de saldos expandidas; divergência real continua resolvível. Pendente em amarelo. Botões com ícones.
Formulário e prévia lateral para ambas direções, mantendo saídas SINGLE e regras de pessoa/categoria. Uma classificação por novo movimento, valor fixo. Rascunhos antigos rateados serão preservados com aviso e opção explícita de unificação; não perder dados silenciosamente. Botões da prévia seguem Atendimento. Mais opções recolhe vínculo/pesquisa, transferência e decisões. Alertas de duplicidade/divergência aparecem apenas quando necessários e conservam resolução.

## Exclusões
Exclusão lógica auditada de importação sem qualquer histórico POST/LINK/DUPLICATE e sem dependências; remover itens PENDING/IGNORED com a mesma proteção histórica. Operação atômica, permissões/igreja/congregação/revisão, bloqueio compartilhado com lançamentos. Removidos não entram nos totais, contagens ou paginação. Recuperação discreta por filtro de itens excluídos, com revisão e auditoria. Reenvio do mesmo arquivo não ressuscita itens. Excluir lote remove também seus itens; reimportação de lote excluído pode criar novo lote. Não excluir dinheiro nem vínculos históricos. Origem do arquivo preservada.

## Verificação
SQL local: remoção/restauração, concorrência, vínculos desfeitos/lançamentos cancelados, escopos, replay e contadores. Vitest: validações e serviços. E2E local: upload, cards, remoção e restauração, prévia de saída, fluxo principal, Mais opções e duplicidades. Lint, typecheck, suíte, build, advisors locais e tipos gerados. Nenhum dado real nos testes.
