# Relatórios financeiros — plano de implementação

> **Execução:** usar `superpowers:executing-plans`, diretamente nesta conversa, sem subagentes, conforme preferência do usuário. Este documento planeja o trabalho; sua criação não inicia a implementação. As etapas usam caixas de seleção para acompanhamento.

**Objetivo:** oferecer relatórios mensais analítico e sintético que permitam ao tesoureiro conferir a movimentação e compartilhar um PDF legível com a contabilidade.

**Arquitetura:** nova área `/financeiro/relatorios`, dentro do módulo existente. Uma projeção autorizada no banco produzirá os dados consistentes de cada emissão; serviços do domínio montarão o documento e gerarão o PDF. A prévia, o download e a impressão reutilizarão os mesmos bytes dessa emissão.

**Tecnologias:** Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres, Zod, Styled Components e infraestrutura visual existente. PDF com `pdf-lib`, `@pdf-lib/fontkit`, fontes locais e carregamento seguro de logo já disponíveis no projeto.

**Especificação:** seção “Definição do produto” deste documento; baseada nas solicitações do usuário e na análise dos dois PDFs do sistema antigo.

**Estado:** implementação autorizada em 12/10/2026. Validação e entrega registradas em `docs/finance/2026-10-12-reports-validation.md`.

**Confirmação de acesso:** o seletor oferece apenas as congregações autorizadas. Tesoureiro comum acessa somente a própria congregação; isso também é verificado diretamente na geração do PDF e na RPC.

## Restrições gerais

- Execução direta, sem subagentes. Consultar `AGENTS.md` e os guias locais do Next.js antes da implementação.
- Preservar igreja, congregação e permissões do contexto autenticado; nunca aceitar `churchId` do navegador como autoridade.
- Reutilizar `finance.view` e o escopo já aplicado à consulta dos lançamentos. A exportação não amplia o acesso a outras unidades ou a dados do cadastro de membros.
- Valores em centavos inteiros na aplicação; somas em `numeric` no banco. Rejeitar valores fora da faixa segura de inteiros ao construir o DTO.
- Relatórios não criam lançamentos, não confirmam pagamentos, não encerram o mês e não alteram demonstrativos.
- Novas funções de banco em nova migração, com RLS e privilégios mínimos. Não modificar migrações históricas.
- Nenhum dado real dos PDFs fornecidos deve entrar em fixtures, capturas de testes ou arquivos versionados.
- Alterações remotas ficam para a execução aprovada, depois da validação local; esta etapa é apenas planejamento.

## Definição do produto

### 1. Nova aba Relatórios

Adicionar “Relatórios” à navegação financeira, após “Demonstrativos”, conservando congregação e mês selecionados e o funcionamento do menu recolhido/mobile.

Página com título “Relatórios” e subtítulo “Confira a movimentação do mês e prepare os documentos para impressão.” Sem texto de categoria acima do título.

Oferecer duas opções de seleção, com ícones e descrição curta:

| Opção | Descrição ao usuário |
| --- | --- |
| Sintético — resumo por categorias | Veja quanto entrou e saiu em cada categoria. |
| Analítico — lançamentos detalhados | Confira cada entrada e saída, com pessoas e descrições. |

O sintético será a seleção inicial. Filtros iniciais: congregação e mês do cabeçalho existente, mais “Todos os caixas e contas” ou um caixa/conta específico. Exibir também caixas inativos com histórico pertinente ao período.

Fluxo: escolher tipo e filtros → “Gerar relatório” → prévia do PDF → “Baixar PDF” ou “Imprimir”. O botão de geração terá ícone de carregamento sem alterar sua largura; a área de prévia terá skeleton/status acessível.

A geração será explícita, pois pode reunir muitos lançamentos. Alterar tipo, mês, unidade ou caixa invalida a prévia anterior e exige nova geração. Respostas antigas não podem substituir uma geração mais recente.

Não incluir, nesta primeira versão, filtros de categoria, departamento ou pessoa: eles produziriam recortes que não representam o saldo completo de um caixa. A listagem de lançamentos continua oferecendo essas buscas. Novos recortes de relatório poderão ser planejados depois com rótulos e totais próprios.

### 2. Estrutura comum dos documentos

1. **Identificação:** logo e nome configurados da igreja, congregação, tipo do relatório e período por extenso. CNPJ e município, quando cadastrados, em linha secundária compacta.
2. **Resumo do mês:** saldo anterior, entradas, saídas e saldo ao final do período. Apresentar “Resultado do mês” como entradas menos saídas em linha auxiliar, sem chamá-lo de saldo disponível.
3. **Movimentação:** conteúdo sintético ou analítico, conforme o tipo escolhido.
4. **Resumo por departamento:** entradas e saídas de cada departamento com movimento. Construção, Missões e outros aparecem integralmente, mesmo quando não participam do cálculo de repasses.
5. **Caixas e contas:** quadro de conciliação dos saldos e movimentos, sem repetir todo o relatório dentro de cada caixa.
6. **Outros movimentos de saldo:** transferências, ajustes e saldos de abertura inseridos no mês, somente quando existirem. Explicar em linguagem simples por que afetam o saldo.
7. **Rodapé:** data/hora de emissão, identificação curta da emissão e “Página X de Y”. Identificação e período resumidos nas páginas seguintes.

No resumo, se existirem movimentos adicionais, mostrar uma linha compacta de conciliação: saldo anterior + entradas − saídas + aberturas no mês + ajustes + transferências líquidas do recorte = saldo final. Componentes zerados podem ser omitidos. Transferências líquidas são zero ao selecionar todos os caixas da congregação.

### 3. Sintético

- Duas seções principais: **Entradas por categoria** e **Saídas por categoria**.
- Somar a categoria em todos os caixas selecionados. Nunca obrigar o usuário a juntar manualmente os dízimos recebidos em dinheiro e no banco.
- Dízimos discriminados pela classificação registrada no lançamento: Presbíteros, Diáconos etc. Não consultar o cargo atual do membro para reconstruir esse agrupamento.
- Mostrar categoria/classificação, quantidade de lançamentos e total, com subtotal por categoria e total da seção. Quantidade significa lançamentos, não pessoas distintas.
- Não exibir nomes de contribuintes no sintético.
- Não repetir nomes completos de categorias em níveis desnecessários. Categorias de nomes iguais, mas IDs distintos, não podem ser mescladas inadvertidamente.
- Quando um mesmo cadastro tiver nomes históricos diferentes no período, preservar as variantes registradas e somá-las no subtotal do mesmo ID; não renomear o passado silenciosamente.

### 4. Analítico

- Duas seções principais: **Entradas** e **Saídas**, agrupadas por categoria, com subtotal de cada grupo e total da seção.
- Dentro de cada grupo, ordenar por data crescente e identificador estável para desempate.
- Colunas compactas: **Data**, **Pessoa / descrição**, **Departamento**, **Caixa / pagamento**, **Valor**.
- Pessoa / descrição: nome registrado do contribuinte ou favorecido, classificação do dízimo quando houver, descrição do lançamento e referência de documento quando informada. Usar uma segunda linha apenas quando houver informação complementar.
- Contribuições coletivas e pessoas sem cadastro usam a identificação registrada no lançamento; não inventar nomes nem exigir cadastro retroativamente.
- Caixa / pagamento informa o nome do caixa/conta e a forma de pagamento, por exemplo “Conta principal · Pix”. Não imprimir números de conta, CPF, tokens ou referências técnicas de pagamento sem necessidade.
- Usar uma única coluna de valor em cada seção, evitando colunas de entrada/saída repletas de zeros.
- Não cortar nomes, descrições ou referências para caber em uma linha. Quebrar o texto e ajustar a altura da linha; descrições excepcionalmente longas podem continuar na página seguinte com identificação da continuação.

### 5. Regras de valores e histórico

- O mês considera a **data financeira do lançamento**, mantendo o critério da visão geral atual. Não usar data de criação nem introduzir outro regime de competência.
- Incluir lançamentos confirmados e não excluídos. Cancelados não compõem receitas, despesas nem linhas de movimentação; seus efeitos de reversão continuam considerados nos saldos do livro de movimentos.
- Correções aparecem com os valores e dados vigentes na emissão; as revisões anteriores permanecem na auditoria existente.
- Saldo anterior: soma do livro de movimentos até antes do primeiro dia do mês. Saldo final: soma até antes do primeiro dia do mês seguinte. Nunca usar o saldo atual para representar um mês passado.
- Aberturas registradas dentro do mês não são receitas; ajustes não são receitas/despesas ordinárias. Exibi-los separadamente quando necessários à conciliação.
- Transferências entre caixas da mesma congregação não são receitas ou despesas. No relatório completo, são apresentadas uma vez como movimentação interna; por caixa, mostrar origem/destino e o efeito líquido correspondente.
- Quadro por caixa: saldo anterior, entradas, saídas e saldo final. Quando houver aberturas, ajustes ou transferências, inserir linhas auxiliares assinadas por caixa para que a conta feche sem uma tabela excessivamente larga.
- Todas as categorias e departamentos entram nos relatórios de movimentação. O indicador “participa da base de cálculo” afeta somente o demonstrativo de repasses.
- Não somar valores calculados de repasse, prebenda, dízimo da prebenda, sistema, contador e seguro às saídas. Eles só aparecem nas saídas quando efetivamente lançados.
- Saldo negativo sempre tem sinal explícito, inclusive na impressão em preto e branco.
- Os relatórios analítico e sintético devem produzir os mesmos totais para o mesmo recorte e o mesmo estado dos dados.
- Cada emissão consulta um estado consistente do banco. Na primeira versão, não criar fechamento contábil nem arquivo permanente de emissões no servidor. O PDF baixado preserva a emissão; gerar novamente após correções pode alterar o resultado. Exibir essa explicação junto à prévia.
- Se registros legados sem correspondência no livro impedirem a conciliação, impedir a emissão e informar que os lançamentos precisam de conferência; não compensar a diferença artificialmente nem apresentar um saldo aparentemente conciliado.

### 6. Direção visual e impressão

- A4 retrato, fundo branco, margens de 12 mm e identidade verde do financeiro em detalhes discretos.
- Corpo de tabelas de 9 a 10 pt, metadados/rodapé de 8 a 8,5 pt e títulos de seção de 11 a 12 pt. Título principal de até 16 pt. Não reduzir o corpo abaixo de 9 pt para economizar páginas.
- Números alinhados à direita, valores em real com duas casas decimais, datas em `dd/mm/aaaa` e pesos tipográficos moderados.
- Cabeçalho elegante e compacto com logo proporcional, sem faixa de tinta pesada. A ausência de logo não quebra o alinhamento nem impede a emissão.
- Verde suave nas entradas e vermelho suave nas saídas; texto e títulos distinguem as seções independentemente da cor.
- Sem gráficos decorativos, grandes cartões, efeitos animados ou espaços vazios que prejudiquem o aproveitamento do papel.
- Repetir cabeçalhos das tabelas quando houver continuação; manter títulos junto à primeira linha e subtotais junto à última linha sempre que couberem.
- O sintético deve caber em uma página quando o volume permitir, sem prometer uma única página para qualquer quantidade de categorias.
- PDF pesquisável, com fontes incorporadas e acentuação preservada. A prévia utiliza o PDF gerado; baixar e imprimir reutilizam esse mesmo arquivo.

### 7. Limites desta entrega

Incluídos: dois relatórios mensais, uma congregação por emissão, consolidado de caixas ou um caixa específico, prévia, download PDF, impressão e tratamento de estados vazios/erros.

Ficam para propostas futuras: consolidação entre congregações, período arbitrário, exportação Excel, envio automático ao contador, assinatura digital, fechamento contábil e arquivo permanente/versionado de relatórios. A geração de relatórios não depende dessas funções.

## Evidências e decisões técnicas

- `finance-query.service.ts` e a RPC `get_finance_overview` já distinguem saldo anterior, aberturas do mês e ajustes.
- `list_finance_transactions` pagina 20 registros; não reutilizar essa página como fonte integral de um relatório nem aumentar seu limite indiscriminadamente.
- `financial_ledger_entries` preserva aberturas, transações, transferências, reversões e ajustes. As reversões conservam a data financeira da origem.
- `financial_transactions` já guarda nomes de pessoa, categoria, departamento e classificação no lançamento. Caixas e formas de pagamento devem ser resolvidos por IDs e igreja, com alternativa legível quando o cadastro relacionado não estiver disponível; não eliminar o movimento por falta do cadastro.
- `member-sheet-pdf.service.ts` oferece referência de fontes locais/paginação; `church-logo.service.ts` oferece carregamento seguro de logo. Reutilizar recursos existentes sem copiar limitações de truncamento de texto de outros PDFs.
- Há necessidade prevista de uma nova RPC de leitura para obter movimentos e agregações com a mesma visão do banco. Não é prevista nova tabela de lançamentos ou de relatórios.

## Contratos e arquivos

### Contratos do domínio

- `FinanceReportOptions`: `{ type: "ANALYTIC" | "SYNTHETIC"; month: string; cashboxId?: string }`.
- `FinanceReportSummary`: centavos de `openingCents`, `incomeCents`, `expenseCents`, `openingMovementCents`, `adjustmentCents`, `transferNetCents`, `closingCents`; contagem dos lançamentos.
- `FinanceReportProjection`: união discriminada por `type`, contendo período, caixa selecionado, instante de leitura, resumo, quadros por departamento/caixa e outros movimentos. Analítico inclui linhas individuais; sintético inclui apenas agregações, sem nomes de pessoas.
- `FinanceReportDocument`: projeção acrescida de identidade da igreja, congregação e identificador de emissão gerado no servidor. A logo será `logoDataUri: string | null` carregada pelo serviço seguro existente.
- `getFinanceReport(context: FinanceContext, options: FinanceReportOptions): Promise<FinanceReportDocument>`.
- `createFinanceReportPdf(document: FinanceReportDocument): Promise<Uint8Array>`.
- `POST /api/finance/reports/pdf`: recebe `{ congregationId, type, month, cashboxId? }`; resolve `requireFinanceContext` com `FINANCE_PERMISSIONS.view`, valida todos os parâmetros e retorna PDF privado. Nunca recebe totais ou nomes como dados confiáveis.
- RPC `get_finance_report(p_church_id uuid, p_unit uuid, p_options jsonb) returns jsonb`: `STABLE SECURITY INVOKER`, `search_path=''`, autenticação/escopo e RLS, execução revogada de `PUBLIC`/`anon`, permitida a `authenticated` com validação de autorização interna.

### Mapa de arquivos

Novos:
- `src/app/(finance)/financeiro/relatorios/page.tsx`
- `src/app/api/finance/reports/pdf/route.ts` e `route.test.ts`
- `src/modules/finance/types/finance-report.types.ts`
- `src/modules/finance/validations/finance-report.schemas.ts` e `.test.ts`
- `src/modules/finance/services/finance-report.service.ts` e `.test.ts`
- `src/modules/finance/services/finance-report-pdf.service.ts` e `.test.ts`
- `src/modules/finance/utils/finance-report-layout.ts` e `.test.ts`
- `src/modules/finance/components/finance-reports.tsx`
- `supabase/tests/finance_reports.sql`
- `e2e/finance-reports.spec.ts`
- `docs/finance/financial-reports.md`

Alterados: `finance-shell.tsx`, `finance-shell.styles.ts`, `finance-skeleton.tsx`, `src/lib/supabase/database.types.ts` (gerado), `scripts/finance-local.mjs` quando fixtures adicionais forem necessárias. Criar migração com o CLI para `finance_reports`; o nome com timestamp será gerado no momento da execução.

## Pontos de revisão prioritários

1. Transferências, aberturas no mês e ajustes: o saldo precisa conciliar por caixa e no consolidado — testes da tarefa 2.
2. Correções retroativas, cancelamentos e mudança de nome/cargo: preservar os dados financeiros registrados e a igualdade dos totais — tarefas 2 e 3.
3. Muitas linhas, nomes longos e descrições extensas: não truncar informação nem sobrepor o rodapé — tarefas 4 e 7.
4. Troca de congregação/filtro durante geração: não exibir ou baixar relatório de outra seleção — tarefas 5 e 6.
5. Solicitação direta de PDF fora do escopo e referências inativas/ausentes: negar acesso indevido sem perder movimentos históricos autorizados — tarefas 2, 3 e 5.

## Etapas de implementação

### Tarefa 1 — Contratos e exemplos de conferência

**Arquivos:** tipos/schema e testes correspondentes; fixtures locais de relatórios.
**Entrega:** opções validadas e dados fictícios representativos para orientar todos os testes.

- [x] Criar testes de validação para tipo inválido, mês inválido, UUID inválido, campos desconhecidos e opções válidas de ambos os relatórios; executar e confirmar falha inicial.
- [x] Implementar os contratos acima e schema estrito. Separar dados sintéticos de dados analíticos para evitar enviar nomes desnecessários.
- [x] Preparar fixtures fictícias: dízimos da mesma classificação em dinheiro/Pix, ofertas de Missões, saídas, transferências, ajustes, cancelamento, correção e saldo negativo.
- [x] Fixar exemplo de conciliação: anterior 1.000,00 + entradas 1.500,00 − saídas 600,00 + abertura no mês 200,00 − ajuste 50,00 = final 2.050,00; transferência interna de 300,00 não altera esse consolidado. Dízimos de 400,00 e 620,00 na mesma classificação totalizam 1.020,00 no sintético.
- [x] Executar `npm test -- src/modules/finance/validations/finance-report.schemas.test.ts`; exigir sucesso e registrar commit da unidade de trabalho.

### Tarefa 2 — Consulta consistente e conciliação no banco

**Arquivos:** nova migração `finance_reports`, `supabase/tests/finance_reports.sql`, tipos gerados.
**Consome:** opções da tarefa 1. **Produz:** RPC `get_finance_report` e `FinanceReportProjection`.

- [x] Escrever verificações SQL com as fixtures da tarefa 1: totais analítico/sintético iguais, caixa específico com transferência líquida, mês anterior, abertura no primeiro dia, ajuste negativo, cancelamento e correção com mudança de data/caixa. Confirmar falha sem a RPC.
- [x] Implementar uma leitura consistente para todos os valores financeiros, sem sequência de consultas paginadas suscetível a alterações concorrentes. Usar a data financeira e livro de movimentos para saldos, e transações confirmadas para receitas/despesas.
- [x] Agregar por IDs e nomes históricos de categoria/classificação; não usar o cargo atual do membro. Incluir caixas inativos com saldo/movimentação e referências históricas ausentes com rótulo neutro, sem omitir valores.
- [x] Testar ausência de dados, receitas ou despesas isoladas, valores negativos, e divergência entre transações e livro. A divergência deve retornar erro seguro de conferência, nunca um PDF conciliado artificialmente.
- [x] Testar `anon`, usuário sem permissão, outra igreja e congregação fora do escopo, inclusive manipulação de `cashboxId`. Verificar grants, RLS e `search_path`.
- [x] Limitar a 10.000 linhas imprimíveis por emissão, incluindo movimentos auxiliares; no sintético, contar agregações, não transações de origem. Retornar erro explícito ao exceder, nunca relatório parcial. Não usar o limite padrão da Data API como corte silencioso.
- [x] Executar o SQL no ambiente local com rollback de fixtures, avaliar plano de consulta em volume representativo, rodar advisors e regenerar tipos. Adicionar índice somente se houver necessidade demonstrada. Registrar commit.

### Tarefa 3 — Serviço de relatório e identidade da igreja

**Arquivos:** `finance-report.service.ts` e testes.
**Consome:** RPC da tarefa 2. **Produz:** `getFinanceReport`.

- [x] Escrever testes de autorização, validação da resposta, centavos, totais divergentes, logo indisponível, ausência de nomes opcionais e não vazamento de dados pessoais no sintético; confirmar falha inicial.
- [x] Consultar a RPC com cliente autenticado e escopo explícito. Validar estrutura e integridade dos valores retornados antes de produzir o documento.
- [x] Carregar nome/logo configurados via padrões existentes de `app_settings`/`churches` e `loadChurchLogoDataUri`. Não aceitar URL arbitrária de logo enviada pelo navegador.
- [x] Gerar identificador de emissão e preservar o instante de leitura do banco. Tratar falhas com mensagens seguras, sem logar nomes, doações ou conteúdo do documento.
- [x] Executar `npm test -- src/modules/finance/services/finance-report.service.test.ts`; exigir sucesso e registrar commit.

### Tarefa 4 — Layout e geração dos dois PDFs

**Arquivos:** `finance-report-pdf.service.ts`, `finance-report-layout.ts` e respectivos testes.
**Consome:** `FinanceReportDocument`. **Produz:** `createFinanceReportPdf`.

- [x] Escrever testes de medidas/quebra de linhas e geração: acentos, ausência de logo, valores negativos, texto sem espaços, descrições extensas, subtotais na quebra de página e rodapé com número total de páginas.
- [x] Implementar recursos de paginação específicos do relatório: margens em pontos, cálculo da altura de linhas, reserva do rodapé, continuação de linha excepcionalmente alta, repetição de cabeçalhos e identificação resumida.
- [x] Implementar resumo comum, seções sintéticas e analíticas, quadros por departamento/caixa e outros movimentos. Não desenhar seções auxiliares vazias.
- [x] Gerar PDFs de exemplo com dados fictícios de 0, 1, 49 e 1.000 lançamentos; renderizar páginas para inspecionar visualmente, inclusive uma impressão simulada em tons de cinza. Conferir nomes, valores e quantidade de linhas extraindo texto do PDF.
- [x] Ajustar densidade/espaçamento sem diminuir corpo abaixo de 9 pt. Comparar prévias dos dois modelos e comprovar ausência de cortes, sobreposições e páginas vazias inesperadas.
- [x] Executar testes focados do serviço/layout; registrar commit e manter exemplos de QA fora do versionamento de dados de produção.

### Tarefa 5 — Endpoint privado de PDF

**Arquivos:** `src/app/api/finance/reports/pdf/route.ts` e testes.
**Consome:** tarefas 1, 3 e 4. **Produz:** resposta PDF autenticada.

- [x] Ler os guias locais de Route Handlers/Server Components do Next.js instalado antes de escrever a rota.
- [x] Criar testes para 401 sem sessão, 403 fora do escopo, opções inválidas, corpo acima de 4 KiB, origem indevida, limite de linhas e resposta PDF válida; confirmar falha inicial.
- [x] Implementar POST com body limitado, schema estrito e `requireFinanceContext`. Reutilizar os serviços anteriores, sem cache compartilhado nem credencial administrativa.
- [x] Retornar `Content-Type: application/pdf`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` e nome de arquivo seguro contendo tipo/período. Não expor detalhes internos em erros.
- [x] Testar falha de geração sem qualquer escrita em lançamentos, saldos ou demonstrativos. Executar testes da rota e registrar commit.

### Tarefa 6 — Aba, seleção e prévia

**Arquivos:** página, `finance-reports.tsx`, navegação, estilos e skeleton.
**Consome:** endpoint da tarefa 5. **Entrega:** fluxo completo pela interface.

- [x] Preparar cenários Playwright: abrir pela navegação recolhida/mobile, selecionar relatório/caixa, gerar, visualizar, baixar e preparar impressão, com estados de carregamento/erro.
- [x] Implementar página Server Component com `resolveFinancePage` e `Suspense`; limitar Client Component à seleção, requisição e prévia. Reutilizar controles acessíveis e identidade visual do financeiro.
- [x] Armazenar o Blob apenas na sessão da página e reutilizar seus bytes para prévia/download/impressão. Revogar object URLs ao trocar documento ou desmontar. Cancelar/ignorar requisições obsoletas.
- [x] Invalidar arquivo ao alterar filtros e desabilitar ações enquanto não houver documento atual. Em navegadores sem visualização embutida, oferecer abrir/baixar o mesmo PDF sem gerar novamente.
- [x] Exibir estado vazio no PDF com saldos pertinentes, mensagem de erro recuperável na tela e explicação de que nova emissão reflete os dados atuais.
- [x] Executar os cenários focados; confirmar que prévia e download têm os mesmos bytes e que trocar de unidade não mantém dados anteriores. Registrar commit.

### Tarefa 7 — Validação integrada e instruções de uso

**Arquivos:** `e2e/finance-reports.spec.ts`, `docs/finance/financial-reports.md`, fixtures locais.
**Entrega:** evidências de conferência e instruções curtas de uso.

- [x] Comparar os dois relatórios com lançamentos e livro de movimentos da mesma fixture; confirmar saldo anterior/final e classificação registrada, inclusive após mudança do cargo do membro.
- [x] Testar que gerar um demonstrativo de repasse não altera as saídas dos relatórios; registrar uma saída real na fixture e confirmar que somente então aparece.
- [x] Testar mais de 20 e mais de 1.000 registros para detectar paginação/truncamento; testar o limite de 10.000 e erro acima dele. Verificar tempo e memória antes de validar esse limite para o ambiente de implantação.
- [x] Testar mês sem movimento mas com saldo anterior, categoria renomeada, caixa inativo, duplicidade de nomes de categorias, nome longo da igreja e logo indisponível.
- [x] Inspecionar PDFs e tela em desktop/mobile; revisar contraste, navegação por teclado, carregamentos, impressão em A4 e em tons de cinza.
- [x] Rodar `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test`, `npm run build` e os E2E financeiros afetados. Usar o ambiente local com fixtures e sessões autenticadas do harness financeiro, não dados online de teste.
- [x] Documentar diferença entre relatórios e demonstrativo, sequência de geração, efeito dos filtros, reemissão após correções e como salvar/imprimir. Registrar limitações ou testes impossíveis com motivo exato.
- [x] Revisar o diff para escopo, segurança, dados pessoais e migrações históricas; registrar commit.

### Tarefa 8 — Aplicação e conferência de entrega

**Consome:** validações anteriores aprovadas. **Entrega:** recurso disponível no ambiente autorizado.

- [x] Confirmar ambiente remoto autorizado e diferenças de migrações. Aplicar somente a nova migração de leitura, sem fixtures ou alteração de valores financeiros.
- [x] Verificar permissões/definição da RPC com consultas de leitura; conferir histórico de migrações e atualizar tipos gerados se necessário. Reexecutar verificação de tipos após a geração.
- [x] Integrar o código conforme autorização de publicação vigente; distinguir explicitamente commit local, envio ao repositório e implantação do aplicativo no relatório final.
- [x] Registrar validações concluídas, URL/forma de acesso quando disponível e verificações remanescentes. Não declarar impressão física testada sem que tenha ocorrido.

## Critério de conclusão

O tesoureiro consegue selecionar o mês, gerar qualquer um dos dois relatórios e identificar de imediato o que entrou, o que saiu e quanto restou. O sintético consolida categorias/classificações; o analítico permite localizar cada lançamento. Ambos conciliam com os mesmos movimentos, respeitam o acesso da congregação, incluem todos os departamentos e podem ser impressos sem cortes e sem depender de cores para compreensão.

## Registro de execução

Implementação e validação realizadas diretamente, sem subagentes. Evidências, limites de verificação e decisão de desempenho constam em `docs/finance/2026-10-12-reports-validation.md`. A entrega utiliza duas migrações: a consulta inicial e uma otimização posterior dos catálogos, mantendo a primeira migração imutável. O seletor de congregações e a geração direta do PDF foram testados com o tesoureiro restrito à própria congregação. A integração é local; publicação do aplicativo/GitHub não realizada nesta etapa.
