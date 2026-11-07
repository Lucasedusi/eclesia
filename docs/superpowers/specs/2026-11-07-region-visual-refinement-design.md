# Refinamento visual de Regionais

Escopo aprovado em conversa em 07/11/2026; execução direta, sem subagentes.

- Subtítulo: “Gerencie as regionais e suas congregações.” Botão Relatório com borda, texto, hover e foco equivalentes aos de Membros.
- Relatório simplificado: “Filtros” substitui “Abrangência”; remover seletor de situação redundante. Todas inclui ativas/inativas; filtradas respeita busca, status e ordenação de todas as páginas.
- Ficha: incluir todas as congregações autorizadas, ativas/inativas. Remover seletor e modal intermediário dos detalhes; baixar diretamente com indicação de andamento/erro, mantendo detalhes abertos.
- Formulário de criação/edição: nome/status, coordenador/telefone, descrição em largura total. Preservar responsividade.
- Resumo da estrutura: remover “Cargos ativos” e distribuir os três indicadores restantes, conforme ajuste posterior aprovado.
- Detalhes: apenas contagens ativas/inativas; informações em quatro colunas no desktop (nome, coordenador, telefone, cadastro), descrição na segunda linha; retirar última atualização.
- PDFs regionais: cabeçalho específico com nome do campo e Presidentes; ficha acrescenta coordenador e telefone. Espaçamento uniforme. Sem endereço/CNPJ/telefone institucional. Corpo com título e quantidade próximos, espaço maior antes da tabela; ficha sem descrição. Preservar colunas, numeração, logo e marca d’água, avisos de escopo e filtros aplicados.
- Todos os PDFs gerados pelo sistema recebem “Eklesias” no rodapé, respeitando formatos próprios e informações existentes; não editar PDFs locais existentes. Credenciais mantêm dimensões, sangria e QR.

## Abordagem

Adaptar os componentes existentes e extrair o download de regionais para hook equivalente ao de congregações. Usar uma variante opcional do cabeçalho compartilhado, preservando os outros relatórios. Alterações globais de marca limitadas aos geradores de PDF. Não recriar os relatórios nem alterar banco, permissões, escopos, exclusão lógica, auditoria ou integrações.

## Validação

Testes de PDF para conteúdo, limites, múltiplas páginas, cabeçalhos longos e rodapé; navegador para filtros, download direto, falhas recuperáveis, desktop/móvel e permissões. Executar lint, tipagem, suíte completa e build local de teste. Preservar `output/pdf/capinhas-pacoca-a4.pdf`.
