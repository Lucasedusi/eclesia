# Especificação — normalização do histórico de migrations do Supabase

## Objetivo

Restabelecer uma única linha do tempo confiável para as migrations do projeto, sem alterar dados nem o schema funcional do ambiente online, e comprovar em um Supabase local executado pela API Docker do Colima que o banco pode ser reconstruído do zero. Ao final, novos ajustes de banco devem seguir o fluxo normal `migration new` → teste local → revisão → `db push`/CI.

## Estado atual verificado

- O repositório possui 54 migrations locais imutáveis.
- O projeto Supabase vinculado possui 51 versões registradas no histórico remoto após a aplicação das duas migrations mais recentes do módulo de Eventos.
- Há versões existentes somente no repositório, versões existentes somente no histórico remoto e arquivos de mesmo propósito com timestamps ou conteúdo diferentes.
- As duas migrations recentes foram aplicadas e verificadas no ambiente online, mas precisaram ser marcadas como aplicadas porque o `supabase db push` normal foi bloqueado pela divergência anterior.
- O schema e os dados do módulo de Eventos estão funcionais; o problema a corrigir agora é o histórico de controle de migrations.
- Colima `0.10.3`, Docker CLI `29.8.1` e Lima `2.2.0` estão instalados. Não há instância Colima ativa. O Supabase CLI está fixado no projeto na versão `2.117.0`.

## Princípios e restrições

- As migrations existentes em `supabase/migrations/` permanecem byte a byte intactas: nenhuma será editada, renomeada, reordenada, combinada, apagada ou preenchida.
- O histórico local será candidato a histórico canônico porque é o artefato versionado que precisa reconstruir ambientes novos. Ele somente será adotado depois de um replay completo e de uma comparação com o schema online.
- O ambiente online não receberá migrations de schema, seeds ou dados de teste durante a normalização.
- A eventual alteração remota ficará limitada à tabela de controle de migrations do Supabase e só ocorrerá depois de os critérios de segurança desta especificação passarem.
- Não será feito um reparo em massa por suposição. Cada conjunto de versões será derivado novamente por comandos de leitura e registrado em um relatório auditável.
- Segredos, dados de membros e dados de produção não serão copiados para o ambiente local. A comparação será de estrutura, não de conteúdo das tabelas.
- Esta etapa prepara o CI/CD, mas não habilita implantação automática em produção. A automação será uma fase separada, depois que o histórico estiver normalizado.

## Arquitetura escolhida

### 1. Isolamento do trabalho

O trabalho será executado na branch `codex/supabase-history-normalization`. Antes das mudanças operacionais, será criado um worktree Git isolado seguindo as regras do repositório. O checkout principal e a branch `main` permanecerão disponíveis como referência e recuperação.

### 2. Supabase local com Colima

Será criada uma instância Colima exclusiva chamada `eclesia`, usando arquitetura `aarch64`, Apple Virtualization Framework (`vz`), runtime Docker, 2 CPUs, 4 GiB de memória e disco máximo de 40 GiB. Rosetta, Kubernetes, execução automática no login e serviços desnecessários permanecerão desativados. O Supabase local será iniciado pelo CLI versionado do projeto. A configuração local continuará usando PostgreSQL 17, compatível com a versão principal já configurada e com o projeto remoto.

O Colima será iniciado somente durante verificações de banco e interrompido ao final. Para a normalização será usado inicialmente `supabase db start`, que inicia apenas o PostgreSQL local. Serviços adicionais do Supabase somente serão ativados se uma verificação demonstrar dependência concreta. Nenhuma credencial do projeto será gravada em arquivo versionado.

### 3. Reconstrução a partir do histórico local

O fluxo principal será:

1. Capturar novamente, por leitura, a lista local e a lista remota de versões.
2. Exportar somente metadados e estrutura remota necessários à comparação, sem dados de usuários.
3. Executar `supabase db start` e reconstruir o banco vazio com `supabase db reset` usando exatamente as 54 migrations atuais.
4. Executar as verificações SQL versionadas e os testes da aplicação.
5. Comparar o schema resultante com o schema remoto, normalizando diferenças voláteis que não representam estrutura funcional, como proprietário, comentários gerados e metadados internos do Supabase.

### 4. Decisão baseada no resultado do replay

#### Cenário A — schemas equivalentes

Se o replay local produzir o mesmo schema funcional do ambiente online, as 54 versões locais passam a ser a linha do tempo canônica. Será preparado um plano exato de reparo da tabela remota de histórico:

- versões remotas sem arquivo local serão marcadas como `reverted`;
- versões locais já refletidas no schema remoto, mas ausentes da tabela de histórico, serão marcadas como `applied`;
- versões comuns permanecerão inalteradas.

`supabase migration repair` altera o registro do histórico, não executa o SQL da migration. Por isso, ele só será usado depois da prova de equivalência estrutural.

#### Cenário B — schemas diferentes

Se houver diferença funcional, o reparo remoto será interrompido. As migrations antigas continuarão intactas e será criada uma nova migration, somente de avanço, capaz de reconciliar o replay local com o estado desejado. Essa migration deverá:

- ser segura e idempotente quando possível;
- preservar dados, RLS, grants, índices, constraints e isolamento por igreja;
- passar pelo replay completo em banco vazio;
- ter seu efeito comparado novamente com o ambiente online.

Somente depois dessa reconciliação o processo poderá retornar ao Cenário A. Nenhuma divergência será escondida apenas marcando versões como aplicadas.

### 5. Normalização remota controlada

Antes do primeiro comando de escrita remota serão guardados:

- a lista completa de versões locais e remotas;
- o conjunto exato de versões que receberá `applied` ou `reverted`;
- o resultado da comparação estrutural;
- um backup lógico da tabela de histórico, sem dados da aplicação;
- o comando inverso necessário para restaurar os estados de histórico.

O reparo será executado em lotes pequenos. Após cada lote, `supabase migration list --linked` será conferido. No final, `supabase db push --linked --dry-run` deverá informar que não há migrations pendentes. O comando real de `db push` não será usado se o dry-run estiver vazio.

## Validação

### Banco local

- Colima e a API Docker respondem, e o PostgreSQL local do Supabase inicia sem erro dentro dos limites de recursos aprovados.
- `supabase db reset` conclui em banco vazio somente com arquivos versionados.
- As verificações relevantes em `supabase/tests/` e `supabase/verification/` passam.
- Os Security e Performance Advisors do ambiente local não apresentam regressões causadas pela normalização ou por eventual migration de reconciliação.
- Os tipos TypeScript do banco podem ser regenerados a partir do schema reconstruído sem alterações funcionais inesperadas.

### Comparação com o ambiente online

- A estrutura funcional de tabelas, colunas, tipos, constraints, índices, funções, triggers, RLS, policies, grants e objetos de Storage relevantes é equivalente.
- Diferenças ignoradas na comparação são listadas e justificadas no relatório; não haverá filtro genérico que possa esconder uma diferença real.
- Nenhuma linha de dados de negócio é inserida, alterada ou removida.

### Aplicação

- `npm run lint -- --max-warnings=0`
- `npm run typecheck`
- `npm test`
- `npm run build`
- Testes focados do módulo de Eventos e verificações de pagamentos/histórico de membros continuam passando.

### Histórico final

- `supabase migration list --linked` mostra correspondência exata entre versões locais e remotas.
- `supabase db push --linked --dry-run --skip-vault` não encontra migration pendente.
- Um novo banco vazio pode ser reconstruído integralmente pelo PostgreSQL local executado no Colima.
- O diff Git não contém segredos, dumps de dados, ruído gerado ou alteração em migrations históricas.

## Recuperação e interrupção segura

- Até o reparo remoto, todas as mudanças são locais e reversíveis por descarte do worktree ou revert dos commits.
- Se Colima, replay, testes ou comparação falharem, o processo para antes de qualquer escrita remota.
- Se um lote de reparo remoto não produzir a lista esperada, os lotes seguintes não serão executados; o estado será comparado ao backup de histórico e restaurado com comandos explícitos se necessário.
- O schema e os dados de produção não dependem do conteúdo da tabela de histórico para continuar operando, mas o reparo será tratado como uma mudança auditável e sensível.

## Entregáveis

- Colima e PostgreSQL local do Supabase configurados e validados nesta máquina, sem Rosetta nem inicialização automática.
- Histórico local preservado e comprovadamente reproduzível.
- Relatório versionado de divergências, equivalência estrutural e versões reparadas.
- Histórico remoto alinhado ao repositório, somente depois de todos os gates.
- Runbook curto para criar, testar e publicar futuras migrations.
- Commits focados na branch `codex/supabase-history-normalization`.

## Fluxo futuro recomendado

Após a normalização, toda mudança de banco seguirá:

1. criar uma nova migration pelo CLI;
2. iniciar o Colima sob demanda e aplicar/testar no PostgreSQL local;
3. executar verificações SQL, lint, typecheck, testes e build aplicáveis;
4. revisar e versionar a migration junto com o código;
5. aplicar ao ambiente online por CI/CD com segredos protegidos, ambiente de produção com aprovação e `db push` sem reparos manuais.

Esse fluxo elimina a repetição da correção histórica. O custo operacional e de tokens fica concentrado na migration nova e nas verificações automatizadas, em vez de reanalisar todo o histórico a cada funcionalidade.

## Critérios de aceite

- Nenhuma migration histórica foi modificada.
- O banco local é reconstruído do zero com sucesso.
- O schema local reconstruído e o schema online são funcionalmente equivalentes.
- Nenhum dado ou schema funcional do ambiente online foi alterado pela normalização.
- A lista remota de migrations corresponde exatamente aos arquivos locais.
- O dry-run remoto está vazio.
- As validações de banco e aplicação passam, ou qualquer pré-requisito ausente é documentado de forma exata.
- Há instruções claras para o próximo desenvolvimento e para a futura implantação automática por CI/CD.
