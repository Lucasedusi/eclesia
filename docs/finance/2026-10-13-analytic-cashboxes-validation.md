# Validação — analítico por caixa (13/10/2026)

## Escopo aprovado

Modelo 02: caixa → entradas → saídas; o próximo caixa começa em nova página. Entradas e saídas do mesmo caixa podem compartilhar a folha. Sintético preservado. Execução direta, sem subagentes.

- Cabeçalho com endereço da congregação autorizada, título em caixa alta e congregação/mês à direita. Endereço ausente é informado sem substituir pelo endereço de outra unidade.
- Faixas verde/vermelha identificam direção e caixa. Pagamento permanece em negrito na tabela, sem repetir o caixa.
- Subtotais identificam categoria/classificação, sem subtotal genérico adicional. Resumo por departamento somente no sintético; conciliação por caixa mantida.
- Corpo das tabelas do analítico em 7,5 pt; sintético preservado em 9 pt.
- Loading no botão e na nova aba, com suporte à preferência por movimento reduzido. Erros/cancelamento fecham a aba pendente; bloqueio de popup mantém link e download.

## Banco e integridade

Nova migração `20261013222507_finance_report_cashbox_identity.sql`, aplicada localmente e online com autorização. Acrescenta apenas `cashboxId` às linhas do JSON analítico da RPC existente, preservando compatibilidade com a versão anterior, SECURITY INVOKER, search_path vazio, bloqueio de anon e verificações de escopo/RLS. Não altera valores nem insere dados online.

Agrupamento por identificador evita misturar caixas homônimos. Serviço confere entradas, saídas e quantidade por caixa, além das verificações gerais existentes. Identidade/endereço da congregação são lidos com filtros de igreja, unidade autorizada e exclusão lógica.

Tipos regenerados pelo CLI a partir do banco vinculado: idênticos ao arquivo versionado, pois a assinatura da RPC continua retornando JSON. Histórico online e propriedades/permissões da função verificados após a aplicação.

Advisors Security/Performance antes/depois: nenhum novo achado; conjunto de achados inalterado. Permanecem alertas preexistentes (RLS sem política, funções definer, proteção de senhas, FKs sem índice, initplan RLS, índices sem uso e políticas permissivas múltiplas). [Referência dos Advisors](https://supabase.com/docs/guides/database/database-linter).

## Evidências

- 442 testes em 85 arquivos passaram. Regressões demonstradas antes da correção para agrupamento entre caixas homônimos, subtotais e título separado de tabela.
- Lint sem avisos, TypeScript e compilação de produção passaram.
- Seis cenários Chromium passaram: geração dos dois tipos, download idêntico ao PDF aberto, popup bloqueado, falha/repetição, acesso do tesoureiro e cancelamento/loading/mobile. Loading da nova aba verificado com animação e preferência por movimento reduzido.
- SQL local com rollback: controles de tenant/escopo, anon, conciliação, caixa inativo, período vazio, correções/cancelamentos, transferências e limite de exportação; novo identificador e somas por caixa confirmados. Consulta de 9.995 lançamentos: aproximadamente 5,92 s, abaixo do limite de 8 s.
- PDFs de 0, 1, 49, 1.000 e 9.995 lançamentos gerados. Revisão visual de caixas múltiplos, dízimos/classificações, continuação, logo, endereço e nomes longos. Cabeçalho/tabela de grupo com uma linha permanecem juntos.
- Conteúdo gráfico descomprimido do sintético idêntico ao baseline: SHA-256 `5cd4239cab72e1c5d9f3d61053a496c0cedf09ba975d74257276c6815503c78b`.

## Limites

Sem testes em Safari/Firefox ou impressora física: esses recursos não estavam configurados para a verificação. Não houve envio de documentos, dados de teste online ou implantação do aplicativo. A aplicação da migração online é independente da publicação do código.
