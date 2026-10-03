# Requisitos e modelagem do módulo financeiro

Consolidação de 3 de outubro de 2026 das decisões aprovadas na conversa sobre o módulo financeiro do Eclesias. O objetivo é agilizar lançamentos, preservar a rastreabilidade dos valores e orientar a entrega mensal das congregações por meio de um demonstrativo descritivo.

Os requisitos funcionais foram aprovados por blocos. Em 3 de outubro de 2026, o usuário também aprovou a direção dos ajustes no banco e as regras complementares de vigência mensal, valores negativos, correção por contribuição e arredondamento. A etapa atual é incorporar a referência de layout que o usuário solicitou enviar antes da revisão final desta especificação. Este documento não autoriza a execução de migrações remotas.

## Escopo e prioridades aprovados

- Ambiente financeiro próprio, com contexto de congregação e acesso por permissão.
- Configurações financeiras, caixas, contas e saldos iniciais.
- Entradas e saídas, lançamento contínuo, documentos físicos e comprovantes emitidos pelo sistema.
- Correções e cancelamentos com histórico e justificativa.
- Transferências entre caixas da mesma congregação e ajustes identificados de saldo.
- Página principal com resumo, gráficos e lançamentos imediatamente disponíveis.
- Demonstrativo mensal por congregação, prioridade central da entrega.
- Atendimento dedicado, busca de contribuintes e várias contribuições no mesmo atendimento e comprovante.

Relatórios financeiros oficiais serão modelados em outro momento. O autoatendimento pelo próprio contribuinte em tablet é uma evolução futura. A existência de `accounts_payable` no banco não inclui uma interface de contas a pagar nesta entrega. O módulo registra movimentações informadas pelo operador; integrações para cobrar ou confirmar pagamentos automaticamente não foram incluídas.

## Contexto financeiro e acesso

Igreja ou campo corresponde ao conjunto isolado pelo `church_id`. A Catedral é a congregação identificada como sede dentro desse campo. O administrador geral pode operar todas as congregações do seu campo; o tesoureiro ou secretário habilitado opera o ambiente da própria congregação.

Ao entrar no financeiro, o administrador vê a Catedral e pode alternar a congregação. O tesoureiro vê sua unidade. A unidade selecionada determina os lançamentos, caixas, gráficos e demonstrativos apresentados e aparece claramente nos formulários. A troca de unidade não troca o campo autenticado.

Há uma permissão específica para localizar contribuintes de outras congregações do mesmo campo durante o atendimento. Essa consulta entrega apenas a identificação necessária e a classificação sugerida; não concede acesso aos lançamentos ou ao cadastro completo de outras congregações. A contribuição pertence à unidade que a recebeu, mesmo quando o membro pertence a outra.

## Configurações e caixas

O administrador geral mantém os seguintes cadastros:

| Cadastro | Regra aprovada |
| --- | --- |
| Departamentos | Compartilhados no campo, com nome e opção de participação na base de cálculo. |
| Categorias | Compartilhadas no campo; identificam entradas ou saídas e podem sugerir departamento. |
| Classificações do dízimo | Lista administrável, incluindo cargos e grupos como auxiliar, diácono e criança. |
| Formas de pagamento | Compartilhadas no campo, com disponibilidade configurável por caixa ou conta. |
| Caixas e contas | Pertencem a uma congregação, inclusive a Catedral, com saldo próprio e padrões de preenchimento. |

Caixa indica onde o dinheiro está. Departamento indica sua destinação. A mesma conta pode receber valores da Tesouraria e de Missões, mantendo a classificação de cada movimento. A participação no cálculo é definida pelo departamento, independentemente da conta utilizada.

Tesouraria participa da base de cálculo no exemplo acordado. Missões, Construção e Eventos aparecem no demonstrativo, mas suas entradas ficam fora da base. Esses nomes são exemplos de cadastros administráveis, não regras fixadas pelos nomes.

Na abertura de um caixa, o administrador informa saldo inicial e data de início do controle. O saldo de abertura é identificado separadamente e não compõe arrecadação ou base dos percentuais. Depois de existirem movimentos, correções de saldo geram ajustes com data, valor, motivo e responsável.

Transferências entre caixas da mesma congregação movimentam origem e destino, preservam o saldo total da unidade e não representam uma nova receita ou despesa na visão consolidada da congregação. O depósito do dinheiro do caixa em uma conta bancária é um exemplo desse fluxo.

Cadastros utilizados são inativados com preservação do histórico. Um caixa só pode ser inativado com saldo zerado por movimentos ou ajustes registrados.

## Lançamento comum e contínuo

Nova entrada e Nova saída abrem um painel lateral amplo, com a congregação visível. O formulário apresenta categoria, departamento, valor, caixa ou conta, forma de pagamento e data da movimentação. As escolhas respeitam a natureza da operação e o escopo do operador.

A categoria pode sugerir o departamento, que continua visível. A forma de pagamento segue as opções configuradas para a conta ou caixa. A data começa no dia atual e pode representar um recibo anterior; mês e ano de referência acompanham essa data.

O formulário adapta os dados adicionais:

- Dízimo pede pessoa e classificação. A classificação cadastral é uma sugestão confirmável ou corrigível; o lançamento guarda a classificação usada na ocasião.
- Oferta permite identificação pessoal ou arrecadação coletiva, como a oferta de um culto.
- Despesa apresenta descrição, favorecido quando aplicável e possibilidade de anexo.
- Pessoa sem cadastro tem campo próprio de nome, separado da descrição da movimentação.
- Número do recibo físico, observações e anexos ficam na área de detalhes. Essa área pode permanecer aberta durante o lançamento de recibos acumulados.

| Ação | Resultado aprovado |
| --- | --- |
| Salvar | Confirma e fecha o painel. |
| Salvar e continuar | Confirma e prepara o próximo lançamento. |
| Salvar e imprimir | Confirma, prepara o próximo lançamento e abre a impressão do comprovante. |

O lançamento contínuo mantém departamento, caixa, forma de pagamento, categoria e data, sempre visíveis. Limpa pessoa, classificação do dízimo, valor, documento, descrição, observações específicas e anexos. A classificação da pessoa anterior nunca é herdada pelo próximo atendimento.

A limpeza só ocorre após a confirmação do salvamento. Erros preservam o preenchimento. Cliques repetidos e novas tentativas da mesma operação após falha de comunicação não podem criar duplicatas. Após salvar, a listagem é atualizada e apresenta confirmação identificável do lançamento.

## Atendimento dedicado e contribuições múltiplas

A tela de atendimento é uma interface própria, com layout a ser revisado com o usuário, campos legíveis e operação rápida pelo teclado. Ela reutiliza as regras financeiras do lançamento comum.

O tesoureiro define o contexto da sessão: congregação, departamento, caixa, forma de pagamento e categoria padrão. Esses valores ficam visíveis e podem ser alterados. A identificação ocorre por nome, CPF, número de cadastro ou QR Code da credencial. Depois da busca, o operador confere nome, congregação e classificação sugerida. A leitura de uma credencial não salva uma contribuição automaticamente.

Uma pessoa pode realizar uma ou várias contribuições no mesmo atendimento. A primeira linha aparece diretamente; Adicionar contribuição inclui outra categoria, departamento e valor. Cada contribuição mantém seu próprio lançamento, vinculado ao mesmo atendimento. O comprovante reúne todos os itens e o total entregue.

O conjunto de lançamentos é salvo integralmente. Não pode existir um atendimento confirmado com apenas parte das contribuições salvas. A identificação é preenchida uma vez; classificações específicas de dízimo são preservadas nos respectivos itens.

Exemplo aprovado:

| Item | Departamento | Valor | Participação na base |
| --- | --- | ---: | --- |
| Dízimo | Tesouraria | R$ 200,00 | Sim |
| Oferta de culto | Tesouraria | R$ 20,00 | Sim |
| Oferta para missões | Missões | R$ 50,00 | Não |
| Total do atendimento | | R$ 270,00 | R$ 220,00 elegíveis |

Salvar e imprimir abre a impressão comum do navegador e prepara a próxima identificação. A sequência de atendimentos utiliza as mesmas proteções contra duplicidade, correções e cancelamentos do restante do módulo.

## Comprovantes e impressão

Recibo físico e comprovante emitido pelo sistema coexistem. O número informado do bloco de papel não substitui a identificação interna do lançamento ou a numeração do comprovante do sistema.

A impressão térmica usa a janela comum do navegador. Fechar ou cancelar essa janela não desfaz o lançamento salvo. É possível reimprimir o mesmo comprovante pelo registro existente.

Uma correção que afete o conteúdo emitido gera uma nova versão vinculada à operação. A anterior fica identificada como substituída e permanece consultável. O cancelamento da operação também precisa ser identificável no comprovante correspondente.

## Correções e cancelamentos

Tesoureiros autorizados corrigem e cancelam lançamentos da própria congregação, com justificativa. O administrador faz isso nas congregações do campo. O histórico preserva responsáveis, datas, motivo, valores anteriores e novos.

Uma correção ajusta os efeitos financeiros da operação. Corrigir uma entrada de R$ 150,00 para R$ 100,00 reduz seu efeito sobre o saldo em R$ 50,00. Se a correção trocar caixa ou departamento, os efeitos e classificações anteriores e novos devem continuar rastreáveis.

Um lançamento cancelado permanece consultável e deixa de afetar saldos e totais. A interface de cancelamento não apaga o registro nem seu histórico.

Alterações nos lançamentos considerados por um demonstrativo gerado sinalizam que há mudanças posteriores à geração. Uma nova geração preserva a versão anterior e apresenta uma versão atualizada. O demonstrativo descritivo não bloqueia os lançamentos do mês.

## Demonstrativo mensal

O tesoureiro escolhe o mês e gera o demonstrativo da sua congregação. O administrador consulta os demonstrativos de todas as unidades do campo.

O documento apresenta entradas de todos os departamentos, a base elegível, memória de cálculo por item, prebenda bruta, dízimo descontado, prebenda líquida e total destinado à Catedral. Departamentos fora da base continuam visíveis e identificados.

A base é a soma das receitas válidas do período, nos departamentos configurados como participantes. Saldos de abertura, ajustes de saldo, transferências internas e lançamentos cancelados não entram na base. Despesas não reduzem a base bruta usada nos percentuais.

O administrador configura os itens por congregação, com nome, destino, valor ou percentual e vigência. Pode copiar a configuração de outra congregação para iniciar o cadastro; a cópia passa a ser independente.

As formas de cálculo aprovadas são percentual da base de entradas, percentual da prebenda bruta e valor fixo. O dízimo é descontado da prebenda. A congregação paga a prebenda líquida ao pastor; repasse, dízimo da prebenda, sistema, seguro, contador e os demais itens configurados para a Catedral compõem o total destinado à Catedral.

Exemplo de referência com R$ 15.000,00 elegíveis e valor de contador representado por C:

| Cálculo ou destino | Valor |
| --- | ---: |
| Repasse de 30% | R$ 4.500,00 |
| Prebenda bruta de 35% | R$ 5.250,00 |
| Dízimo de 10% da prebenda | R$ 525,00 |
| Prebenda líquida destinada ao pastor | R$ 4.725,00 |
| Sistema | R$ 25,00 |
| Seguro | R$ 86,00 |
| Contador | C |
| Total destinado à Catedral | R$ 5.136,00 + C |
| Total destinado ao pastor e à Catedral | R$ 9.861,00 + C |
| Restante dessa distribuição | R$ 5.139,00 − C |

A prebenda bruta é a base informativa do desconto. Não se soma a prebenda bruta ao dízimo novamente no total a separar. O restante da distribuição não é uma afirmação sobre o saldo disponível, que depende também de saldos anteriores e demais movimentos.

Os percentuais e valores acima são exemplos atuais, alteráveis pelo administrador. Não devem ser fixados no código como obrigação permanente.

Gerar o demonstrativo não cria despesas, não registra recebimento da Catedral e não marca itens como pagos. O tesoureiro lança suas despesas manualmente. A interface apresenta valores calculados, sem interpretar a geração como confirmação de uma entrega.

Cada versão guarda período, entradas consideradas, departamentos participantes, regras utilizadas, bases, valores, destinos, responsável e momento da geração. Reimpressões usam essa versão preservada. Correções posteriores podem gerar outra versão, com identificação da anterior como substituída. Há consulta e impressão do demonstrativo.

## Página principal e listagem

Unidade e período ficam no topo. O período inicial é o mês atual. Nova entrada, Nova saída e Demonstrativo mensal ficam acessíveis, com Configurações financeiras para o administrador.

O resumo apresenta saldo inicial do período, entradas, saídas e saldo final. Ajustes de saldo têm identificação própria. Transferências internas aparecem nos caixas envolvidos e preservam o total da unidade. Gráficos compactos mostram entradas e saídas ao longo do período e valores por categoria.

A listagem já abre com os registros do mês. Mostra data, pessoa ou descrição, categoria, departamento, caixa, valor e identificação de entrada, saída ou cancelamento.

Há busca por pessoa, descrição e número de documento, além de filtros por natureza, departamento, categoria, caixa, forma de pagamento e situação. A paginação não limita os totais aos registros da página: quantidade e total filtrado representam todos os resultados.

Os filtros detalhados afetam a listagem. Resumo e gráficos permanecem vinculados à unidade e ao período exibidos no topo, com distinção visual do total filtrado. A consulta de detalhes, histórico, comprovantes e ações ocorre em painel lateral, preservando filtros e posição da listagem.

## Revisão do banco existente

A evidência desta revisão é o arquivo [FINANCE.MD](../../../FINANCE.MD), a [migração de estrutura inicial](../../../supabase/migrations/20260730000000_remote_clone_baseline.sql), a [restauração das permissões financeiras](../../../supabase/migrations/20260920214134_restore_member_and_finance_permissions.sql) e os tipos gerados locais. O estado aplicado no banco remoto não foi consultado. O FINANCE.MD documenta uma estrutura de partida; os requisitos aprovados nesta conversa definem os comportamentos novos.

As tabelas de departamentos, caixas, formas de pagamento, categorias, lançamentos, documentos, recibos, regras e demonstrativos serão aproveitadas conforme a direção aprovada pelo usuário. Os ajustes abaixo registram os requisitos de evolução do banco para a futura implementação.

| Necessidade | Limitação observada | Ajuste previsto |
| --- | --- | --- |
| Departamento participa da base | `financial_departments` não tem campo específico para essa escolha. | Registrar participação, histórico de vigência e sua cópia na versão do demonstrativo. |
| Vários itens em um atendimento | `financial_transactions` não tem relação explícita com um atendimento. | Criar um registro de atendimento e relacionar suas contribuições, com salvamento integral e chave de repetição segura. |
| Comprovante com vários lançamentos | `financial_receipts.financial_transaction_id` é obrigatório e aponta para um lançamento. | Acrescentar vínculo de atendimento e itens preservados do comprovante; cada recibo deve ter uma origem inequívoca, individual ou de atendimento. |
| Classificação histórica do dízimo | Não há campo específico na transação nem catálogo financeiro dessas classificações. | Catálogo administrável e classificação preservada por contribuição, independente de mudanças no cadastro do membro. |
| Métodos disponíveis por caixa | Caixas e métodos existem sem relação explícita entre eles. | Relação configurável entre caixas e métodos, validada no salvamento. |
| Saldo inicial com data | `opening_balance` existe, sem data específica de abertura. | Data de abertura, registro de ajustes e cálculo de saldo rastreável. `current_balance` não pode ser um valor livremente editável. |
| Transferência interna | Os tipos de lançamento existentes são somente entrada e saída. | Operação vinculada de origem e destino, salva integralmente, identificada fora de arrecadação, despesas e base. |
| Histórico de correção | Datas de atualização e cancelamento não constituem, sozinhas, histórico dos valores alterados. | Revisões ou auditoria protegida que preservem os efeitos anteriores e novos e a justificativa. |
| Várias versões do demonstrativo | Há unicidade por campo, congregação e mês para demonstrativos não cancelados. | Manter um cabeçalho mensal e versões com seus próprios itens, permitindo preservar gerações anteriores. |
| Demonstrativo somente descritivo | O modelo contém flags e vínculos para gerar transações e estados de entrega. | O fluxo aprovado usa cálculo e versões; não aciona geração financeira nem apresenta esses estados como pagamento. |
| Escopo por congregação | As políticas financeiras consultadas verificam campo e permissão, sem a restrição da congregação do operador. | Políticas e permissões por operação que imponham o escopo no banco e nos serviços. |
| Relações entre registros do mesmo campo | Várias relações financeiras usam somente o identificador, sem incluir `church_id`. | Chaves compostas e validação de unidade onde pertinente, impedindo relações entre campos diferentes. |

As relações entre lançamento, caixa e atendimento devem garantir a mesma congregação. Já a relação com o contribuinte deve permitir outra congregação do mesmo campo, pois isso foi aprovado para o atendimento. Essa consulta de identificação precisa de uma entrada específica; não pode ser obtida ampliando o acesso geral às tabelas financeiras ou aos dados sensíveis dos membros.

O esquema permite registros com campos financeiros opcionais e contém referências de exclusão que podem anular vínculos. A implementação deverá verificar os dados efetivamente existentes e sua compatibilidade antes de tornar campos obrigatórios ou mudar relações. Não presumir que campos nulos representam a Catedral e não classificar dados antigos por adivinhação.

## Direção técnica para atender aos requisitos

Concentrar componentes, validações, ações e serviços em `src/modules/finance/`, seguindo a estrutura dos demais domínios. As páginas autenticam, resolvem contexto, orquestram consultas e renderizam. Os serviços financeiros ficam no servidor, com autenticação, permissões e validação de campo, congregação e recursos em cada operação.

Lançamento comum e atendimento utilizam a mesma lógica de registro. O atendimento agrupa vários itens e a emissão do comprovante; todos os registros persistidos da confirmação devem ser gravados numa única transação de banco. A impressão ocorre depois da confirmação. As chaves de repetição identificam a mesma operação, sem confundir contribuições distintas de valor igual.

Correções devem verificar a versão lida pelo operador para não sobrescrever uma alteração concorrente. Transferências, cancelamentos, ajustes de efeitos financeiros e substituições de comprovantes também exigem consistência integral. Um vínculo apenas informativo no navegador não atende a essas garantias.

O saldo precisa ser reproduzível a partir da abertura e dos movimentos válidos. Se o campo de saldo atual for mantido por desempenho, será uma projeção atualizada de forma transacional e verificável contra os movimentos. Consultas de meses passados usam a posição daquele período, não o valor atual do caixa.

As consultas respeitam `church_id`, congregação e exclusão lógica. Cancelamentos permanecem visíveis nas consultas autorizadas de histórico, mas são excluídos dos totais de movimentos válidos. Resultados sensíveis e caches não podem ser compartilhados entre escopos de acesso. Reutilizar as permissões, o contexto autenticado, os padrões de auditoria, os componentes e as regras de cache já estabelecidos no repositório. Consultar a documentação Next.js instalada antes da implementação.

Documentos anexados usam armazenamento privado, validação de arquivo e acesso temporário autorizado. CPF, tokens de credencial e conteúdo dos comprovantes não entram em logs de operação. A consulta por CPF ou credencial usa os mecanismos existentes de identidade protegida e verifica a autorização do operador; o código lido não é tratado como permissão financeira.

## Regras complementares e consequências técnicas

Os itens 1 a 4 detalham as regras complementares aprovadas em 3 de outubro de 2026. Os itens 5 a 7 registram as consequências técnicas da impressão pelo navegador e das regras de transferência e administração já acordadas:

1. Valores de contribuições e despesas são maiores que zero e expressos em centavos. Percentuais são calculados com precisão decimal e arredondamento para centavos por item; totais somam os itens apresentados. A prebenda líquida usa a prebenda bruta menos os descontos já arredondados.
2. Mudanças das regras mensais e da participação de departamentos entram em vigor por mês de referência, evitando duas configurações para o mesmo mês. Uma revisão retroativa requer ação explícita do administrador, mantém as versões geradas e sinaliza os demonstrativos afetados.
3. Saldo negativo ou restante negativo no demonstrativo é mostrado com destaque, permitindo registrar fielmente uma situação deficitária. A regra atual que exige restante não negativo no banco deverá ser revista na implementação.
4. Em um atendimento, corrigir ou cancelar um item preserva os demais itens e gera uma nova versão do comprovante do conjunto. Cancelar todo o atendimento cancela todos os itens válidos numa única operação. As ações seguem permissão e justificativa.
5. A contabilização de impressão representa a solicitação ao navegador, não confirmação de que o papel saiu. A interface não afirma conhecer a impressora selecionada ou a conclusão física da impressão sem essa evidência.
6. Transferências internas exigem caixas distintos da mesma congregação, valor positivo e registro único das duas pontas. Sua correção ou cancelamento ajusta ambas as pontas em conjunto.
7. Configurações, saldo de abertura e ajustes administrativos de saldo ficam sob gestão do administrador. Tesoureiros habilitados fazem lançamentos, transferências internas, correções, cancelamentos, emissão e consulta de demonstrativos dentro do próprio escopo.

## Critérios de aceitação

Os cenários abaixo definem a verificação futura da implementação, não resultados de testes já executados.

| Cenário | Resultado esperado |
| --- | --- |
| Tesoureiro tenta operar outra congregação diretamente | Operação negada também pelo servidor e pelo banco. |
| Operador autorizado identifica contribuinte de outra unidade | Somente identificação permitida; lançamento pertence à unidade atendente. |
| Referência aponta para recurso de outro campo | Operação rejeitada, mesmo com identificador válido. |
| Salvar e continuar confirma ou falha | Confirmação limpa somente os dados específicos; falha preserva o preenchimento. |
| Mesma confirmação é enviada duas vezes | Uma única operação e seus mesmos registros são retornados. |
| Dois atendimentos legítimos têm pessoa e valor iguais | São permitidos como operações diferentes. |
| Atendimento de R$ 200,00, R$ 20,00 e R$ 50,00 | Três lançamentos, um atendimento e comprovante total de R$ 270,00; base elegível de R$ 220,00 com a configuração do exemplo. |
| Um item do conjunto é inválido | Nenhum item do atendimento é confirmado parcialmente. |
| Impressão é fechada ou solicitada novamente | Lançamento permanece único; reimpressão não cria arrecadação. |
| Cargo do membro muda depois da contribuição | Classificação histórica da contribuição e conteúdo emitido são preservados. |
| Entrada de R$ 150,00 é corrigida para R$ 100,00 | Efeito no saldo reduz R$ 50,00 e histórico preserva ambas as versões. |
| Lançamento é cancelado | Continua consultável, com justificativa, sem efeito nos totais válidos. |
| Abertura, ajuste ou transferência movimenta um caixa | Saldo e histórico refletem a operação; base de arrecadação não aumenta. |
| R$ 15.000,00 elegíveis e R$ 3.000,00 de Construção | Demonstrativo mostra R$ 18.000,00 recebidos e calcula percentuais sobre R$ 15.000,00. |
| Demonstrativo usa os percentuais do exemplo | Prebenda líquida de R$ 4.725,00 e Catedral de R$ 5.136,00 mais contador; dízimo não é descontado duas vezes. |
| Demonstrativo é gerado ou regenerado | Nenhum lançamento, saldo ou situação de pagamento é criado por essa ação. |
| Lançamento de mês já demonstrado é alterado | Versão anterior permanece; aparece aviso e é possível nova geração. |
| Total filtrado abrange várias páginas | Soma e quantidade consideram todos os resultados autorizados. |
| Detalhes são fechados | Filtros e posição da listagem são preservados. |

Na implementação serão necessários testes focados das regras monetárias e de agrupamento, verificação de permissões e isolamento, testes de concorrência e repetição, testes de banco locais e validação dos fluxos no navegador. Aplicam-se também lint, typecheck, testes, build e demais verificações exigidas pelo AGENTS.md para as mudanças realizadas.

## Referência visual e fechamento da especificação

O usuário solicitou enviar um modelo de layout antes do fechamento final dos requisitos. A área financeira terá identidade visual própria dentro do sistema, e o atendimento terá uma tela dedicada com excelente usabilidade. O modelo deverá orientar a composição, os efeitos e a adaptação aos tamanhos de tela, preservando os fluxos aprovados.

A direção dos ajustes no banco e as regras complementares estão aprovadas. O próximo passo é receber a referência visual do usuário, incorporá-la neste mesmo documento e apresentar a composição da página principal e da tela dedicada de atendimento. A especificação consolidada será então revisada pelo usuário antes da elaboração do plano de implementação.

As alterações de esquema futuras devem usar novas migrações, preservar a história existente, ser verificadas em ambiente local ou de desenvolvimento aprovado e atualizar os tipos gerados. As aprovações funcionais e documentais desta etapa não substituem autorização explícita para aplicar mudanças em um banco remoto.
