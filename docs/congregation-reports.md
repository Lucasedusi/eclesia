# Relatórios de congregações

## Listagem

Em **Estrutura Eclesiástica → Congregações**, use o ícone de relatórios ao lado de **Novo cadastro**. Usuários com permissão de exportar também veem o ícone quando não podem cadastrar.

A listagem inclui sempre numeração, nome da congregação, regional e dirigente. No PDF, a regional aparece menor abaixo do nome; no Excel ela tem coluna própria. **Cônjuge, WhatsApp e Endereço** são opções independentes, permitindo oito combinações. Inicialmente, apenas WhatsApp fica marcado.

- Formatos: PDF e Excel (`.xlsx`).
- Filtros: todos os registros autorizados ou os resultados filtrados na tela, em todas as páginas.
- Filtros preservados: busca, situação, regional (inclusive sem regional), sede/congregação e ordenação.
- PDF A4 em retrato; ao selecionar Endereço, a orientação passa automaticamente para paisagem.
- Endereço completo inclui logradouro, número, complemento, bairro, cidade/UF e CEP, conforme preenchimento.
- Numeração contínua e cabeçalhos repetidos nas páginas seguintes. Nomes e endereços longos quebram linha.
- Excel com títulos fixos, filtros e telefones/CEP preservados como texto.

## Ficha individual

Em **Detalhes da Congregação**, o botão **Imprimir / PDF** baixa diretamente a ficha e mantém os detalhes abertos. Usa a identidade da igreja, fontes e rodapé compartilhados com a ficha de membro.

1. **Cabeçalho:** nome do campo, Presidentes e uma linha com dirigente, cônjuge e WhatsApp, usando espaçamento uniforme.
2. **Topo do corpo:** nome em caixa alta e negrito e regional próximos, com espaço maior antes do endereço.
3. **Endereço:** logradouro e número, complemento, bairro, cidade, estado e CEP.
4. **Observação:** texto integral quando preenchido.

Complemento e observação vazios são omitidos. Informações essenciais ausentes exibem “Não informado”. Cônjuge é opcional na listagem e fixo na ficha. O endereço usa três colunas; observação ocupa a largura disponível. Rótulos em cinza diferenciam-se dos valores escuros. As seções podem continuar em outras páginas, sem truncar o conteúdo.

Na listagem (PDF e Excel) e na ficha, **WhatsApp** usa apenas o WhatsApp cadastrado; se ausente, mostra “Não informado”. O telefone convencional nunca substitui o WhatsApp. O e-mail não é incluído na ficha.

## Acesso e operação

A exportação exige `organization.view` e `congregations.reports.export`, concedida por padrão a ADMIN e SECRETARY. Não exige permissão de edição. Igreja, escopo regional/congregacional e exclusão lógica são verificados no servidor com cliente autenticado e RLS. Escopo de ministério não exporta. Uma sede sem regional pode aparecer no relatório, conforme as regras existentes do cadastro.

O serviço consulta os campos opcionais conforme a seleção. Observações são lidas apenas para a ficha; cônjuge é lido na ficha e quando selecionado na listagem. E-mail não é consultado para estes relatórios. Auditoria registra formato, quantidade, escopo, opções e presença de filtros, sem nomes, telefones, e-mails, observações ou texto da busca. Falha na auditoria impede a entrega do arquivo. Respostas usam `private, no-store`.

A consulta é paginada e limitada a 10.000 congregações após os filtros de banco e antes da busca textual. Quantidades inconsistentes ou páginas duplicadas durante a geração produzem erro em vez de exportação incompleta. A interface permite tentar novamente após falha e bloqueia downloads duplicados enquanto gera o arquivo.

## Entrega e validação

Implementação na branch `codex/relatorios-regionais`, sem subagentes, conforme solicitado. Migração `20261105234750_congregation_reports_export_permission.sql` aplicada localmente e no projeto online autorizado `eclesias_bd_sp` (`dhgrfvakdbtedqfgecys`). Catálogo de permissões, ADMIN/SECRETARY, políticas de leitura e histórico de migração conferidos online. A migração não altera tabelas, campos nem políticas; nenhum dado fictício foi inserido online.

- **783 testes em 130 arquivos passaram**, incluindo oito combinações de campos, prioridade de contato, paginação, ausência de dados, permissões, auditoria, filtros, segurança do endpoint e regressão dos PDFs de regionais/membros.
- **4 cenários Playwright passaram**: PDF/Excel e opções com 27 registros autorizados; filtros e ficha diretamente dos detalhes; erro recuperável em tela móvel; secretaria/viewer e acessos regional/congregacional, com bloqueio entre igrejas.
- Lint sem avisos, tipagem e build de produção passaram.
- PDFs em retrato/paisagem, ficha, textos longos e telas desktop/móvel renderizados e inspecionados. Planilhas reabertas para validar colunas e valores literais.
- SQL local verificou catálogo, acessos anônimo/autenticado, escopos, outra igreja e registros arquivados. Advisors locais: 9 avisos `auth_rls_initplan` e 4 `multiple_permissive_policies`, em políticas preexistentes que esta entrega não altera; nenhum erro nessa execução.
- Tipos regenerados localmente para comparação: a estrutura de `public` é idêntica ao arquivo versionado. O arquivo existente foi preservado, sem edição manual ou remoção de metadados do gerador.
- E2E limitado aos fluxos afetados; análise de desempenho de rotas não se aplica. Aplicativo não publicado automaticamente.

## Testes locais

Com Docker e Supabase local iniciados e migrados, e Chromium do Playwright instalado:

```sh
node scripts/congregation-reports-local.mjs setup
node scripts/congregation-reports-local.mjs build
node scripts/congregation-reports-local.mjs start
```

Em outro terminal:

```sh
node scripts/congregation-reports-local.mjs e2e
node scripts/congregation-reports-local.mjs cleanup
```

Porta 3220. O script aceita somente Supabase local. Sessões e identificadores fictícios ficam em `tmp/congregation-reports`, ignorado pelo Git. Execute `setup` uma vez por ciclo e `cleanup` ao finalizar. Os testes de banco estão em `supabase/tests/congregation_reports_verification.sql` (somente leitura) e `supabase/tests/congregation_reports_scope.sql` (dados sintéticos locais em transação revertida).

Revisão visual de novembro: listagem com regional abaixo do nome e cônjuge abaixo do dirigente, sem colunas Regional/Atualização. Formulário sem Telefone visível, preservando valores históricos. Detalhes sem box de situação e sem Código, Tipo, Ordem de exibição, País e Telefone; contagem inclui apenas anexos ACTIVE, não arquivados, com a autorização administrativa existente. Formulário de Cargos sem Descrição visível, preservando o conteúdo já salvo.

## Marca d’água e cabeçalho pastoral

Os PDFs de listagem e ficha usam a logo cadastrada como marca d’água centralizada em todas as páginas, com proporção preservada e opacidade de 5%. As linhas das tabelas deixam o fundo aparecer discretamente, mantendo texto e cabeçalhos em contraste integral. Sem logo válida, a exportação continua normalmente, sem marca d’água.

O cabeçalho mostra apenas o nome do campo e a linha “Presidentes”, com os nomes cadastrados em Pastor Presidente e Cônjuge do Pastor Presidente, inclusive nas páginas de continuação. Na ficha, acrescenta dirigente, cônjuge e WhatsApp; endereço e CNPJ da igreja não entram no cabeçalho. O rodapé mantém Eklesias, data e paginação. Campos vazios são omitidos; nomes extensos quebram linha. A leitura usa a igreja do contexto autenticado e mantém os filtros de exclusão lógica. Nenhuma migração é necessária.

Validação: 793 testes, lint e tipagem aprovados; 9 cenários de navegador de congregações e regionais aprovados. PDFs em retrato, paisagem e múltiplas páginas renderizados e inspecionados. O PDF baixado no fluxo local contém os nomes pastorais cadastrados. Build não repetido: mudança restrita à consulta de campos existentes e à renderização, sem mudanças em rotas, configuração, dependências ou limites entre servidor e cliente. Não houve alterações no banco online.

## Validação dos ajustes visuais — 07/11/2026

864 testes em 136 arquivos e 6 cenários de navegador aprovados. Lint sem avisos, tipagem e build de produção local aprovados. A verificação cobriu a contagem de documentos concluídos (ACTIVE), exclusão de pendentes/arquivados, preservação de telefone e descrição históricos ao editar, WhatsApp sem fallback, filtros, escopos, isolamento entre igrejas e layout desktop/móvel. PDFs em retrato/paisagem e com continuação inspecionados. Sem mudança de banco, permissões ou publicação online nesta etapa.
