# Normalização do histórico de migrations do Supabase

## Escopo

- Projeto vinculado: `eclesias_bd_sp` (`dhgrfvakdbtedqfgecys`, `sa-east-1`).
- Ambiente local: Colima `0.10.3`, Lima `2.2.0`, Docker CLI `29.8.1`, Docker Engine `29.5.2`, Supabase CLI `2.117.0` e PostgreSQL `17.6.1.155`.
- Perfil Colima: `eclesia`, `aarch64`, `vz`, 2 CPUs, 4 GiB de memória e 40 GiB de disco, sem Rosetta e sem Kubernetes.
- Evidências temporárias privadas: SHA-256 `559cb8e4bc867b5b4120369a0a9fe46704f6f1d5985aa65a32ee41754dd05a04` para o backup integral de `supabase_migrations.schema_migrations` e `4915bbcc4d4889fee9bb5fa1e3fc17b96e27366d14a241dc318402fe3815e8be` para a lista imediatamente anterior ao reparo.

Nenhum dado de membros, inscrições, pagamentos ou qualquer outra tabela de negócio foi copiado para o ambiente local.

## Causa raiz

A migration local mais antiga, `202607310001_authentication_permissions.sql`, declara explicitamente que depende de uma modelagem base já aplicada, mas essa modelagem nunca foi versionada no repositório. Por isso o primeiro replay em banco vazio falhou ao alterar `public.congregations`.

As 11 migrations remotas `trial_clone_*` preservavam o snapshot estrutural ausente. Elas foram consolidadas, sem dados, em `20260730000000_remote_clone_baseline.sql`. Quatro colunas legadas e dois wrappers de `pgcrypto` existem apenas durante o replay para reproduzir o ambiente histórico; `20260916125605_reconcile_migration_history_baseline.sql` remove esses wrappers e restaura o estado final seguro.

O SHA-256 do baseline final, normalizado para finais de linha LF, é `d88dee53391b6abb5e5ceda7aa8479ce6bcf7fbfec9459459c149c92627c2f42`.

As 54 migrations que já existiam no repositório mantiveram seus hashes SHA-256 originais.

## Estado anterior ao reparo

- Migrations locais históricas: 54.
- Linhas no histórico remoto: 51.
- Versões idênticas nos dois lados: 6.
- Versões somente no histórico remoto: 45.
- Versões históricas somente locais: 48.
- Novos arquivos canônicos: 1 baseline e 1 reconciliação.
- Versões a marcar como aplicadas antes do push: 49 (baseline mais as 48 históricas).
- Migration que deve permanecer pendente para execução real: `20260916125605`.

## Validação local

- `supabase db start` e `supabase db reset --local`: concluídos com as 56 migrations e o seed vazio.
- `events_verification.sql`: `events_module_verification_ok`.
- `migration_history_normalization_verification.sql`: `migration_history_normalization_verification_ok`.
- Hashes das 54 migrations anteriores: sem diferença.
- Tipos gerados do schema `public` remoto: diferença vazia contra `src/lib/supabase/database.types.ts`.
- `npm run lint -- --max-warnings=0`: passou.
- `npm run typecheck`: passou.
- `npm test`: 31 arquivos e 168 testes passaram.
- `npm run build`: passou; o acesso de rede foi necessário apenas para `next/font/google` obter Rubik.
- Advisor local de segurança: nenhum problema.
- Advisor remoto de segurança: 43 avisos preexistentes (42 RPCs `SECURITY DEFINER` executáveis por `authenticated` e proteção contra senhas vazadas desabilitada).
- Lint SQL local e remoto: ambos encontram o mesmo erro preexistente `42702`, referência ambígua a `storage_path` em `claim_stale_administrative_document_cleanups`. A normalização não introduziu essa divergência.

## Comparação estrutural

O schema `public` reconstruído coincide com o remoto, exceto por:

- ordem física de `failed_at`, `failed_by` e `failure_reason` em `event_payments`, sem diferença de tipo, nulabilidade ou comportamento;
- endurecimento intencional de `create_church_invitation` e `renew_church_invitation`, que passam a qualificar `extensions.digest`/`extensions.gen_random_bytes` e usar `search_path = ''`.

`register_event_checkin` e `reissue_event_registration_qr` terminam com o mesmo `search_path = ''` do ambiente remoto. As diferenças restantes no dump de `storage` são objetos e grants gerenciados pela versão da plataforma (`iceberg_*` e `supabase_storage_admin`); as políticas de Storage da aplicação coincidem.

Antes do push, `supabase db diff --from migrations --to linked` identificou somente os dois RPCs de convite acima e `handle_new_user`. Depois do push, restou apenas `handle_new_user`; a comparação direta do catálogo local e remoto confirmou o mesmo SHA-256 do corpo normalizado (`37912220a08084fa0c49da71cfe95cc1c3a7e1e006f146e667a5775a55467550`), linguagem, assinatura, retorno, `SECURITY DEFINER` e `search_path`. A diferença é somente a representação textual CRLF/LF, sem mudança de instruções ou comportamento.

## Plano exato de reparo

Antes de cada lote, conferir que a lista remota continua igual ao backup. Após cada lote, executar `npx supabase migration list --linked` e interromper diante de qualquer resultado inesperado.

### 1. Remover do controle as 45 versões somente remotas

```bash
npx supabase migration repair --linked --status reverted 20260808000035 20260808000230 20260808000324 20260808000442 20260808000501 20260808000556 20260808000614 20260808000644 20260808000731 20260808000838
npx supabase migration repair --linked --status reverted 20260808000936 20260808022553 20260811145440 20260811145601 20260811150142 20260811150347 20260811150500 20260811201953 20260813181856 20260814202119
npx supabase migration repair --linked --status reverted 20260814202539 20260815223404 20260817202025 20260817202727 20260817204322 20260817205230 20260817205558 20260817205714 20260817205729 20260817210458
npx supabase migration repair --linked --status reverted 20260817211217 20260817211650 20260818165448 20260818210842 20260819173132 20260819173231 20260821135404 20260827005710 20260827010233 20260827010546
npx supabase migration repair --linked --status reverted 20260827010629 20260827011112 20260827012103 20260827012405 20260831205514
```

### 2. Marcar como aplicadas as 49 versões canônicas já representadas no schema remoto

```bash
npx supabase migration repair --linked --status applied 20260730000000 202607310001 20260802011104 20260802011221 20260802161352 20260803150000 20260803203000 20260805120000 20260805193000 20260805194500
npx supabase migration repair --linked --status applied 20260806190249 20260807005822 20260807185519 20260808022500 20260811143000 20260811150000 20260811151500 20260811153000 20260811154500 20260811180000
npx supabase migration repair --linked --status applied 20260813120000 20260814190000 20260814213000 20260815010000 20260818063000 20260818084500 20260818101500 20260818113000 20260818121500 20260818124500
npx supabase migration repair --linked --status applied 20260818131500 20260818133000 20260818224500 20260818233000 20260819143000 20260819150500 20260821093000 20260827002356 20260827002409 20260827003112
npx supabase migration repair --linked --status applied 20260827004206 20260827004831 20260827005644 20260827010412 20260827011327 20260829134832 20260829134847 20260829134855 20260831203000
```

### 3. Aplicar apenas a reconciliação pendente

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
npx supabase db push --linked --skip-vault
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

O primeiro `dry-run` deve listar somente `20260916125605_reconcile_migration_history_baseline.sql`. O segundo deve ficar vazio.

## Recuperação

Se houver divergência antes do push da reconciliação, interromper o processo e restaurar a presença das versões com os lotes inversos abaixo. O backup integral do histórico deve permanecer disponível até a validação final; os comandos `applied` restauram a presença das versões, e o JSON com SHA-256 informado no início preserva nomes e statements para uma restauração forense exata.

```bash
npx supabase migration repair --linked --status reverted 20260831203000 20260829134855 20260829134847 20260829134832 20260827011327 20260827010412 20260827005644 20260827004831 20260827004206 20260827003112
npx supabase migration repair --linked --status reverted 20260827002409 20260827002356 20260821093000 20260819150500 20260819143000 20260818233000 20260818224500 20260818133000 20260818131500 20260818124500
npx supabase migration repair --linked --status reverted 20260818121500 20260818113000 20260818101500 20260818084500 20260818063000 20260815010000 20260814213000 20260814190000 20260813120000 20260811180000
npx supabase migration repair --linked --status reverted 20260811154500 20260811153000 20260811151500 20260811150000 20260811143000 20260808022500 20260807185519 20260807005822 20260806190249 20260805194500
npx supabase migration repair --linked --status reverted 20260805193000 20260805120000 20260803203000 20260803150000 20260802161352 20260802011221 20260802011104 202607310001 20260730000000
npx supabase migration repair --linked --status applied 20260808000035 20260808000230 20260808000324 20260808000442 20260808000501 20260808000556 20260808000614 20260808000644 20260808000731 20260808000838
npx supabase migration repair --linked --status applied 20260808000936 20260808022553 20260811145440 20260811145601 20260811150142 20260811150347 20260811150500 20260811201953 20260813181856 20260814202119
npx supabase migration repair --linked --status applied 20260814202539 20260815223404 20260817202025 20260817202727 20260817204322 20260817205230 20260817205558 20260817205714 20260817205729 20260817210458
npx supabase migration repair --linked --status applied 20260817211217 20260817211650 20260818165448 20260818210842 20260819173132 20260819173231 20260821135404 20260827005710 20260827010233 20260827010546
npx supabase migration repair --linked --status applied 20260827010629 20260827011112 20260827012103 20260827012405 20260831205514
```

Se a migration `20260916125605` falhar, o `db push` a executa em transação e não deve deixar mudança parcial. Se ela já tiver sido aplicada e uma reversão funcional se tornar necessária, criar uma nova migration para frente; não remover nem editar o arquivo aplicado.

## Execução e estado final remoto

O histórico remoto foi relido imediatamente antes da escrita e permaneceu idêntico ao backup por conteúdo, versão, nome e statements. A normalização foi então executada nos lotes auditados acima:

- 45 versões exclusivas do histórico remoto foram marcadas como `reverted`;
- o baseline e as 48 versões canônicas já representadas no schema foram marcados como `applied`;
- cada lote foi seguido por nova leitura da lista remota;
- o primeiro dry-run listou exclusivamente `20260916125605_reconcile_migration_history_baseline.sql`.

A primeira tentativa de aplicar a reconciliação falhou porque `public.digest(text, text)` já não existia no ambiente online. O push era transacional: a migration não foi registrada e os RPCs permaneceram inalterados. A reconciliação foi tornada idempotente com `DROP FUNCTION IF EXISTS`, validada novamente nos dois caminhos locais — replay completo e aplicação incremental com wrappers previamente ausentes — e então reaplicada com sucesso.

Estado final confirmado:

- histórico local e remoto alinhado nas mesmas 56 versões;
- dry-run final vazio (`upToDate: true`);
- wrappers temporários `public.digest` e `public.gen_random_bytes` ausentes;
- os quatro RPCs auditados possuem `search_path = ''`;
- `create_church_invitation` e `renew_church_invitation` usam as funções `extensions` qualificadas;
- nenhum dado de negócio foi criado, alterado ou removido;
- a única alteração real de schema foi o endurecimento/reconciliação dos RPCs revisados.

O erro preexistente do lint SQL (`42702` em `claim_stale_administrative_document_cleanups`) e os avisos preexistentes dos Advisors permanecem fora do escopo desta normalização e não foram agravados por ela.
