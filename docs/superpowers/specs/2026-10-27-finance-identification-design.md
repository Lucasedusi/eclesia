# Identificação comum dos lançamentos

Escopo aprovado: identificar quem paga/recebe em entradas e saídas manuais, atendimento, extrato e correções; sem controle de baixas. Manter `codex/finance-bank-statement-import`, sem subagentes, publicação ou alteração online.

- Seção Identificação, pergunta Recebido de/Pago a; tipos MEMBER, UNREGISTERED, CONGREGATION, ORGANIZATION, COLLECTIVE (este último apenas para entradas na interface).
- Congregação selecionada por busca limitada a nomes e IDs ativos da igreja autenticada. A unidade contábil mantém suas permissões e não muda ao escolher contraparte. Não cria transferência ou pagamento na contraparte.
- Congregação tem ID próprio com chave estrangeira composta por igreja, nome histórico e tipo. Empresas/instituições/outros usam nome livre. Pessoas e registros antigos permanecem compatíveis; despesa antiga sem identificação permanece opcional.
- Dízimos e categorias que exigem pessoa continuam aceitando somente MEMBER/UNREGISTERED. Mudança de identificação de atendimento inteiro conserva regra existente de cancelar e recriar.
- Prévia, consulta, comprovantes e relatórios usam o nome histórico com nomenclatura neutra/direcional. Consulta pode filtrar pela congregação contraparte sem confundir a unidade proprietária.
- Após salvar/concluir conferência do extrato, rolar ao início da fila com mensagem/filtros visíveis; preservar filtros/página. Falha e rascunho permanecem no editor.
- Botão único Salvar da conferência centraliza ícone e texto sem divisória.
- Migração aditiva, testes SQL de isolamento/permissões/histórico, tipos gerados localmente, testes de formulário e fluxo; encerrar servidor ao terminar.
