# Extrato térmico do contribuinte

**Objetivo:** imprimir entradas confirmadas do membro em 80 mm ou 58 mm, com filtros aplicados, todas as páginas e as permissões de exportação existentes. Implementação direta, sem subagentes.

**Arquitetura:** reutilizar a autorização e paginação de `loadMemberFinancialData`, com uma opção interna que restringe a consulta a INCOME/CONFIRMED. Um POST autenticado prepara HTML mínimo e registra a preparação/solicitação de impressão. Prévia em iframe isolado, com largura selecionável, usa o cabeçalho e as margens do comprovante financeiro existente. A impressão atualiza os dados e repete autorização e auditoria antes de abrir o diálogo do navegador.

- [x] Cobrir e implementar consulta restrita no servidor, preservando igreja, membro, unidades, categoria e período.
- [x] Criar serviço, HTML escapado e POST com esquema estrito, limite de corpo, origem, respostas privadas e auditoria.
- [x] Adicionar botão, prévia e seletor de largura; revalidar ao imprimir e permitir nova tentativa em erros.
- [x] Verificar exclusão de saídas/cancelados/pendentes, todas as páginas, filtros, permissões e isolamento. Validar prévia/estilo de impressão nas duas larguras, nomes e categorias longos, HTML hostil e resultado vazio.
- [x] Executar lint, tipos, testes, build e testes locais de navegador; limpar fixtures e registrar limitações da impressão física.

**Documento:** logo, nome do campo, congregação atual do membro identificada como tal, título, nome do contribuinte uma vez, período/categoria, linhas com data curta e valor e categoria abaixo; quantidade, total, Eklesias e emissão. Sem notas internas, CPF, contatos ou descrições dos lançamentos. A auditoria registra a solicitação, nunca confirma saída física do papel.

**Validação em 10/11/2026:** lint sem avisos, typecheck, 948 testes em 145 arquivos e build de produção aprovados. Os 21 testes Chromium de relatórios/visual de membros e extrato térmico passaram com dados fictícios no Supabase local via Colima. A inspeção das imagens confirmou quebra de textos extensos nas duas larguras e controles acessíveis no celular. O teste de navegador identificou e cobriu a correção de uma seleção repetida da largura atual, que antes mantinha o estado de carregamento.

**Limitação:** a chamada ao diálogo de impressão foi simulada nos testes, com reconsulta e nova autorização antes do disparo. A impressão física, o corte e o comprimento da bobina dependem da impressora e do driver e não foram testados. Nenhuma migração ou operação remota foi necessária.

Os dados fictícios das duas etapas foram removidos e o servidor de teste foi encerrado. O Colima permaneceu disponível. O arquivo local `output/pdf/capinhas-pacoca-a4.pdf` foi preservado fora das alterações.
