# Especificação — Lançamento via extrato bancário

Data: 23/10/2026. Estado: proposta detalhada para aprovação.

O usuário aceitou as recomendações da análise de viabilidade: importação do XLSX do Sicoob, conferência no computador, conta bancária selecionada uma vez, fila persistente e confirmação individual dos movimentos. As decisões adicionais descritas abaixo são propostas para esta primeira versão. A implementação será feita em branch separada após aprovação; publicação na `main` e alterações no banco remoto dependem de autorização própria.

## Intenção e resultado esperado

Reduzir a digitação e os erros de transcrição no registro das movimentações bancárias, especialmente na Catedral. O sistema prepara data, direção, valor e informações de origem. O tesoureiro confere, classifica e identifica a pessoa quando necessário, finalizando cada movimento.

Importar ou complementar uma linha cria apenas uma pendência de conferência. O saldo, os relatórios e os demonstrativos só são afetados quando um lançamento ou uma transferência é efetivamente confirmado pelo fluxo financeiro autorizado. A conferência pode ser interrompida e retomada em outra sessão.

O sucesso é medido pela capacidade de revisar o extrato sem redigitar os dados bancários, retomar o trabalho e identificar quais movimentos foram registrados, vinculados a registros existentes, ignorados ou continuam pendentes.

## Evidência disponível

O arquivo de exemplo tem uma aba `LANÇAMENTOS`, título na primeira linha, cabeçalhos na segunda e cinco colunas: Data, Documento, Histórico, Informações complementares e Valor.

- São 33 movimentos de um único dia: 22 créditos e 11 débitos.
- Datas são textos no formato `DD/MM/AAAA`; valores são números com sinal.
- As três linhas finais são `SALDO DO DIA`, `SALDO BLOQUEADO ANTERIOR` e `SALDO ANTERIOR`.
- Saldo anterior mais os movimentos assinados corresponde ao saldo do dia neste exemplo.
- Cinco movimentos não têm informações complementares; 27 contêm texto em várias linhas.
- Documento se repete, inclusive em combinações de mesma data e valor. Nenhuma das 33 linhas é idêntica considerando as cinco colunas.
- O título é genérico e não identifica a conta bancária.

O arquivo real permanece fora do repositório. Testes e capturas usam dados fictícios que reproduzem sua estrutura. Uma amostra de vários dias será útil durante a validação para confirmar eventuais variações da exportação; formatos não reconhecidos deverão ser apresentados como incompatíveis, sem inferências silenciosas.

## Abordagens consideradas

1. **Prévia mantida apenas na sessão:** menor alteração inicial, mas o tesoureiro depende da tela aberta e perde a organização do trabalho ao interromper a conferência.
2. **Fila persistente de importações e itens:** permite retomada, auditoria, rastreamento de cada movimento e revisão de sobreposições entre arquivos. Requer novas estruturas no banco. Foi a abordagem recomendada e aceita pelo usuário.
3. **Automação ampla com PDF, integração bancária e classificação automática:** aumenta o escopo e não é necessária para resolver a redigitação. Fica como evolução possível, sujeita a avaliação própria.

## Escopo da primeira versão

- XLSX do Sicoob no formato reconhecido pelo adaptador.
- Acesso pelo computador em **Financeiro → Lançamentos → Importar extrato**.
- Consulta das importações anteriores da congregação e conta autorizadas, com opção de continuar a conferência.
- Preparação das linhas, rascunhos salvos no servidor, finalização individual e ação **Finalizar e próximo**.
- Registro de entrada ou saída, vínculo com lançamento já existente, tratamento explícito de transferência interna e opção de ignorar com motivo.
- Conferência de repetição do arquivo, possíveis movimentos já importados e candidatos a lançamentos manuais existentes.
- Histórico de responsáveis, datas e decisões; vínculo entre origem bancária e resultado financeiro.

Ficam para outra etapa: PDF/OCR, conexão com banco, categorização automática, confirmação de todo o extrato em um clique, regras aprendidas por remetente, operação offline e rateio de uma saída por várias categorias ou de uma entrada entre várias pessoas. A primeira versão aproveita o atendimento existente para uma entrada com várias categorias da mesma pessoa, com a soma obrigatoriamente igual ao crédito bancário.

## Fluxo de uso

### 1. Escolher conta e enviar arquivo

A congregação segue o contexto financeiro e as capacidades do usuário. O seletor apresenta somente contas bancárias ativas da unidade em que ele pode criar lançamentos. Se houver apenas uma, ela vem selecionada; havendo várias, a escolha é obrigatória. Nome, banco e identificação cadastrada da conta ajudam na conferência.

O arquivo fica associado à igreja, congregação e conta escolhidas. Essa associação é imutável após preparar a importação. O período vem das datas dos movimentos e pode atravessar meses; o mês do cabeçalho não reescreve datas nem exclui linhas do arquivo.

Enviar novamente o mesmo arquivo para a mesma conta abre a importação já existente. Uma exportação diferente com períodos sobrepostos passa pela conferência de movimentos; não é bloqueada apenas por coincidir o período.

### 2. Conferir a leitura

Mostrar conta, período, quantidade de movimentos, totais de créditos e débitos e eventuais pendências de leitura. As linhas reconhecidas de saldo são apresentadas como referências do extrato, fora da lista de movimentos a lançar.

Quando a estrutura permitir relacionar saldo inicial, movimentos e saldo final de um mesmo intervalo, conferir essa igualdade. Ausência de saldos não impede a importação. Divergência gera uma pendência de conferência do arquivo, com motivo necessário para prosseguir. Saldo bloqueado não é tratado como movimentação.

Essa conferência verifica a leitura do arquivo. A diferença entre o saldo bancário e o saldo já registrado no Eclesias pode decorrer de movimentos anteriores ainda não lançados e não produz ajustes automáticos de caixa.

### 3. Revisar a fila

A lista apresenta data, entrada/saída, valor, histórico, resumo das informações complementares, situação e ação **Conferir**. A informação completa de origem fica acessível no detalhe do item. Usar os componentes e as cores do financeiro, com saídas em vermelho discreto.

Filtros: pendentes, concluídos, ignorados e todas; direção e busca textual. Contagens mostram o progresso. O detalhe permite salvar um rascunho e continuar depois, finalizar, finalizar e abrir o próximo pendente ou ignorar com motivo. Campos ainda não salvos usam a proteção de navegação existente.

As situações finais são distintas: **Lançado** para registro criado pela importação, **Vinculado** para registro financeiro já existente e **Ignorado** para decisão justificada. Alertas de leitura, possível duplicidade e alteração posterior são exibidos junto à situação, sem confundir um alerta com confirmação financeira.

Dois usuários autorizados podem trabalhar no mesmo lote. Revisões concorrentes do mesmo item exigem recarregar os dados; uma confirmação já concluída é exibida ao segundo usuário em vez de criar novo movimento.

### 4. Complementar e finalizar

Data, valor total, direção bancária e conta são preenchidos a partir da origem e não são editáveis no formulário de classificação. O servidor obtém esses valores do item armazenado, não do pedido enviado pelo navegador.

O tesoureiro completa categoria, departamento, forma de pagamento e identificação da pessoa ou favorecido conforme as regras existentes. Dízimos exigem identificação e classificação aplicáveis. O histórico bancário serve como referência e não se torna automaticamente uma categoria financeira.

Uma forma de pagamento pode vir sugerida quando o histórico tiver significado inequívoco e existir uma única opção ativa compatível com a conta, como PIX. A sugestão fica visível e conferível. Sem correspondência segura, o campo permanece pendente. Categorias e pessoas não são atribuídas automaticamente nesta versão.

O texto de origem fica preservado. O nome do remetente não é tratado como prova de qual membro contribuiu. A descrição financeira que aparecerá nos relatórios é um campo próprio; não copiar automaticamente todo o conteúdo bancário para relatórios ou comprovantes.

Para entrada com várias categorias da mesma pessoa, reutilizar as regras do atendimento e exigir que a soma dos itens seja exatamente o crédito do extrato. Não alterar o total de origem para acomodar diferenças. Saídas usam um item na primeira versão.

Finalizar cria os registros usando o núcleo financeiro existente, mantém auditoria e disponibilidade dos comprovantes atuais e atualiza a situação do item na mesma transação de banco. A interface só anuncia sucesso após confirmação. Uma falha de rede permite repetir a tentativa sem duplicar dinheiro.

### 5. Resolver registros existentes, transferências e itens ignorados

**Já lançado:** permitir localizar e vincular um lançamento confirmado da mesma igreja, congregação e conta, com data, direção e valor compatíveis. Um atendimento existente pode ser vinculado como conjunto quando seus itens confirmados correspondem integralmente ao crédito. Não vincular parcialmente um grupo nesta versão. O vínculo não cria nem altera dinheiro.

**Transferência interna:** o operador identifica explicitamente que o movimento corresponde a uma transferência entre caixas da mesma congregação. A conta do extrato define a ponta de origem ou destino conforme o sinal; o usuário escolhe a outra ponta. Exigir a permissão de transferências. Pode criar pelo comando atual ou vincular uma transferência existente compatível. Ao importar o extrato da outra conta, vincular a outra ponta da mesma transferência, evitando registrá-la duas vezes.

Um PIX ou uma transferência bancária para terceiro não é necessariamente transferência interna. Repasses entre congregações seguem as regras financeiras atuais e não são convertidos automaticamente em transferências entre caixas.

**Ignorar:** exigir motivo e preservar a linha e a decisão no histórico. Ignorar não remove dados nem altera saldo. Um item ignorado pode voltar a pendente por ação explícita e auditada. Registros de saldo reconhecidos pelo leitor são excluídos antes dessa fila e não precisam de justificativa individual.

Se um lançamento vinculado for corrigido ou cancelado posteriormente, o item indica a alteração e deixa de aparecer como conferido quando os valores deixarem de corresponder. Não há recriação automática. O usuário resolve pela consulta e pelos comandos autorizados de correção, cancelamento ou novo vínculo, preservando o histórico anterior.

Um item já lançado não pode simplesmente ser ignorado ou voltar a pendente. Para gerar outro lançamento pela mesma origem, é necessário confirmar o cancelamento do anterior e reabrir a conferência com motivo. Um vínculo equivocado com um lançamento que já existia pode ser desfeito com motivo, sem cancelar esse lançamento. Vincular o mesmo lançamento, atendimento ou ponta de transferência a duas origens bancárias distintas é bloqueado; exportações sobrepostas reconhecidas como a mesma origem compartilham a referência anterior.

## Leitura e integridade do arquivo

O adaptador identifica os cabeçalhos normalizando espaços, caixa e acentos. Aceita o título e linhas vazias conhecidos; classifica explicitamente as linhas de saldo. Uma linha desconhecida ou com dados inválidos não pode desaparecer silenciosamente da conferência.

Datas são convertidas como datas locais, sem deslocamento de fuso. Valores precisam ser numéricos, finitos, diferentes de zero para movimentos e representáveis em centavos dentro do limite financeiro existente. Não arredondar silenciosamente precisão extra. O sinal determina crédito ou débito; descrições não invertem o sinal. Documento é preservado como referência textual, não como identificador único.

Usar leitura no servidor com a biblioteca XLSX já presente no projeto. Validar extensão, assinatura, estrutura e limites antes de persistir. Proposta inicial: 5 MB por arquivo e 5.000 movimentos, com limites de descompressão, células e tempo definidos no plano técnico. Fórmulas não são executadas nem usadas como valores de origem. Não processar macros, links externos ou conteúdo incorporado.

O adaptador recebe uma versão identificável para permitir evolução sem mudar a interpretação dos dados já importados. Uma planilha com múltiplas abas ou estrutura inesperada pede correção do arquivo; a aplicação não escolhe silenciosamente uma aba de dados.

## Duplicidades e repetição segura

Há três problemas distintos:

1. **Mesmo envio ou mesma confirmação:** identificar o arquivo por hash no servidor e manter uma identidade persistente para cada item. Retentativas reabrem o lote ou devolvem o resultado já confirmado.
2. **Movimentos em exportações sobrepostas:** comparar origem normalizada, incluindo data, direção, valor, documento, histórico e informações complementares, sempre dentro da mesma conta e igreja. Uma coincidência é um candidato; ocorrências repetidas legítimas precisam continuar representadas. Não impor unicidade só por documento, data/valor ou impressão digital textual.
3. **Lançamentos manuais anteriores:** procurar candidatos compatíveis na mesma conta. Coincidências fracas não são prova. O tesoureiro pode vincular o registro correto ou confirmar que é outro movimento; decisões sobre candidatos fortes exigem justificativa.

Uma linha reconhecida explicitamente como a mesma movimentação já tratada referencia o resultado anterior e não oferece um novo lançamento. Confirmar que são movimentos diferentes é uma decisão explícita e auditada. A ausência de identificador bancário único neste formato impede prometer detecção perfeita entre arquivos diferentes.

Na primeira versão, coincidência integral dos campos normalizados entre importações é um candidato forte e exige resolução antes de registrar novamente. Uma coincidência apenas de data, valor ou documento é fraca: pode sugerir registros para consulta, mas não bloqueia por si só nem exige justificar todos os recebimentos comuns de mesmo valor. A escolha explícita de um vínculo sempre exige compatibilidade financeira e confirmação do operador.

A conferência é repetida no servidor ao finalizar. Travas e revisão do item impedem gravações simultâneas. Criar o lançamento e guardar sua associação ao extrato é uma operação atômica; nunca fazer duas chamadas independentes que possam deixar apenas metade do trabalho concluída.

## Dados, autorização e integração

Criar estruturas específicas para lote, item e vínculos financeiros. O lote guarda conta, unidade, versão do leitor, identificação segura do arquivo, hash, intervalo e contagens. O item guarda posição de origem, campos bancários necessários, valores normalizados, rascunho, revisão, situação e responsáveis. Os vínculos aceitam um lançamento, um atendimento com vários lançamentos ou uma ponta de transferência, mantendo histórico de alterações.

O arquivo XLSX original não será guardado em Storage nesta versão. Persistir somente os campos necessários à conferência e rastreabilidade, com acesso restrito. Dados bancários não entram em logs, telemetria, fixtures, mensagens de erro ou capturas de testes. Rascunhos ficam no servidor; não usar armazenamento local nem cache offline.

O acesso ao fluxo exige as capacidades de consulta e criação na congregação. Busca de membros continua exigindo sua capacidade própria; transferência, correção e cancelamento mantêm suas permissões. Todas as consultas e mutações derivam a igreja do contexto autenticado e validam unidade, conta e recurso no servidor. Revogação de acesso bloqueia também lotes antigos. A troca do contexto de congregação nunca transfere um lote para outra unidade.

As novas tabelas usam RLS, concessões mínimas e relações que incluem `church_id`. As rotinas atômicas seguem os padrões existentes de autenticação, escopo, `search_path`, idempotência e auditoria. Priorizar funções invoker; qualquer função privilegiada deve ter necessidade documentada e verificações explícitas.

Adicionar um comando específico de finalização da importação que valida e trava o item, monta os dados confiáveis e reutiliza o núcleo financeiro. Marcar a origem do lançamento como importação e manter o vínculo completo. Não dar ao navegador liberdade para registrar um item como concluído sem o resultado financeiro correspondente.

Rotas sugeridas: `/financeiro/lancamentos/importacoes` e `/financeiro/lancamentos/importacoes/[id]`, preservando os padrões de Server Components, `Suspense` e componentes interativos do módulo. Serviço de leitura e mutações são server-only. A fila usa paginação e filtros no servidor. Finalizações invalidam as tags financeiras da unidade e as referências de importação afetadas.

A primeira versão segue o limite desktop já usado nas ferramentas financeiras de conferência. Acesso direto em tela pequena oferece orientação para usar o computador e retorno aos lançamentos. Isso não muda os fluxos mobile existentes.

## Validação e aceite

- Ler uma fixture fictícia equivalente ao exemplo como 33 movimentos, 22 créditos, 11 débitos e três referências de saldo, sem gerar dinheiro no upload.
- Exercitar múltiplas datas, centavos, sinais, campos ausentes, documento repetido, complemento em várias linhas, linhas desconhecidas, fórmulas e limites de arquivo.
- Conferir que saldo inicial mais movimentos corresponde ao saldo final quando os três pertencem ao mesmo intervalo; ausência ou incompatibilidade não produz ajuste financeiro.
- Salvar e retomar rascunho após fechar a sessão; filtros e progresso distinguem todas as situações.
- Registrar entrada, saída e entrada em várias categorias; o total final deve corresponder exatamente ao movimento bancário.
- Reenviar arquivo, repetir confirmação após resposta perdida e confirmar com dois operadores; cada item produz no máximo uma operação financeira válida por decisão de origem.
- Exercitar exportações sobrepostas, linhas idênticas legítimas e candidatos manuais; não descartar automaticamente uma movimentação só porque tem mesma data, documento e valor.
- Vincular lançamento e atendimento existentes sem mudar saldo; criar ou vincular transferência e reconhecer sua outra ponta ao importar a outra conta.
- Ignorar e restaurar com motivo; corrigir ou cancelar lançamento posterior e exibir a pendência correspondente sem recriação automática.
- Bloquear acesso anônimo, outra igreja, unidade não autorizada, conta incompatível, referência inativa e manipulação de data, sinal ou valor pelo navegador.
- Executar testes focados, lint, tipos, suíte unitária, build e cenários autenticados de navegador. Conferir desktop, teclado, carregamento, erros e orientação mobile.
- Executar verificações SQL, Advisors e regeneração dos tipos em ambiente local ou desenvolvimento explicitamente autorizado. Usar uma migração nova e preservar todas as anteriores.

A validação funcional inclui o arquivo real fornecido apenas em inspeção local e amostras fictícias nas rotinas repetíveis. Não criar lançamentos de teste no banco online. Relatórios, demonstrativos e comprovantes atuais devem continuar produzindo seus resultados para os mesmos lançamentos.

## Decisões deixadas ao plano técnico

Nomes finais das tabelas e funções, índices específicos, formato interno dos DTOs, organização dos componentes, orçamento de processamento XLSX e detalhes visuais de espaçamento podem ser definidos durante o planejamento, respeitando estas regras. Alterações que ampliem o escopo funcional, como rateio de saídas ou confirmação em massa, voltam para discussão.

## Referências do projeto

- `src/modules/finance/actions/finance-command.actions.ts`
- `src/modules/finance/services/finance-command.service.ts`
- `src/modules/finance/services/finance-access.service.ts`
- `src/modules/finance/validations/finance-command.schemas.ts`
- `src/modules/finance/components/finance-entry-form.tsx`
- `src/modules/finance/components/finance-transactions-workspace.tsx`
- `src/modules/members/import/` como referência de leitura e conferência de XLSX, sem compartilhar suas tabelas de negócio.
- `supabase/migrations/20261003212733_finance_atomic_commands.sql`
- `docs/finance/financial-reports.md`
- `AGENTS.md` e `supabase/AGENTS.md`.
