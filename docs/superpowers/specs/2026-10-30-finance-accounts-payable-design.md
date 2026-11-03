# Contas a pagar da Catedral — desenho aprovado

Data: 30 de outubro de 2026.

Status: aprovada pelo usuário em 30/10/2026 para planejamento e implementação local em uma nova branch, sem subagentes. Banco online e publicação na main continuam dependendo de autorização específica.

## Objetivo e benefício

Organizar os compromissos de pagamento da administração da igreja em um checklist compartilhado, com vencimentos, confirmação manual de pagamento e histórico. Reduzir esquecimentos, tornar as pendências visíveis e permitir identificar quem confirmou ou corrigiu cada registro.

O controle estará disponível no computador e no celular, seguindo os padrões existentes do Financeiro. A confirmação registra uma informação prestada pelo administrador; não executa nem verifica pagamento bancário.

## Decisões trazidas pelo usuário

- Uma lista única da administração, pertencente exclusivamente à Catedral.
- O conteúdo independe da congregação selecionada nas outras telas financeiras.
- Acesso somente para administradores.
- Cadastro simples, abas A pagar e Pagas, referência mensal, situação de atraso, confirmação de pagamento, edição, exclusão e filtros.
- Aproveitar as sugestões apresentadas na análise, consolidadas abaixo para aprovação.
- Implementar apenas depois da aprovação, diretamente e sem subagentes.

## Alternativas consideradas

1. **Checklist com confirmação manual — abordagem proposta:** cadastrar compromissos e confirmar que foram pagos, preservando os lançamentos financeiros no fluxo atual. Atende à organização imediata com formulário simples. Exige que o administrador mantenha também o lançamento da saída quando aplicável.
2. **Contas integradas às saídas financeiras:** ao confirmar, criar ou vincular um lançamento, tratando conta bancária, identificação, valor, correções e importação de extrato. Reduz o trabalho separado, mas amplia o escopo e exige prevenção de duplicidade e sincronização das correções. Fica para uma evolução posterior.

## Acesso e vínculo com a Catedral

- Usar a Catedral cadastrada como sede da igreja autenticada, resolvida no servidor. Não identificar a sede pelo texto do nome nem aceitar que o navegador escolha outra congregação proprietária.
- Cada igreja/campo mantém sua própria lista, isolada das demais. Não haverá listas de contas a pagar para outras congregações nesta entrega.
- Proposta de navegação: o administrador poderá abrir o atalho **Contas a pagar** independentemente da congregação selecionada nas demais telas. Ele sempre abrirá **Contas a pagar — Catedral**.
- Nessa tela, a unidade será fixa e claramente identificada; o seletor de congregação não será apresentado como filtro. A navegação deve preservar o contexto das outras telas, sem transferir a propriedade das contas ao alternar congregações.
- O acesso será do administrador ativo da igreja, com escopo geral e permissão específica para esta funcionalidade. Tesoureiros e outros perfis não terão acesso, mesmo possuindo permissões para lançamentos financeiros.
- A mesma restrição será verificada na tela, em consultas, em cada operação de escrita e no banco. Esconder o menu não será a única proteção.
- Se não houver uma sede válida e inequívoca, bloquear o uso e informar que o cadastro da Catedral precisa ser regularizado; não escolher outra unidade automaticamente.

Essa interpretação de navegação é uma proposta explícita para conciliar a lista independente do seletor com sua propriedade exclusiva da Catedral.

## Cadastro

Campos obrigatórios:

- **Nome da conta:** descrição curta, como “Energia elétrica”.
- **Categoria:** categoria financeira ativa de saída, já existente na igreja.
- **Vencimento:** data completa.

Campos opcionais:

- **Valor:** quando já conhecido; se informado, deve ser positivo. Ausência de valor será apresentada como “Não informado”, sem ser tratada como zero.
- **Observação:** informações úteis para a conferência.

O atalho **Nova categoria** reutilizará o cadastro e as regras das categorias financeiras existentes, mantendo o preenchimento da conta ao retornar. Não será criado um catálogo paralelo. Categorias inativas continuam identificando registros históricos, mas não podem ser escolhidas em novos cadastros.

Salvar cria uma conta pendente. Não gera movimentação, saldo, obrigação automática no demonstrativo nem pagamento bancário.

## Listagem e períodos

- Entrada inicial no mês atual, com navegação entre meses e abas **A pagar** e **Pagas**, ambas com contadores.
- O período será sempre baseado no **vencimento**. A interface deve deixar esse critério explícito.
- **A pagar:** contas pendentes com vencimento no período, ordenadas do vencimento mais antigo para o mais recente.
- **Pagas:** contas confirmadas com vencimento no período, exibindo também a data do pagamento. Usar a mesma ordenação por vencimento para manter o checklist mensal previsível.
- Uma conta vencida em outubro e paga em novembro estará em **Pagas de outubro**, com a data de pagamento de novembro. Isso não muda a data de nenhuma saída financeira ou relatório.
- Fora da listagem filtrada, mostrar um aviso de pendências vencidas anteriores ao início do período, com quantidade e ação **Ver pendências anteriores**. A ação abre a aba A pagar com o intervalo correspondente e remove filtros que possam esconder essas pendências.
- Esse aviso considera a lista da Catedral e não fica limitado pela busca ou categoria selecionadas. Deve indicar que se refere a pendências anteriores fora da lista atual.
- Ao consultar um mês histórico, não incluir nesse aviso contas posteriores ao período. A data de hoje só determina se uma pendência anterior já está vencida.
- Paginação e mensagens de lista vazia seguirão os padrões do módulo. Após uma alteração, atualizar lista e contadores juntos, mantendo o contexto do usuário.

## Situação e datas

| Situação | Regra |
| --- | --- |
| A vencer | Pendente e vencimento posterior a hoje. |
| Vence hoje | Pendente e vencimento igual a hoje. |
| Em atraso | Pendente e vencimento anterior a hoje. |
| Paga | Confirmação de pagamento ativa. |

Calcular o atraso a partir do vencimento e da data atual no fuso usado pelo Financeiro (America/Sao_Paulo), sem depender de alteração manual ou rotina noturna no banco. Datas de vencimento e pagamento são datas de calendário, sem deslocamento ao serem exibidas.

Ao voltar à tela e na virada do dia, atualizar as indicações de vencimento. Usar texto além de cor, inclusive no celular.

## Confirmação de pagamento

1. O administrador seleciona **Marcar como paga**.
2. Um modal mostra nome, vencimento e valor, quando informado.
3. O administrador confirma a **data do pagamento**, inicialmente preenchida com hoje. Pode informar uma data anterior, inclusive pagamento antecipado; uma data futura não será aceita como pagamento realizado.
4. Após salvar com sucesso, a conta passa para Pagas no seu período de vencimento.

Guardar separadamente a data informada do pagamento, o usuário que confirmou e a data/hora da confirmação no sistema. Não exigir valor, comprovante, caixa ou forma de pagamento para concluir o checklist.

O modal informará de forma breve que a confirmação não registra uma saída financeira. O administrador continuará usando os lançamentos ou a importação de extrato para registrar o movimento de caixa. Uma importação não confirmará a conta automaticamente.

Evitar confirmações repetidas por duplo clique, reenvio ou ações concorrentes de administradores. Uma falha na gravação deve preservar o estado anterior. Se a conexão cair após o envio e o resultado ficar incerto, conferir o estado salvo antes de apresentar o resultado ou repetir a operação, sem efeitos duplicados.

## Edição, exclusão e correção

- Nas pendentes, o menu de três pontos terá **Editar** e **Excluir**.
- Excluir exige confirmação, remove o registro das listas e preserva o histórico por exclusão lógica.
- Nas pagas, apresentar os detalhes da confirmação e a ação **Desfazer confirmação**.
- Desfazer exige justificativa, preserva o evento anterior no histórico e devolve a conta a A pagar. Se o vencimento já passou, ela volta como Em atraso.
- Para editar os dados de uma conta paga ou excluí-la, primeiro desfazer sua confirmação. Não permitir alteração silenciosa de um registro confirmado.
- Registrar criação, alterações, confirmação, desfazimento e exclusão com responsável e data/hora. Disponibilizar esse histórico nos detalhes da conta aos administradores autorizados.
- Mudanças concorrentes devem ser detectadas; não sobrescrever silenciosamente uma versão alterada por outro administrador.

## Busca e filtros

- Busca por nome, com os componentes e indicadores de carregamento usados no sistema.
- Seleção de categoria, incluindo as categorias históricas necessárias para consultar registros antigos.
- Intervalo de datas identificado como **Vencimento de / até**.
- Um intervalo personalizado substitui a seleção mensal; não combinar dois filtros de período conflitantes. A interface indicará o intervalo ativo.
- Ao escolher outro mês, voltar ao intervalo daquele mês. Ao alternar as abas, preservar busca, categoria e período e retornar à primeira página.
- Ação para limpar filtros, voltando ao mês de contexto, sem alterar registros.

## Resumo de vencimentos

Incluir na visão geral financeira um resumo administrativo explicitamente identificado como **Contas da Catedral**, visível somente aos administradores:

- Contas em atraso.
- Contas que vencem hoje.
- Contas que vencem nos próximos sete dias, sem incluir novamente as de hoje.

As contagens consideram contas pendentes e a data atual, independentemente do mês ou da congregação usados nos outros indicadores da visão geral. Os atalhos abrem a lista da Catedral com o filtro correspondente. Não misturar essas contagens com totais de entradas, saídas ou saldo.

Esta entrega usa contagens; não promete um total financeiro completo quando existem contas sem valor informado. Alertas externos por email, WhatsApp ou push não integram o escopo.

## Copiar para o próximo mês

- Disponibilizar **Copiar para o próximo mês** como ação secundária na visualização mensal.
- Permitir selecionar contas pendentes ou pagas daquele mês e conferir as cópias antes de salvar.
- Copiar nome, categoria, valor quando informado e observação. Todas as novas contas começam pendentes, sem confirmação nem histórico de pagamento da origem.
- Manter o dia do vencimento no mês seguinte; quando não existir, usar o último dia do mês e mostrar o ajuste na conferência. Exemplo: dia 31 passa para 30 em um mês de 30 dias.
- Permitir ajustar valores e vencimentos dentro do mês de destino na conferência. Conta com categoria inativa exige escolher uma categoria ativa.
- A cópia é uma ação pontual, sem criar recorrência. Alterar a origem depois não altera a cópia.
- Evitar duplicar uma mesma conta de origem no mesmo mês de destino em uma repetição da operação; informar quais cópias já existem. O mesmo nome, por si só, não torna duas contas distintas uma duplicidade.
- Confirmar a operação de forma consistente, sem deixar uma cópia parcial silenciosa em caso de falha.

## Disponibilidade — atualização aprovada em 02/11/2026

- Computador: item no menu financeiro, listagem em tabela, filtros e modal seguindo os componentes e o tema atuais.
- Contas a pagar fica disponível apenas no computador. O menu Mais do Financeiro/mobile não oferece esse atalho.
- Ao abrir diretamente pelo celular ou tablet identificado, exibir mensagem de disponibilidade exclusiva no computador e retorno à visão geral, preservando congregação/período. O servidor verifica autorização antes do dispositivo e não consulta as contas para essa resposta.
- Seguir também o limite de tela mobile existente no Financeiro (até 760 px), retirando a listagem e seus modais desse modo. Celulares identificados continuam restritos na horizontal.
- A autorização administrativa, o escopo da Catedral e as operações no desktop permanecem iguais. Esta decisão substitui a disponibilidade mobile/PWA da proposta original.
- Operações exigem conexão. Não marcar uma conta como paga somente no aparelho nem armazenar dados financeiros no cache offline da PWA.

## Encaixe técnico e limites

Inspeção de referência feita no checkout local da main, commit `2fd1da3`. Não foi consultado nem alterado o banco online nesta etapa.

- O projeto contém `accounts_payable`, categorias financeiras e padrões de formulário, navegação e acesso. Reutilizar essa estrutura onde compatível, mantendo o domínio em `src/modules/finance/`.
- As políticas antigas de `accounts_payable` permitem leitura por permissões financeiras mais amplas; precisam ser adequadas antes de expor a funcionalidade administrativa. Rever também grants e acessos por relações/documentos.
- Novas regras devem garantir vínculo com a igreja autenticada e sua sede, relações entre registros da mesma igreja, acesso administrativo e preservação do histórico.
- O valor opcional precisa de representação explícita de ausência; o esquema antigo usa valor obrigatório com padrão zero. Não converter nem reinterpretar dados antigos por suposição.
- Inspecionar compatibilidade de registros legados antes de qualquer migração online autorizada. Não reatribuir contas antigas de outras congregações à Catedral automaticamente, nem ampliar acesso a elas.
- Usar migração nova para os ajustes necessários; não editar migrações existentes. Regenerar os tipos a partir do ambiente local aprovado.
- Consultar a documentação do Next.js incluída no projeto antes de escrever código. Preservar Server Components, limites de Suspense, autorização por operação e invalidação de dados da igreja.
- A confirmação não muda lançamentos, saldos, demonstrativos, informativos, mês de referência financeiro ou o fluxo de extratos.
- Ficam fora: pagamento bancário, confirmação automática por extrato, geração automática de saída, pagamentos parciais, parcelamentos, recorrência automática, anexos novos e notificações externas.

## Verificação e critérios de aceite

- Administrador acessa a mesma lista da Catedral no computador e no celular, mesmo vindo de outra congregação; outros perfis e outras igrejas não acessam por tela ou chamada direta.
- Cadastro, filtros, edição e exclusão funcionam com valor informado e sem valor.
- Categorias existentes são reutilizadas, sem perda do formulário ao cadastrar uma nova categoria.
- Status respeitam hoje, vencimento e fuso, inclusive na virada de dia e mês. Pendências antigas continuam acessíveis.
- Confirmação guarda data real informada e responsável; desfazimento preserva histórico e recalcula a situação. Nenhuma das duas operações altera caixa ou cria lançamento.
- Contadores, resumo, abas e paginação ficam consistentes após alterações, filtros e erros.
- Testar cópia em meses de 28, 29, 30 e 31 dias, categoria inativa, repetição, duplo clique e falha. Testar também edições e confirmações concorrentes.
- Validar permissões, isolamento, relações e histórico com SQL local e Advisors locais, além de regenerar os tipos.
- Executar testes focados, lint sem avisos, typecheck, suíte automatizada, build e testes de navegador dos fluxos afetados, incluindo celular e acesso negado. Informar qualquer verificação impedida e o pré-requisito exato.
- Usar apenas dados fictícios localmente e encerrar os servidores iniciados para a conferência.

## Aprovação e execução

Proposta aprovada em 30/10/2026 para planejamento e implementação local. Branch `codex/finance-accounts-payable` criada da main atualizada (`2fd1da3`), com execução e revisão diretas, sem subagentes.

Publicação na main e aplicação de migrações, seeds ou dados de teste no banco online continuam dependendo de autorização específica.
