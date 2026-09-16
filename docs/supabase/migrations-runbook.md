# Fluxo de migrations com Colima e Supabase

## Uso diário

Inicie o runtime somente quando houver trabalho de banco:

```bash
colima start eclesia
npx supabase db start
```

Crie a migration com um nome descritivo em `snake_case`, edite somente o novo arquivo e nunca altere uma migration já compartilhada ou aplicada:

```bash
npx supabase migration new add_member_example_field
npx supabase db reset --local
```

Execute a verificação SQL real do domínio. Para scripts com vários comandos, use `psql` no contêiner, pois `supabase db query --file` pode tentar enviá-los como uma única prepared statement:

```bash
docker exec -i supabase_db_eclesia psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/events_verification.sql
npx supabase db lint --local --schema public --level warning --fail-on error
npx supabase db advisors --local --type security --level info --fail-on error
```

Valide a aplicação:

```bash
npm run lint -- --max-warnings=0
npm run typecheck
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
```

O build usa `next/font/google` e precisa de rede para obter Rubik quando a fonte ainda não está no cache.

## Gate do ambiente online

Antes de qualquer escrita, revise a migration, confirme o projeto vinculado e faça o dry-run:

```bash
npx supabase projects list
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

Somente depois da revisão e de uma aprovação explícita de produção execute:

```bash
npx supabase db push --linked --skip-vault
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

Nunca use `--include-seed` em produção. `migration repair` é uma ferramenta excepcional para corrigir metadados comprovadamente divergentes; não faz parte do fluxo normal e não executa nem desfaz SQL.

## Encerramento leve

Pare tudo ao concluir para devolver CPU e memória ao macOS:

```bash
npx supabase stop
colima stop eclesia
```

As imagens e o disco persistem para o próximo uso. Colima não inicia automaticamente e não requer Rosetta.

## CI/CD futuro

Depois que a branch estiver integrada, o CI pode repetir reset, verificações SQL, lint, typecheck, testes, build e dry-run. A implantação automática deve usar segredos protegidos e um ambiente de produção com aprovação manual. Não automatize `migration repair`.
