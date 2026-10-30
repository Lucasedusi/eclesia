# Contas a pagar — aplicação autorizada no banco online

Em 30/10/2026, o usuário autorizou explicitamente as migrações no banco online para testar a aplicação local. Projeto confirmado pelo endereço Supabase da configuração existente: `eclesias_bd_sp` (`dhgrfvakdbtedqfgecys`). Código mantido na branch `codex/finance-accounts-payable`; sem publicação ou merge na main.

## Aplicação

A simulação confirmou exclusivamente estas três migrações pendentes, aplicadas pelo CLI com os mesmos identificadores dos arquivos versionados:

- `20261030140816_finance_cathedral_payables.sql`
- `20261030144454_finance_payables_category_index.sql`
- `20261030144935_finance_payables_conflict_response.sql`

Usado `--skip-vault`, sem inclusão de seeds ou roles. A tabela de contas a pagar estava vazia; não foram criados registros de teste, executados pagamentos ou alterados lançamentos financeiros. Não houve alteração de credenciais ou da configuração habitual da aplicação.

## Verificações

- Histórico remoto confirmou as três versões aplicadas; simulação posterior sem migrações pendentes.
- RLS ativa nas três tabelas; authenticated sem INSERT/UPDATE/DELETE direto; anon sem leitura ou execução das três RPCs.
- Permissão nova atribuída exclusivamente ao papel ADMIN. Índice composto de categoria presente.
- RPCs com search_path vazio; implementação final de conflitos sem SQLSTATE 40001.
- Consulta autorizada sob papel authenticated e negação para identidade inválida verificadas em transação somente leitura, finalizada com rollback. A seleção inicial do administrador precisou ser ajustada porque o verificador de permissão depende da identidade da sessão; a consulta corrigida passou.
- Tipos regenerados do banco online. Estrutura pública idêntica à já validada; única diferença: metadado gerado `PostgrestVersion: "14.15"`.
- Lint, typecheck e 632 testes locais passaram novamente para conferir os tipos regenerados. A bateria anterior de build, SQL local e 28 cenários de navegador permanece documentada na [validação local](2026-10-30-accounts-payable-validation.md); testes de escrita não foram executados online porque a autorização foi limitada às migrações.

## Advisors online

O Advisor online inclui verificações adicionais à versão do Advisor local. Sua execução antes/depois da aplicação apontou:

- [SECURITY DEFINER executável por authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): 62 ocorrências anteriores e três novas, correspondentes às RPCs desta funcionalidade. Exposição intencional: cada RPC verifica identidade ativa, igreja, papel ADMIN, escopo CHURCH, permissão específica e sede; consulta e negação foram verificadas. Não foi removida a autorização interna nem liberado acesso anônimo para silenciar o aviso.
- [RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy): três INFO anteriores e dois nas tabelas privadas novas, sem grants de usuário, acessíveis apenas pelas funções autorizadas.
- [Proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection): aviso preexistente, fora do escopo desta implantação.
- Desempenho: nove avisos `auth_rls_initplan` e quatro `multiple_permissive_policies` em objetos preexistentes. Nenhuma nova chave estrangeira sem índice. INFO de índices sem uso são esperados logo após a criação.

## Uso para conferência

Usar a branch da funcionalidade na aplicação local com a configuração habitual do banco online. Recarregar a sessão e acessar **Financeiro → Contas a pagar** com o administrador. A confirmação manual continua sem criar saída financeira. A publicação do código na main ainda depende de autorização específica.
