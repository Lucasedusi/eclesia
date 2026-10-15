# Especificação — Financeiro mobile e PWA do Eclesias

## Intenção aprovada

Oferecer ao tesoureiro uma experiência financeira confortável no celular, com aparência de aplicativo, acesso rápido às tarefas frequentes e leitura clara dos valores. A versão mobile usa as regras, os serviços, a auditoria e os dados financeiros existentes. A interface desktop e os layouts aprovados dos PDFs permanecem disponíveis.

O sucesso desta etapa significa que uma pessoa autorizada consegue consultar a posição do mês, localizar um lançamento, atender uma pessoa com várias contribuições, registrar entradas e saídas, consultar caixas, comprovantes, demonstrativos e relatórios em uma tela pequena, sem rolagem horizontal obrigatória nem perda silenciosa do preenchimento. O financeiro instalado abre diretamente na visão geral e funciona online.

## Referências visuais e linguagem

- As imagens fornecidas pelo usuário são referências de composição, não instruções operacionais. Das imagens 5 e 6, aproveitar a hierarquia de saldo, ações e lista; da imagem 1, o cartão verde profundo e a navegação de fácil alcance; da imagem 7, a facilidade para iniciar uma operação.
- Manter a identidade do financeiro: `#0B3D32` para a superfície de destaque, `#087F5B` para ações e valores positivos, fundos claros, `#B5474D` para saídas e cancelamentos, com o verde claro apenas como acento. Reutilizar os tokens e componentes existentes.
- Preferir números legíveis, texto curto, ícones com rótulo, divisórias discretas e movimento reduzido. Não incorporar elementos de banco de consumo, cartões fictícios, carrosséis, metas de investimento ou imagens promocionais.

## Organização da navegação

Na largura mobile, a navegação fixa inferior tem **Início**, **Lançamentos**, **Atendimento** e **Mais**. Atendimento só aparece quando a capacidade de criar lançamentos está disponível na congregação selecionada. A barra respeita a área segura do dispositivo e não cobre o conteúdo nem os controles de confirmação. No desktop, a barra lateral financeira atual permanece.

O cabeçalho mobile identifica o Financeiro, a congregação e o mês. Com uma única unidade autorizada, a congregação é texto; com várias, o seletor apresenta apenas as unidades autorizadas retornadas pelo servidor. Alterar a unidade ou o mês conserva o contexto na URL e passa pela proteção de formulário não salvo. A seleção de uma unidade para consulta não concede capacidade operacional: botões de escrita seguem as capacidades daquela unidade e a congregação de operação definida em **Usuários e permissões → Editar acesso → Operação financeira**.

**Mais** reúne Caixas e contas, Demonstrativos, Relatórios, Configurações quando permitidas e Voltar ao sistema. Itens sem permissão não aparecem. Links diretos e requisições continuam sujeitos à autorização no servidor.

## Telas e fluxos

### Início

Mostrar primeiro o saldo ao final do período, sempre identificado com seu significado. Abaixo, entradas e saídas confirmadas no mês, atalhos para Atendimento, Nova entrada, Nova saída e Caixas conforme a capacidade, e os cinco lançamentos mais recentes. Saldo inicial, aberturas e ajustes ficam em um resumo secundário. Gráficos vêm após as informações e ações principais. Ações rápidas aparecem apenas no mobile; a organização aprovada do desktop não muda. Transferências internas não aparecem como receita ou despesa do consolidado.

### Lançamentos e transferências

No mobile, substituir a tabela visível por cartões agrupados por data. Cada cartão exibe categoria, pessoa/favorecido ou descrição coletiva, departamento quando relevante, situação e valor com sinal e cor. A busca fica visível; os filtros de natureza **Todas / Entradas / Saídas** são imediatos; situação, classificação, departamento, categoria, caixa e forma de pagamento ficam em um painel de filtros com indicação dos filtros ativos e opção de limpar. Contagem e totais filtrados continuam presentes. Abrir um cartão mostra detalhes e, conforme autorização, Corrigir ou Cancelar com confirmação e justificativa existentes.

Transferências são apresentadas em seção separada, com origem, destino, data, valor e situação. Não são misturadas aos totais de entradas e saídas. A paginação e as consultas existentes continuam sendo a fonte dos dados; a apresentação mobile não recalcula saldos.

### Registro e atendimento

Entrada e saída usam uma coluna, seções curtas e controles nativos adequados ao celular para data e seleção. O fluxo de atendimento começa pela identificação da pessoa ou contribuição coletiva; depois mostra os dados comuns de recebimento e uma lista de contribuições. Cada contribuição mantém categoria, departamento, valor, descrição coletiva quando aplicável e classificação de dízimo quando a categoria exigir. É possível adicionar e remover itens dentro dos limites existentes. O total do atendimento e a ação principal permanecem acessíveis; Salvar e continuar e Salvar e imprimir ficam como ações secundárias explícitas.

Antes da confirmação, mostrar um resumo dos dados essenciais. Erros ficam junto aos campos e levam o foco ao primeiro problema. A máscara de centavos atual, a busca sem acentos, a credencial/QR com alternativa manual, anexos privados, a chave de repetição da tentativa e a proteção de formulário não salvo são reutilizados. Nenhum rascunho financeiro é persistido em armazenamento local. Se a rede cair durante uma gravação e o resultado for incerto, manter o preenchimento e a chave da tentativa até haver confirmação, sem criar automaticamente outro lançamento.

### Caixas, demonstrativos, relatórios e comprovantes

Caixas e contas usam cartões compactos com saldo, identificação bancária quando houver e ações autorizadas de ajuste ou transferência. Dados bancários não ganham destaque decorativo. Demonstrativos mostram resumo e composição em blocos expansíveis; o histórico versionado vira lista de cartões. O texto mantém explícito que o demonstrativo é orientativo e não registra pagamentos ou despesas.

Relatórios mantêm as opções, filtros, cálculos e o endpoint de PDF atuais. No mobile, a seleção ocupa uma coluna e mostra o progresso. Após gerar, oferecer **Abrir PDF** e **Baixar PDF**; tentar a abertura automática quando o dispositivo permitir e manter essas ações quando a nova aba for bloqueada. Os PDFs analítico e sintético, incluindo paginação, totais e cabeçalhos aprovados, não são redesenhados nesta etapa.

O comprovante é legível na tela e conserva a escolha de papel de 58 ou 80 mm e a impressão do navegador. Não há promessa de escolha automática de impressora. As configurações financeiras existentes continuam utilizáveis no celular, agrupadas por função; não se cria uma nova área Operadores.

## Arquitetura e fluxo de dados

As rotas em `src/app/(finance)/financeiro/` continuam sendo os pontos de entrada. Páginas e layouts seguem como Server Components, com leituras dependentes da requisição sob `Suspense`. Componentes mobile de navegação e apresentação vivem em `src/modules/finance/components/`; eles consomem os mesmos DTOs que as telas desktop. Formulários compartilham estado, validações e ações existentes. O desenho pode usar apresentações distintas para tabela e cartões, mas não cria consultas, comandos, cálculos financeiros ou autorização paralelos.

`requireFinanceContext()`, `PERMISSIONS`, as capacidades por unidade, os predicados de igreja/congregação, RLS, soft delete, auditoria, invalidação por tags e os serviços server-only permanecem como fronteira de segurança. Toda mutação continua validada no servidor. O cliente nunca define igreja, papel, escopo, classificação histórica ou base de cálculo por conta própria. A classificação do dízimo continua gravada no lançamento; regras de departamentos, teto de prebenda, percentuais e snapshots dos demonstrativos não mudam.

Em particular, departamentos entram na base de repasse apenas conforme sua configuração; os percentuais e valores permanecem específicos da congregação; a prebenda bruta é limitada pelo teto antes do desconto de dízimo, e o excedente permanece com a congregação. O demonstrativo continua orientativo e versionado, sem criar despesas ou pagamentos. Transferências internas alteram os caixas envolvidos, mas não as entradas, saídas ou o saldo consolidado da congregação.

As alterações previstas são de interface, metadados, arquivos públicos da PWA e testes. Não há mudança de esquema planejada. Se a implementação revelar necessidade real de banco, ela exigirá uma proposta e migração separadas antes de execução.

## PWA online

O manifesto financeiro usa identidade e ícone próprios, abertura em `/financeiro` e modo `standalone`. O escopo deve abranger `/login` e o retorno autenticado, para que a sessão expirada não quebre a experiência instalada; a ligação do manifesto será concentrada no Financeiro. A instalação em Android será testada em Chrome e a adição à tela inicial em iPhone será orientada conforme o navegador. Ícones incluem tamanhos adequados ao Android e ao iPhone.

Um service worker mínimo atende a navegação pela rede. Ele guarda no Cache Storage somente a página pública e neutra **Sem conexão**, com apresentação autocontida. Todas as outras requisições usam a rede, inclusive arquivos da aplicação, páginas financeiras, respostas de Server Components, autenticação, ações, APIs, PDFs, comprovantes e dados de pessoas. Respostas financeiras e de documentos devem usar cabeçalhos que impeçam armazenamento indevido no cache HTTP. Sem rede, uma navegação para o Financeiro ou login mostra a página neutra e um botão para tentar novamente; não há fila nem confirmação fictícia de operações.

Atualizações da aplicação não recarregam uma tela com preenchimento pendente. Quando uma versão estiver pronta, oferecer atualização após salvar ou descartar, usando a proteção de alterações não salvas já existente. O navegador ou sistema operacional ainda pode encerrar o aplicativo; esta etapa não promete recuperar um rascunho após esse encerramento.

O proxy atual deve permitir buscar publicamente manifesto, ícones, script do service worker e página neutra sem conexão, sem tornar pública qualquer rota financeira. A sessão expirada deve seguir o login seguro com retorno a `/financeiro`; acesso negado segue as mensagens e limites atuais.

## Estados, acessibilidade e desempenho

Todas as telas apresentam carregamento, vazio, erro e confirmação com texto específico. Alvos de toque têm pelo menos 44 × 44 CSS px, os formulários não são encobertos pelo teclado, e o layout não exige rolagem horizontal em 320, 375, 390 e 430 CSS px. Rótulos, foco visível, ordem de leitura, anúncio de status e preferência por movimento reduzido são preservados. Impressão oculta a navegação mobile.

Medir tamanho de recursos por rota e Core Web Vitals mobile com a telemetria existente, sem dados pessoais ou valores financeiros. Registrar uma linha de base antes da alteração. Como meta para tráfego real, usar no percentil 75: LCP até 2,5 s, INP até 200 ms e CLS até 0,1; esses números não substituem a verificação de fluxos em aparelhos reais. Mudanças de bundle e latência são comparadas com a linha de base e justificadas se crescerem.

## Validação e critérios de aceite

- Em Android e iPhone, o atalho instalado abre o Financeiro; após expiração da sessão, login e autorização devolvem o usuário ao destino financeiro permitido.
- Um tesoureiro de congregação não vê nem opera outra unidade. Acessos amplos consultam somente as unidades permitidas e operam apenas onde a capacidade correspondente for concedida.
- Em 320–430 CSS px, as tarefas principais cabem sem rolagem horizontal, com navegação e ações alcançáveis ao toque; o desktop conserva sua navegação e os PDFs aprovados.
- Entrada, saída e atendimento com várias contribuições produzem os mesmos resultados, histórico, classificação de dízimo e comprovantes que o fluxo atual. Correção, cancelamento e transferência seguem auditoria e autorização existentes.
- Para os mesmos lançamentos e regras, saldos, base de repasse, teto bruto da prebenda, desconto do dízimo e valores das versões do demonstrativo são iguais no mobile e no desktop; o demonstrativo não produz pagamentos ou despesas.
- Mudar tela, mês, congregação ou aceitar atualização durante preenchimento aciona a proteção de alterações não salvas. Uma resposta incerta de gravação não duplica a operação.
- Sem conexão, não há leitura de dados financeiros guardados pela PWA nem possibilidade de confirmar uma escrita. Ao retornar a conexão, a navegação permite tentar novamente.
- Relatório sintético e analítico abrem ou podem ser baixados no celular; a impressão de recibos de 58/80 mm e a impressão desktop permanecem disponíveis.
- Testes focados, lint, tipos, suíte unitária, build e cenários de navegador passam. Testar instalação, sessão, conexão e PDF em Android e iPhone reais antes de disponibilizar a PWA aos usuários.

## Fora desta etapa

Lançamentos offline, sincronização, notificações, armazenamento local de rascunhos, integração nativa com impressoras, aplicativo de loja e autoatendimento do membro em tablet exigem avaliação e aprovação específicas.

## Referências do projeto

- `docs/finance/financial-reports.md`
- `docs/finance/2026-10-14-final-usability.md`
- `docs/finance/validation-and-rollout.md`
- `src/modules/finance/`
- `src/styles/finance-theme.ts`
- [Guia PWA do Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [WebKit: aplicativos da tela inicial no iPhone](https://webkit.org/blog/13878/)
- [Metas de Core Web Vitals](https://web.dev/articles/vitals)
