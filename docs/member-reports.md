# Listagens de membros

Na tela **Membros**, use o botão **Relatório**, ao lado de **Novo membro**. A janela mantém o tamanho ao trocar de modelo, com conteúdo rolável e o botão de download sempre disponível.

| Modelo | Formatos | Colunas |
| --- | --- | --- |
| Simplificada | PDF e Excel (.xlsx) | Matrícula, nome do membro, congregação, WhatsApp e cargo atual |
| Completa | Excel (.xlsx) | Campos cadastrais disponíveis para o acesso, uma linha por membro |
| Personalizada | PDF e Excel (.xlsx) | Matrícula e nome fixos; de zero a quatro campos adicionais distintos |

Na personalizada, a ordem de seleção define a ordem das colunas. Congregação e WhatsApp começam selecionados. Ao atingir quatro opções, é necessário desmarcar uma para escolher outra. Naturalidade / UF e endereço completo são opções compostas; as partes também podem ser selecionadas individualmente.

## Abrangência e filtros

- **Todos os membros não arquivados**: todos os registros autorizados, em ordem alfabética, independentemente da página aberta.
- **Resultados filtrados na tela**: mantém busca, regional, congregação, cargo, situação, tipo, lote de importação, seleção de arquivados e ordenação. Inclui todas as páginas.
- A busca segue o comportamento da tela: pelo menos três caracteres, nome ou matrícula; CPF somente para quem tem a permissão correspondente. A busca por CPF não herda o limite de 100 correspondências da consulta da tela.
- O limite é de **10.000 membros**, após filtros estruturados e antes da busca textual. Acima disso, a exportação pede filtros adicionais. A lista nunca é truncada silenciosamente. A leitura também interrompe caso detecte mudança de contagem ou duplicação entre páginas; tente novamente nesse caso.

## Campos da completa

O catálogo é explícito em `src/modules/members/constants/member-report-fields.ts`. Inclui:

- Identificação e vínculo: matrícula, nome, congregação, regional, cargo atual, início no cargo, situação e tipo de membro.
- Dados pessoais: sexo, nascimento, estado civil, nacionalidade, naturalidade, UF de nascimento, profissão e escolaridade.
- Documentos: CPF, RG e órgão emissor, conforme permissão.
- Contato e família: WhatsApp, e-mail, pai, mãe e cônjuge.
- Endereço: CEP, logradouro, número, complemento, bairro, cidade, UF e país.
- Vida eclesiástica: conversão, batismo nas águas, igreja do batismo, batismo no Espírito Santo e data, igreja anterior, forma/data de recebimento, igreja de origem da carta, data de transferência, igreja de destino e motivo da inativação.
- Observações gerais, data de cadastro e data da última atualização.

O cargo é o vínculo ativo mais recente pela data de início, com desempate estável; o título feminino segue o cadastro do cargo e a preferência do vínculo. A listagem não inclui cargos históricos, linha do tempo, eventos, finanças, documentos anexados, identificadores técnicos nem campos legados sem uso no formulário.

**Observações pastorais restritas nunca são consultadas, disponibilizadas para seleção ou exportadas**, mesmo quando o usuário pode vê-las em outras áreas. Observações gerais são um campo diferente e permanecem disponíveis.

## Permissões e segurança

A exportação exige `members.view_basic`, `members.view_full` e `members.export`. A criação de membros não é necessária para exibir o botão.

- CPF, RG e órgão emissor exigem `members.view_sensitive_identity`.
- Cargo e início no cargo exigem `member_roles.view`. Sem essa permissão, a simplificada conserva a coluna Cargo com “Informação restrita”; a completa omite ambas as colunas. Solicitações personalizadas forjadas são rejeitadas.
- Arquivados exigem `members.restore`.
- O servidor aplica igreja, exclusão lógica e escopo ativo (`CHURCH`, `REGION`, `CONGREGATION` ou `MINISTRY`), além das políticas do banco. Um segundo acesso mais amplo não amplia a listagem do escopo selecionado.
- Escopo de ministério exige `ministries.view` e vínculos ativos com o ministério do contexto. A congregação pode estar indisponível pelas políticas existentes; isso não exclui o membro autorizado da exportação. Nessa situação, sua coluna mostra “Informação indisponível”. Filtros e escopo de regional exigem acesso de leitura à organização.
- A consulta seleciona somente os campos necessários; CPF pode ser lido para a busca autorizada sem aparecer como coluna. A observação geral só é lida quando faz parte do modelo escolhido.
- O POST `/api/members/reports` verifica sessão, permissões, origem, tamanho do corpo e esquema estrito. Respostas usam `private, no-store` e `nosniff`.
- A auditoria `EXPORT_MEMBER_REPORT` guarda modelo, formato, colunas, quantidade, escopo e presença de filtros, sem valores pessoais nem texto da busca. Uma falha de auditoria impede a entrega do arquivo.

Não há migração nem mudança de permissões no banco para esta funcionalidade.

## Arquivos

O PDF simplificado usa A4 em retrato. A personalizada passa a paisagem quando tem seis colunas ou inclui endereço completo, observações gerais ou motivo da inativação. Ambos reutilizam o cabeçalho institucional, nomes pastorais, marca d'água proporcional a 5%, contagem e rodapé com data/paginação. Textos longos quebram linhas e continuam nas páginas seguintes. Sem logo válida, a geração continua normalmente.

O Excel tem cabeçalho fixo, filtros e larguras de coluna apropriadas. Datas são células de data; matrícula, CPF, RG, CEP e telefones são texto, preservando zeros iniciais. Valores iniciados por `=` são texto literal, nunca fórmulas. Informações ausentes ficam vazias no Excel e aparecem como “Não informado” no PDF.

## Verificação local

Pré-requisitos: Node da `.node-version`, dependências instaladas, Supabase local com as migrações existentes e navegador Chromium do Playwright.

```sh
node scripts/member-reports-local.mjs setup
node scripts/member-reports-local.mjs build
node scripts/member-reports-local.mjs start
```

Em outro terminal:

```sh
node scripts/member-reports-local.mjs e2e
node scripts/member-reports-local.mjs cleanup
```

O roteiro usa a porta 3222, aceita somente Supabase local e desativa credenciais de e-mail/pagamento. Cria duas igrejas fictícias, 32 membros não arquivados na igreja principal, um arquivado, um membro de outra igreja e seis sessões com diferentes permissões/escopos. Identificadores e sessões ficam em `tmp/member-reports`, ignorado pelo Git. `cleanup` remove apenas esses registros. Interrompa o servidor ao terminar.

Os testes de navegador verificam os três modelos, todas as páginas, filtros, dados de outra igreja, arquivados, acesso regional/congregacional/ministerial, identidade restrita, clique duplicado, recuperação de erro e tela estreita. Os testes unitários cobrem validação, projeção, paginação, erros, auditoria, planilhas reais e PDFs com texto longo e marca d'água.

Para gerar amostras fictícias de revisão visual:

```sh
MEMBER_REPORT_QA_DIR=tmp/pdfs/member-reports npm test -- src/modules/members/services/member-report-renderers.test.ts
```
