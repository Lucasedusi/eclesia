# Relatórios de regionais

## Uso

Em **Estrutura Eclesiástica → Regionais**, o ícone de relatório ao lado de **Novo cadastro** abre as opções de exportação. O ícone também aparece para quem pode exportar, mesmo sem permissão para cadastrar.

- **Lista simplificada:** nome da regional, coordenador e telefone do coordenador; download em PDF ou Excel (`.xlsx`). O seletor **Filtros** permite incluir todas as regionais autorizadas (ativas e inativas) ou os resultados filtrados na tela, respeitando busca, situação e ordenação e incluindo todas as páginas.
- **Ficha da regional:** selecione uma regional para baixar seu PDF. Inclui coordenador e telefone no cabeçalho, nome da regional, quantidade e congregações vinculadas, com dirigente e contato. Sempre inclui ativas e inativas dentro do acesso autorizado. Também está disponível em **Detalhes da Regional → Imprimir / PDF**, com download direto e sem fechar os detalhes. A descrição cadastral não é impressa.
- Para imprimir, abra o PDF baixado e use a impressão do leitor de PDF.

O contato de cada congregação segue **WhatsApp → Telefone → Não informado**. É o contato cadastrado da congregação, não um telefone pessoal do dirigente. O telefone do coordenador usa o campo próprio da regional.

Os PDFs usam logo, cores e rodapé compartilhados com a ficha do membro, em A4, com **Eklesias**, data de emissão e numeração das páginas. O cabeçalho regional exibe apenas nome do campo e Presidentes; a ficha acrescenta coordenador e telefone. Endereço, telefone institucional e CNPJ não aparecem nesses cabeçalhos. Tabelas repetem os títulos nas páginas seguintes. O Excel possui cabeçalho, filtros, títulos fixos e telefones preservados como texto.

## Acesso e dados

A exportação exige `organization.view` e `regions.reports.export`. A nova permissão é concedida por padrão a **ADMIN** e **SECRETARY**, independentemente da permissão de edição. Os demais perfis dependem de concessão explícita; o escopo de ministério não exporta regionais.

Cada emissão consulta novamente os dados com sessão autenticada, RLS, igreja ativa e exclusão lógica. Acesso regional vê sua regional; acesso congregacional vê a regional vinculada e somente sua congregação na ficha. Relatórios restritos exibem uma indicação de que contêm apenas os registros autorizados.

Cada emissão registra auditoria com tipo, formato, escopo e quantidades, sem nomes, telefones ou conteúdo da busca. Se a auditoria falhar, o arquivo não é entregue. As respostas não são armazenadas em cache.

O limite é de 10.000 registros por consulta de regionais ou congregações, aplicado antes da busca textual. O serviço pagina a leitura, verifica as quantidades e rejeita inconsistências detectadas durante a geração, em vez de entregar uma lista silenciosamente truncada. Dados ausentes não impedem a emissão; listas vazias mostram uma mensagem.

## Entrega e validação — 04/11/2026

- Branch: `codex/relatorios-regionais`; execução e revisão sem subagentes.
- Migração `20261104173150_region_reports_export_permission.sql` aplicada localmente e no projeto online autorizado `eclesias_bd_sp` (`dhgrfvakdbtedqfgecys`). O histórico, a permissão ativa, os vínculos ADMIN/SECRETARY e as políticas de leitura foram conferidos após a aplicação.
- A migração adiciona apenas a permissão e seus vínculos; não altera tabelas, políticas RLS nem dados das congregações/regionais. Nenhum dado de teste foi inserido online.
- Tipos gerados localmente e pelo conector: a estrutura de `public` permaneceu idêntica. O arquivo versionado foi preservado para não remover metadados e outros schemas por diferenças entre geradores; não houve edição manual.
- `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test` e build de produção passaram. Suíte completa: **722 testes em 126 arquivos**.
- **5 cenários Playwright passaram**: PDF/XLSX e filtros com 25 regionais; ficha pelos dois pontos de entrada e retorno; erro recuperável em tela móvel; exportação pela secretaria e bloqueio de consulta; escopos regional/congregacional e bloqueio entre igrejas.
- PDFs sintéticos com logo, múltiplas páginas, textos longos e dados ausentes foram renderizados e inspecionados. As planilhas foram reabertas para verificar dados, formatação textual, filtros e cabeçalhos. A ficha do membro passou nos testes de regressão.
- SQL local verificou acesso anônimo, perfis, escopos, isolamento entre igrejas e registros arquivados. Advisors locais reportaram **13 avisos preexistentes de desempenho**: 9 `auth_rls_initplan` e 4 `multiple_permissive_policies`, em políticas que esta entrega não altera; nenhum erro foi reportado nessa execução.
- A suíte E2E executada foi a dos fluxos afetados. Análise de desempenho de rotas não se aplica: esta entrega não busca alterar carregamento ou desempenho das rotas existentes. O aplicativo não foi publicado automaticamente.

## Reproduzir os testes de navegador

Com Docker, Supabase local ativo/migrado e Chromium do Playwright instalado, execute na raiz do projeto:

```sh
node scripts/region-reports-local.mjs setup
node scripts/region-reports-local.mjs build
node scripts/region-reports-local.mjs start
```

Em outro terminal:

```sh
node scripts/region-reports-local.mjs e2e
node scripts/region-reports-local.mjs cleanup
```

O servidor usa a porta 3219. O script aceita apenas Supabase local e mantém sessões e identificadores fictícios em `tmp/region-reports`, ignorado pelo Git. Execute `setup` uma vez por ciclo e `cleanup` ao terminar; não use esse fluxo para criar dados no projeto online.

As verificações de banco estão em `supabase/tests/region_reports_verification.sql` (catálogo, somente leitura) e `supabase/tests/region_reports_scope.sql` (cenários fictícios locais em transação revertida).

## Refinamento visual

O modal geral mantém altura estável ao alternar os tipos de relatório, respeitando a tela e com rolagem interna quando necessário. Os selects reutilizam os controles compartilhados, com a borda cinza anterior (#D9DEEA) de 1px; somente no foco a borda muda para azul (#415BA5), sem sombra nem contorno adicional. O rodapé mantém apenas o download; X/Esc fecham o modal. No fluxo dos detalhes permanece o retorno aos detalhes. Os textos explicativos sobre WhatsApp, A4 e acesso foram retirados da interface; as regras continuam aplicadas.

O PDF simplificado usa “Lista de Regionais”, contagem e coluna “Telefone”. A ficha omite a situação da regional, usa o nome da regional em caixa alta e negrito como título e mostra a quantidade de congregações logo abaixo, sem negrito. Há um espaço maior após o telefone do coordenador para separar o próximo bloco. O texto “CONGREGAÇÕES VINCULADAS” foi removido. As listagens dos dois PDFs incluem a coluna “Nº”, com numeração contínua entre páginas. O filtro padrão de ativas e inativas não é impresso; filtros específicos continuam identificados discretamente. O Excel mantém sua apresentação anterior.

Validação do refinamento: 722 testes, 5 cenários de navegador, lint, tipagem e build passaram. PDFs e telas desktop/móvel inspecionados; o teste de navegador confirma altura e posição invariáveis durante a alternância. Nenhuma mudança no banco.

Validação da revisão de título e numeração: 723 testes passaram, incluindo sequência de 1 a 90 nos dois PDFs com múltiplas páginas, fontes distintas para título/quantidade, espaçamento e limites de página. Lint, tipagem e os 5 cenários de navegador passaram; PDFs renderizados e inspecionados. Build não repetido nesta revisão restrita ao conteúdo dos PDFs, sem mudanças de rotas, configuração, dependências ou limites entre servidor e cliente.

## Marca d’água e cabeçalho pastoral

Os PDFs de listagem e ficha usam a logo cadastrada como marca d’água centralizada em todas as páginas, com proporção preservada e opacidade de 5%. As linhas das tabelas deixam o fundo aparecer discretamente, mantendo texto e cabeçalhos em contraste integral. Sem logo válida, a exportação continua normalmente, sem marca d’água.

O cabeçalho mostra os nomes cadastrados em Pastor Presidente e Cônjuge do Pastor Presidente logo abaixo da igreja, inclusive nas páginas de continuação. Campos vazios são omitidos; nomes extensos quebram linha. A leitura usa a igreja do contexto autenticado e mantém os filtros de exclusão lógica. Nenhuma migração é necessária.

Validação: 793 testes, lint e tipagem aprovados; 9 cenários de navegador de congregações e regionais aprovados. PDFs em retrato, paisagem e múltiplas páginas renderizados e inspecionados. O PDF baixado no fluxo local contém os nomes pastorais cadastrados. Build não repetido: mudança restrita à consulta de campos existentes e à renderização, sem mudanças em rotas, configuração, dependências ou limites entre servidor e cliente. Não houve alterações no banco online.

## Ajustes de Regionais e marca dos PDFs — 07/11/2026

- Subtítulo simplificado; botão Relatório com borda/texto cinza e hover/foco equivalentes aos de Membros. Removido o indicador “Cargos ativos”; os três indicadores restantes ocupam a linha no desktop.
- Criação e edição organizadas em nome/status, coordenador/telefone e descrição de largura total; campos empilhados no celular.
- Detalhes com duas contagens (ativas/inativas), informações em quatro colunas no desktop e descrição abaixo, sem última atualização.
- Removidos os seletores redundantes de situação do modal de relatórios e a etapa intermediária da impressão nos detalhes. O download direto mantém a permissão de exportação, indica andamento e permite nova tentativa após falha.
- Cabeçalho específico de Regionais com espaçamento uniforme, repetido nas páginas seguintes. Título e quantidade próximos, com espaço maior antes da tabela. Mantidas numeração contínua, marca d’água, colunas, filtros aplicados e indicação de acesso restrito.
- Marca **Eklesias** no rodapé de todos os geradores PDF: Regionais, Congregações, ficha/listagens/credenciais de Membros, relatórios e comprovante digital do Financeiro, relatórios e comprovantes individuais/coletivos de Eventos. Cada formato mantém suas informações existentes; PVC preserva corte, sangria e QR, com marca discreta dentro da área final.
- Sem alterações de banco, permissões, escopos, auditoria ou exclusão lógica. Os testes de navegador usam apenas dados fictícios locais; o harness inclui administrador e regional inativa.

Validação: **858 testes em 135 arquivos**, lint sem avisos, tipagem e build de produção com configuração local aprovados. **8 cenários Playwright** passaram, incluindo filtros, impressão direta, recuperação de falha, cadastro/edição, desktop/móvel e restrições de acesso. PDFs sintéticos regionais, credenciais, documentos compartilhados e Eventos renderizados/inspecionados. Revisão realizada diretamente, sem subagentes. Advisors e verificações de migrações não se aplicam (nenhuma alteração de banco); análise de bundles não se aplica (nenhuma mudança destinada a desempenho de rotas). Nenhuma alteração no PDF local fora do escopo. A incorporação desta entrega à `main` online foi autorizada pelo usuário após a validação.
