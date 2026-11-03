# Refinamento de Contas a pagar

Proposta aprovada no chat: implementação direta, sem subagentes, na branch existente. Manter visual leve, moderno e refinado do Financeiro.

- Sidebar: Contas a pagar após Caixas e contas, ícone ListChecks. Título apenas Contas a pagar. Retirar resumo Contas da Catedral da visão geral e sua consulta.
- Filtros: busca, mês do vencimento, categoria, situação e botão de ícone Filtrar. Retirar campos manuais de intervalo. Busca com controle de limpar de Lançamentos. Aplicar os campos juntos ao filtrar; manter troca direta de mês conforme padrão existente. Situação: Todas, Em atraso, Vence hoje, A vencer; na aba Pagas, mostrar Pagas desabilitado e desconsiderar o recorte de vencimento. Preservar o recorte escolhido ao voltar à aba A pagar.
- Aplicar situação no banco antes de paginação. Contadores das abas refletem mês/busca/categoria; total da listagem reflete também situação. Manter o aviso de pendências anteriores e seu intervalo explícito, com ação Voltar ao mês; mudança de mês limpa esse intervalo.
- Abas à esquerda e período como badge à direita; ativo/período com fundo #EDF5EF, texto #176348 e peso 500. Adaptar quebra no mobile.
- Mesma distribuição e largura de colunas nas duas abas, nome flexível, ações alinhadas; botão Pagar. Manter cartões no mobile.
- Detalhes: nome em destaque, rótulos menores/discretos, respostas distinguíveis, situação em badge sem depender apenas de cor. Histórico inicialmente fechado usando a sanfona de Lançamentos.
- Fechar modal sem gravar não atualiza a página. Atualizar após gravação; também reconciliar ao fechar após falha de resposta ou conflito de revisão. Manter proteção de preenchimento e idempotência.

Abordagem: reutilizar os padrões existentes e ajustar a consulta atual com parâmetro opcional dueStatus. Filtrar apenas os 20 itens da página foi descartado porque produz resultados/contagens incorretos. Alterações visuais não justificam novo sistema de componentes.

Validação com dados fictícios locais; nenhuma gravação de teste online. Nova migração altera exclusivamente a consulta, mantém assinatura, autorização, escopo, grants e compatibilidade com clientes antigos. Publicação na main permanece fora deste trabalho.
