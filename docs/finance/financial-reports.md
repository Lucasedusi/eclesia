# Relatórios financeiros

## Informativo geral por congregação — administradores

Em **Relatórios**, escolha **Informativo geral por congregação**. Informe os meses inicial e final; o padrão é o mês do cabeçalho. O relatório abrange todas as congregações autorizadas, incluindo a catedral, independentemente da unidade selecionada no topo. Congregações ativas entram por padrão; marque **Incluir congregações inativas** para consultar também as inativas.

A ordem é por maiores entradas, com desempate por nome. A tabela contém congregação, entradas, saídas, saldo final acumulado e, opcionalmente, repasse e prebenda bruta. A última linha soma as colunas entre congregações. O saldo é o encerramento do último mês, sem somar saldos mensais. As regras e os avisos dos valores opcionais são os mesmos do informativo individual; ausências tornam os respectivos valores/totais parciais. Transferências internas não entram nas receitas/despesas.

## Entrega de relatórios — administradores

Em **Relatórios → Acompanhar entregas**, selecione a referência e use **Todas**, **Entregues** ou **Não entregues**. A busca por nome e a inclusão de inativas também são aplicadas ao PDF. A catedral não participa desse controle.

**Registrar entrega** permite informar a data real do recebimento, após o fim da referência e até hoje. Gerar ou imprimir um demonstrativo não marca entrega. O recebimento pode ser registrado sem demonstrativo no sistema e não gera movimentação financeira. **Corrigir** permite ajustar a data ou desfazer o registro, exigindo motivo e preservando o histórico de responsáveis e horários.

Em **Configurações financeiras → Prazo de entrega**, defina o dia limite do mês seguinte e a referência inicial de vigência. O padrão é dia 8. Uma nova regra não modifica referências anteriores; dias inexistentes são ajustados ao último dia do mês. A classificação diferencia aguardando entrega, pendência em atraso, entrega no prazo e entrega com atraso.

## Informativo por congregação — administradores

Na mesma aba **Relatórios**, administradores da igreja podem selecionar **Informativo por congregação**. O modelo utiliza a congregação selecionada no topo e consolida todos os seus caixas e contas, inclusive o histórico de caixas inativos.

- Informe **Mês inicial** e **Mês final**. Ambos entram no relatório, inclusive meses sem movimentação. O padrão são os três meses terminando no mês selecionado no cabeçalho. Cada emissão aceita até 60 meses.
- Marque ou desmarque **Incluir prebenda bruta** e **Incluir repasse** independentemente.
- Gere o PDF para abrir em nova aba, imprimir ou baixar pelo fluxo já existente.

A tabela apresenta **Mês, Saldo inicial, Entradas, Saídas, Prebenda bruta (opcional), Repasse (opcional) e Saldo final**, sob a faixa verde clara **Evolução Mensal**. Congregação e período ficam à direita, alinhados ao título. O PDF não exibe quadros de indicadores, resumo final nem explicações de aberturas e ajustes. Esses movimentos continuam considerados nos saldos; transferências internas não entram nas receitas e despesas consolidadas.

As colunas calculadas usam a última versão existente do demonstrativo de cada mês:

- **Prebenda bruta:** valor após o teto configurado, antes do dízimo e demais descontos.
- **Repasse:** soma dos itens destinados à catedral com natureza de distribuição e cálculo percentual sobre a base elegível (`CATHEDRAL`, `DISTRIBUTION`, `ELIGIBLE_INCOME_PERCENT`). Respeita as regras históricas e a participação dos departamentos. Não inclui itens fixos, como contador, sistema e seguro, nem descontos sobre a prebenda. Não usa o total geral a entregar à catedral.
- **Não disponível:** não há demonstrativo gerado para o mês; é diferente de um cálculo de valor zero.
- **Asterisco:** a última versão está desatualizada. O PDF identifica mês e versão; seus valores calculados são preservados, enquanto entradas, saídas e saldos refletem os registros atuais. Gere uma nova versão na aba Demonstrativos se quiser atualizar o cálculo antes da emissão.

Prebenda e repasse não representam pagamentos e não reduzem novamente o saldo. Emitir o informativo não cria demonstrativos, despesas ou qualquer movimentação. Com as duas colunas desmarcadas, a emissão não depende de demonstrativos.

A opção fica oculta para outros perfis; requisições diretas também são negadas na aplicação e no banco. O relatório preserva o isolamento por igreja e congregação e utiliza uma consulta de leitura consistente para todo o período.

## Como usar

1. Abra **Financeiro → Relatórios**.
2. Confira o mês no cabeçalho. A congregação segue seu acesso: o tesoureiro comum tem somente a sua; quem pode consultar outras unidades verá apenas as unidades autorizadas.
3. Selecione **Sintético — resumo por categorias** ou **Analítico — lançamentos detalhados**.
4. Mantenha **Todos os caixas e contas**, ou escolha um caixa específico. Caixas inativos permanecem disponíveis para consulta do histórico.
5. Clique em **Gerar relatório**. Uma nova aba mostra o carregamento e abre o PDF automaticamente.
6. Use os controles do visualizador de PDF para imprimir ou salvar. Se o navegador bloquear a nova aba, clique em **Abrir PDF** na tela do sistema. **Baixar PDF** também permanece disponível após a geração.

A nova aba, o download e a impressão utilizam o mesmo arquivo. Não há prévia incorporada na tela do sistema. Mudar tipo, caixa, mês ou congregação exige nova geração. O PDF não é arquivado automaticamente no servidor: guarde o arquivo enviado à contabilidade. Uma nova emissão pode refletir correções feitas depois da anterior.

## Qual modelo escolher

- **Sintético:** organiza entradas e saídas de cada caixa/conta, resumidas por categoria. Os dízimos têm classificações recuadas sob a categoria e um subtotal identificado. Categorias sem classificações aparecem em uma única linha com seu total. Não lista nomes, descrições individuais, meios de pagamento ou quantidade na tabela principal. Caixas podem compartilhar uma página quando houver espaço; cabeçalhos e categorias continuam identificados nas páginas seguintes.
- **Analítico:** organiza primeiro por caixa/conta: entradas, seguidas das saídas do mesmo caixa. Cada novo caixa começa em outra página. As tabelas identificam pessoa ou favorecido, descrição, departamento e forma de pagamento; o caixa aparece no título da seção. Os dízimos são agrupados pela classificação registrada no lançamento, com um subtotal identificado por grupo (por exemplo, “Subtotal Dízimos — Jovem”). Outras categorias têm seu subtotal com o nome da categoria. Referências de documentos aparecem quando registradas.

Ambos têm cabeçalho da igreja, resumo do mês, saldos por caixa e identificação da emissão/páginas. O resumo por departamento permanece no sintético. Ambos incluem o endereço cadastrado da congregação; quando não houver endereço, informa essa ausência. O título em caixa alta fica à esquerda e a congregação/mês à direita. Cada modelo separa os indicadores iniciais das seções com um espaço maior e repete os mesmos quatro indicadores no “Resumo final do período”, respeitando o filtro de caixa. Nas contas bancárias, banco, agência e conta cadastrados aparecem discretamente abaixo do nome e nas páginas de continuação; dados não preenchidos são omitidos. Todos os departamentos entram, mesmo os que não participam da base de repasses. O mês é definido pela data financeira do lançamento.

## Como conferir os valores

**Saldo final = saldo anterior + entradas − saídas + aberturas de caixa no mês + ajustes + transferências líquidas do caixa selecionado.**

- No consolidado da congregação, transferências internas não alteram o saldo total nem contam como receitas/despesas.
- No recorte de um caixa, a transferência de saída reduz seu saldo e a de entrada aumenta seu saldo.
- Resultado do mês significa entradas menos saídas; pode ser diferente do saldo final.
- Aberturas e ajustes ficam separados das entradas/saídas comuns. Seus efeitos são explicados em observações compactas junto aos saldos por caixa. Nenhum modelo repete uma tabela detalhada de outros movimentos. No sintético, o encerramento reúne o resumo por departamento, os saldos por caixa e os quatro indicadores finais.
- Cancelados não entram na movimentação; correções válidas são consideradas junto dos efeitos de reversão no saldo.
- O cargo atual do membro não muda a classificação registrada do dízimo.

## Relatórios e demonstrativo

O demonstrativo calcula valores orientativos de repasse, prebenda e outros itens. Ele não registra pagamentos. Os relatórios só mostram esses valores como saídas depois de o tesoureiro registrar os respectivos lançamentos.

## Mensagens de conferência

- **Divergência entre lançamentos e movimentos de saldo:** o sistema impede a emissão para não apresentar uma conciliação incorreta. Peça ao administrador para revisar os registros, especialmente eventuais dados legados sem movimento correspondente. Não crie um ajuste apenas para ocultar a divergência.
- **Limite de 10.000 linhas:** selecione um caixa ou use o sintético. O sistema não corta registros silenciosamente. Esse limite conta linhas de dados e quadros auxiliares, não linhas de texto nem páginas físicas.
- **Falha de geração:** tente novamente. Gerar um relatório não altera lançamentos ou saldos.

## Impressão

A4 retrato, fontes incorporadas, texto pesquisável e tabelas de 7,5 pontos nos dois modelos, com cabeçalhos numéricos alinhados aos valores à direita. Ambos destacam ENTRADAS/TOTAL DE ENTRADAS em verde e SAÍDAS/TOTAL DE SAÍDAS em vermelho, com categorias em negrito. Cabeçalhos têm fundos claros, texto escuro e um pequeno detalhe lateral colorido. Totais usam destaque tipográfico e linha superior; indicadores e cabeçalhos têm cantos discretamente arredondados. Seções sem movimentação mantêm mensagem e total explícitos em apresentação compacta. O encerramento procura manter saldos, observações e indicadores finais na mesma página. A distinção entre entradas/saídas e o sinal dos valores continuam claros em preto e branco. A impressão usa os controles do navegador/visualizador de PDF; o sistema não escolhe a impressora automaticamente.

## Descrição de contribuições coletivas

Em Nova entrada e Atendimento, selecionar **Contribuição coletiva** mostra **Descrição da contribuição** logo abaixo da identificação. Use, por exemplo, “Oferta do culto de ensino”. O campo é opcional e é a mesma descrição já utilizada nos lançamentos e relatórios; não precisa ser repetido nos detalhes adicionais.

No atendimento com várias contribuições, os itens seguintes têm seu próprio campo de descrição. Ao trocar o tipo de identificação, o texto preenchido é preservado. Ao salvar e continuar, a descrição é limpa para o próximo atendimento.
