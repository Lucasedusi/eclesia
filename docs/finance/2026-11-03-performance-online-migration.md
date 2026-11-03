# Financeiro — integração e migrações online, 3 de novembro de 2026

O usuário autorizou prosseguir com a integração à main, aplicação das duas migrações no Supabase online e validação. A branch `codex/finance-read-performance` foi incorporada por fast-forward à main a partir de `637c737`, até `b5fd445`. Os relatórios locais duplicados foram conferidos byte a byte e preservados na pasta de trabalho; o PDF não relacionado permaneceu intocado.

## Aplicação no banco online

Projeto confirmado pela configuração da aplicação e pela conexão Supabase: `eclesias_bd_sp` (`dhgrfvakdbtedqfgecys`). A simulação mostrou exclusivamente:

- `20261103190909_finance_read_scope_set.sql`
- `20261103191356_finance_read_scope_candidates.sql`

As duas foram aplicadas pelo CLI, mantendo os identificadores dos arquivos. Usado `--skip-vault`, sem seeds ou roles. A conferência posterior mostrou 109 versões alinhadas, incluindo as duas novas, e nenhuma migração pendente. Nenhum lançamento, saldo ou cadastro financeiro foi alterado; não houve criação de usuários nem inserção de dados fictícios no ambiente online.

## Verificação de acesso e resultados

As consultas ocorreram em transações somente leitura, com rollback, sem exportar nomes, documentos ou valores financeiros para o relatório. A leitura com o papel autenticado conciliou contagem e soma de lançamentos e razão com a origem autorizada. Lista de confirmados e relatório tiveram contagens correspondentes.

O conjunto de igrejas/congregações da função otimizada coincidiu com a regra canônica para as quatro identidades existentes verificadas. Acesso anônimo, ausência de identidade, identidade inexistente e combinação inconsistente de igreja/congregação foram rejeitados. RLS, grants, caminho de busca vazio e estabilidade da função foram conferidos; as três funções públicas de leitura permanecem SECURITY INVOKER.

Não foi encontrado, para o administrador selecionado, um par de outra igreja existente que ele não pudesse acessar; esse cenário específico não foi forçado com dados fictícios online. A verificação entre duas igrejas e os casos completos de escopo permanecem cobertos pela bateria SQL local já aprovada.

## Tempos observados no banco online

Milissegundos medidos dentro do servidor de banco, com dados existentes: uma observação inicial e mediana das três seguintes. A mesma transação de leitura foi usada em cada rodada. Não incluem rede, navegador nem renderização do PDF; não devem ser comparados diretamente com os testes locais de 1.000/9.900 lançamentos.

| Consulta | Antes | Depois |
| --- | ---: | ---: |
| Visão geral | 33.935 | 25.529 |
| Lançamentos confirmados | 13.259 | 13.055 |
| Dados do relatório sintético | 51.755 | 43.771 |
| Dados do relatório analítico | 65.933 | 58.021 |

Essas poucas observações verificam funcionamento e ausência de uma regressão evidente na massa disponível. Não medem capacidade de produção nem substituem a comparação controlada com volumes maiores.

## Aplicação e PDFs

Foi compilada a main e iniciada temporariamente a aplicação em `http://localhost:3000`, usando sua configuração habitual do Supabase online. A sessão já autenticada do navegador permitiu conferir visão geral e lançamentos. Os relatórios sintético e analítico chegaram ao estado “Seu relatório está pronto”, com links para abrir e baixar o PDF. Não foi necessário copiar credenciais, criar sessões artificiais, alterar registros ou compartilhar documentos.

Esta etapa valida o frontend local de produção conectado ao banco online. Não houve publicação em um serviço de hospedagem do frontend.

## Tipos, testes e diagnósticos

Os tipos foram regenerados do Supabase online para os mesmos esquemas (`public` e `graphql_public`). A única mudança no arquivo gerado foi o metadado `PostgrestVersion: "14.15"`; os contratos públicos permaneceram iguais. Após essa atualização, lint sem avisos, verificação de tipos, 122 arquivos/669 testes e build de produção passaram novamente.

Advisors antes/depois mantiveram as mesmas ocorrências, sem avisos novos:

- Segurança: 66 avisos de funções SECURITY DEFINER públicas executáveis por authenticated; 1 aviso preexistente de proteção contra senhas vazadas; 6 informações sobre RLS sem políticas.
- Desempenho: 9 avisos `auth_rls_initplan`, 4 `multiple_permissive_policies`; 141 informações de chaves estrangeiras sem índice e 339 de índices sem uso.

Essas ocorrências preexistentes não foram alteradas nesta implantação. Nenhum erro foi reportado pelos Advisors.

Duas tentativas de preparação da verificação online precisaram de ajuste, sem mudanças de produção: a comparação inicial da lista incluía cancelados, enquanto o relatório inclui confirmados; passou-se a filtrar `CONFIRMED`. O teste negativo inicialmente esperava SQLSTATE de privilégio, enquanto a função existente retorna `P0001: FORBIDDEN`; o verificador foi ajustado ao contrato real. Ambas as verificações finais passaram.

Os 23 scripts SQL, os 11 testes automatizados de navegador e os testes de concorrência com dados fictícios já passaram na validação local. Não foram executados contra produção, pois criam dados de teste. Nesta etapa online foram usadas apenas as verificações de leitura e a conferência manual das telas/PDFs descritas acima.

[Amostras e verificações sem dados financeiros](2026-11-03-performance-online-verification.json). Logs e consultas reproduzíveis ficam na pasta ignorada `tmp/finance-performance-after-20261103/` do worktree de desempenho, incluindo `online-read-probe.sql` e `online-scope-check.sql`.
