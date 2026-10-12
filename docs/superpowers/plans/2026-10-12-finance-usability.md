# Ajustes de usabilidade financeira — 12/10/2026

Especificação: proposta aprovada nesta conversa. Execução direta, sem subagentes. Alterações online autorizadas.

1. Corrigir pesquisa sem acentos, filtro por classificação histórica e erro específico de justificativa; testar consultas, permissões, totais e teto bruto.
2. Sidebar retrátil persistida, remover categorias acima dos títulos; filtros automáticos, limpar, loading estável, cores e transferências recolhidas.
3. Comprovantes como botões, ícones no atendimento, cartões uniformes e demonstrativo com identificação compacta e histórico lateral.
4. Verificar lint, tipos, testes, build, E2E e SQL local; aplicar migração online, regenerar tipos e comparar advisors. Revisar o diff diretamente.

## Decisões
- Preservar dados históricos e todos os cálculos; esconder apenas as seções visuais aprovadas.
- Justificativa obrigatória quando vigência passada ou afeta demonstrativo existente; validação definitiva no banco, mensagem específica no campo.
- Consulta ignora acentos sem alterar nomes armazenados; classificação usa o ID gravado na transação.
- Limpar filtros preserva unidade e mês, mudança de filtro reinicia paginação.
- Revisão direta pelo próprio agente conforme proibição explícita de subagentes.

## Progresso
- Base b387676; 402 testes passaram antes das alterações.
- Reutilizada área isolada .worktrees/financial-implementation, branch codex/finance-usability. FINANCE.MD local anterior preservado em /private/tmp/eclesia-finance-usability-original-FINANCE.MD antes de atualizar a base.

- Etapa 1 concluída: testes de regressão falharam antes da correção e passaram depois (busca sem acentos, justificativa específica e filtro por classificação).
- Etapas 2 e 3 concluídas: filtros automáticos e sidebar persistida comprovados em navegador, cartões uniformes e histórico recolhido revisados visualmente.
- Etapa 4 concluída: lint sem avisos, typecheck, 404 testes unitários, 17 cenários E2E em build de produção e nove scripts SQL com rollback passaram.
- Banco online: migração 20261012162621 aplicada após dry-run e validação local. Nenhum dado fictício foi criado online. Verificação somente leitura confirmou extensão, filtro, código de erro, search_path vazio e ausência de execução anônima.
- Tipos regenerados pelo CLI a partir do banco online; mudança apenas na versão declarada do PostgREST (14.5 → 14.15).
- Revisão direta: permissões/tenant, campos preservados, não alteração de saldos, versões e auditoria conferidos; nenhum subagente utilizado.
- Ajustes de testes existentes: transferências e histórico agora exigem abertura; expectativa da caixa de restante foi removida conforme requisito, com cálculos preservados e cobertos pelos testes SQL.
- Integração: seguir a autorização já concedida no histórico para commits e disponibilização na main; integração local por fast-forward. Publicação remota do código não faz parte desta rodada. Worktree reutilizado preservado pois contém notas locais preexistentes.
