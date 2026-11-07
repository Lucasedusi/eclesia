# Plano executado — Congregações e Cargos

Execução direta, sem subagentes, na branch `codex/ajustes-visuais-congregacoes-cargos`.

1. Conferir estado da main, instruções do projeto e documentação local do Next.js.
2. Registrar regressões de layout, WhatsApp sem fallback e contagem dos documentos concluídos.
3. Atualizar listagem, formulários, detalhes e PDFs com os componentes e estilos existentes.
4. Validar navegação, exportação, edição com preservação dos dados antigos e acessos com dados fictícios locais.
5. Inspecionar PDFs e capturas desktop/móvel, revisar diff e limpar fixtures.

## Resultado

- 864 testes em 136 arquivos aprovados; 98 testes específicos de Organização aprovados.
- 6 cenários Playwright aprovados, incluindo contagem ACTIVE e preservação de telefone/descrição após salvar.
- Lint sem avisos, tipagem e build de produção local aprovados.
- PDFs de ficha/listagem em retrato/paisagem e continuação, telas desktop/móvel e formulários inspecionados.
- Permissões, filtros, exclusão lógica e isolamento entre igrejas preservados. Sem migrações, alteração de tipos gerados ou acesso ao banco online.
- Arquivo `output/pdf/capinhas-pacoca-a4.pdf` preservado e fora do diff.

Verificações de banco/advisors e análise de desempenho de rotas não se aplicam: não houve mudança de esquema, políticas ou desempenho. E2E executado para os fluxos afetados, com sessões locais; nenhuma alteração publicada no GitHub nesta etapa.
