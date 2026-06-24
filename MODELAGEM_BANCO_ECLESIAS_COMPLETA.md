# Modelagem do Banco de Dados — Eclesias

> Documento de referência gerado a partir do Markdown exportado do Supabase (`model_corretion.md`).
> O objetivo é manter uma visão explicativa, organizada por módulos, sem omitir campos existentes nas tabelas.

**Total de tabelas documentadas:** 36

## Índice geral

- **Base institucional** (4 tabelas)
  - `churches`
  - `regions`
  - `congregations`
  - `app_settings`
- **Usuários, permissões e auditoria** (5 tabelas)
  - `profiles`
  - `user_church_access`
  - `permissions`
  - `role_permissions`
  - `audit_logs`
- **Membros, cargos e ministérios** (7 tabelas)
  - `members`
  - `member_history`
  - `member_documents`
  - `roles`
  - `member_roles`
  - `ministries`
  - `member_ministries`
- **Eventos** (9 tabelas)
  - `events`
  - `event_congregation_quotas`
  - `event_groups`
  - `event_items`
  - `event_registrations`
  - `event_registration_items`
  - `event_payments`
  - `event_checkins`
  - `event_documents`
- **Financeiro** (8 tabelas)
  - `financial_departments`
  - `financial_cashboxes`
  - `financial_payment_methods`
  - `financial_categories`
  - `financial_transactions`
  - `financial_receipts`
  - `financial_documents`
  - `accounts_payable`
- **Entrega de relatório financeiro** (3 tabelas)
  - `report_delivery_rules`
  - `report_deliveries`
  - `report_delivery_items`

---

# Base institucional

## `churches`

**Finalidade:** Cadastro da igreja/campo principal. Centraliza dados institucionais, endereço, contatos, liderança e status da organização.

**Exemplo de cadastro:** Assembleia de Deus — Campo de Porangatu, com dados de contato, endereço e pastores presidentes.

**Total de campos:** 23

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `legal_name` | `text` | Não | `` | Razão social ou nome jurídico da igreja, quando houver. |
| `document` | `text` | Não | `` | Documento institucional, como CNPJ, CPF ou identificação equivalente. |
| `email` | `text` | Não | `` | E-mail de contato. |
| `phone` | `text` | Não | `` | Telefone de contato. |
| `whatsapp` | `text` | Não | `` | Número de WhatsApp. |
| `logo_url` | `text` | Não | `` | URL do logotipo. |
| `zip_code` | `text` | Não | `` | CEP do endereço. |
| `address` | `text` | Não | `` | Logradouro/endereço. |
| `number` | `text` | Não | `` | Número do endereço. |
| `complement` | `text` | Não | `` | Complemento do endereço. |
| `district` | `text` | Não | `` | Bairro. |
| `city` | `text` | Não | `` | Cidade. |
| `state` | `text` | Não | `` | Estado/UF. |
| `country` | `text` | Sim | `Brasil` | País. |
| `senior_pastor_name` | `text` | Não | `` | Nome do pastor presidente ou líder principal da igreja/campo. |
| `senior_pastor_spouse_name` | `text` | Não | `` | Nome da esposa do pastor presidente/líder principal. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `churches_pkey` — Chave primária: `primary key (id)`
- `churches_status_check` — Validação: `check ( ( status = any ( array[ 'ACTIVE'::text, 'INACTIVE'::text, 'SUSPENDED'::text ] ) ) )`

**Índices cadastrados:**

- `churches_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `churches_city_state_idx` — índice, método `btree`, expressão/colunas: `(city, state)`
- `churches_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`

**Triggers:**

- `set_churches_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `regions`

**Finalidade:** Cadastro das regionais vinculadas ao campo/igreja. Ajuda a agrupar congregações por região administrativa.

**Exemplo de cadastro:** Regional 01, coordenada por um pastor responsável e usada para agrupar congregações.

**Total de campos:** 10

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `coordinator_name` | `text` | Não | `` | Nome do coordenador responsável pela regional. |
| `coordinator_phone` | `text` | Não | `` | Telefone do coordenador responsável pela regional. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `regions_pkey` — Chave primária: `primary key (id)`
- `regions_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `regions_status_check` — Validação: `check ( ( status = any (array['ACTIVE'::text, 'INACTIVE'::text]) ) )`

**Índices cadastrados:**

- `regions_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `regions_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `regions_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`

**Triggers:**

- `set_regions_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `congregations`

**Finalidade:** Cadastro das congregações locais. Guarda dados de contato, endereço, pastor responsável e vínculo com regional.

**Exemplo de cadastro:** Congregação Vila Planaltina, vinculada à Regional 01, com pastor dirigente e endereço.

**Total de campos:** 23

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `region_id` | `uuid` | Não | `` | Regional vinculada ao registro. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `code` | `text` | Não | `` | Código interno opcional para busca, relatórios ou integração. |
| `pastor_name` | `text` | Não | `` | Nome do pastor responsável. |
| `pastor_spouse_name` | `text` | Não | `` | Nome da esposa do pastor dirigente/responsável. |
| `phone` | `text` | Não | `` | Telefone de contato. |
| `whatsapp` | `text` | Não | `` | Número de WhatsApp. |
| `email` | `text` | Não | `` | E-mail de contato. |
| `zip_code` | `text` | Não | `` | CEP do endereço. |
| `address` | `text` | Não | `` | Logradouro/endereço. |
| `number` | `text` | Não | `` | Número do endereço. |
| `complement` | `text` | Não | `` | Complemento do endereço. |
| `district` | `text` | Não | `` | Bairro. |
| `city` | `text` | Não | `` | Cidade. |
| `state` | `text` | Não | `` | Estado/UF. |
| `country` | `text` | Sim | `Brasil` | País. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `congregations_pkey` — Chave primária: `primary key (id)`
- `congregations_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `congregations_region_id_fkey` — Chave estrangeira: `foreign KEY (region_id) references regions (id) on delete set null`
- `congregations_status_check` — Validação: `check ( ( status = any (array['ACTIVE'::text, 'INACTIVE'::text]) ) )`

**Índices cadastrados:**

- `congregations_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `congregations_region_id_idx` — índice, método `btree`, expressão/colunas: `(region_id)`
- `congregations_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `congregations_city_state_idx` — índice, método `btree`, expressão/colunas: `(city, state)`
- `congregations_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`

**Triggers:**

- `set_congregations_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `app_settings`

**Finalidade:** Configurações gerais do sistema por igreja, incluindo identidade visual, numeração de membros, upload, notificações e relatórios.

**Exemplo de cadastro:** Configuração da igreja com nome do sistema “Eclesias”, cor principal `#0b51b7` e prefixo de código de membro `MEM`.

**Total de campos:** 27

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `app_name` | `text` | Sim | `Eclesias` | Nome do sistema exibido na interface. |
| `display_church_name` | `text` | Não | `` | Nome da igreja exibido no sistema e relatórios. |
| `logo_url` | `text` | Não | `` | URL do logotipo. |
| `favicon_url` | `text` | Não | `` | URL do ícone/favico do sistema. |
| `primary_color` | `text` | Não | `#0b51b7` | Cor principal da identidade visual. |
| `secondary_color` | `text` | Não | `#090f4d` | Cor secundária da identidade visual. |
| `member_code_prefix` | `text` | Não | `MEM` | Prefixo usado na geração automática de códigos de membros. |
| `member_code_next_number` | `integer` | Sim | `1` | Próximo número a ser usado no código automático de membros. |
| `member_code_padding` | `integer` | Sim | `4` | Quantidade de casas/zeros no código do membro. |
| `enable_member_auto_code` | `boolean` | Sim | `true` | Ativa ou desativa geração automática de código de membro. |
| `default_country` | `text` | Sim | `Brasil` | País padrão usado em cadastros. |
| `default_state` | `text` | Não | `` | Estado padrão usado em cadastros. |
| `default_city` | `text` | Não | `` | Cidade padrão usada em cadastros. |
| `max_upload_size_mb` | `integer` | Sim | `10` | Tamanho máximo permitido para upload em MB. |
| `allow_sensitive_documents` | `boolean` | Sim | `true` | Permite anexar documentos sensíveis. |
| `enable_audit_logs` | `boolean` | Sim | `true` | Ativa ou desativa logs de auditoria. |
| `enable_notifications` | `boolean` | Sim | `false` | Ativa ou desativa notificações. |
| `notification_channels` | `jsonb` | Sim | `jsonb_build_object('email', false, 'whatsapp', false, 'system', true)` | Configuração JSON dos canais de notificação. |
| `dashboard_settings` | `jsonb` | Sim | `jsonb_build_object(...)` | Configuração JSON dos cards/blocos exibidos no dashboard. |
| `document_settings` | `jsonb` | Sim | `jsonb_build_object(...)` | Configuração JSON sobre uploads e documentos. |
| `report_settings` | `jsonb` | Sim | `jsonb_build_object(...)` | Configuração JSON dos relatórios emitidos pelo sistema. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `app_settings_pkey` — Chave primária: `primary key (id)`
- `app_settings_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete CASCADE`
- `app_settings_max_upload_size_check` — Validação: `check ( ( (max_upload_size_mb >= 1) and (max_upload_size_mb <= 100) ) )`
- `app_settings_member_code_next_number_check` — Validação: `check ((member_code_next_number >= 1))`
- `app_settings_member_code_padding_check` — Validação: `check ( ( (member_code_padding >= 1) and (member_code_padding <= 10) ) )`
- `app_settings_status_check` — Validação: `check ( ( status = any (array['ACTIVE'::text, 'INACTIVE'::text]) ) )`

**Índices cadastrados:**

- `app_settings_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `app_settings_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `app_settings_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `app_settings_church_unique_idx` — único, método `btree`, expressão/colunas: `(church_id) where (deleted_at is null)`
- `app_settings_notification_channels_gin_idx` — índice, método `gin`, expressão/colunas: `(notification_channels)`
- `app_settings_dashboard_settings_gin_idx` — índice, método `gin`, expressão/colunas: `(dashboard_settings)`
- `app_settings_document_settings_gin_idx` — índice, método `gin`, expressão/colunas: `(document_settings)`
- `app_settings_report_settings_gin_idx` — índice, método `gin`, expressão/colunas: `(report_settings)`

**Triggers:**

- `set_app_settings_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

# Usuários, permissões e auditoria

## `profiles`

**Finalidade:** Perfil do usuário autenticado no sistema. Complementa o usuário do Supabase Auth com dados de exibição, contato e preferências.

**Exemplo de cadastro:** Usuário Lucas Eduardo, com e-mail, WhatsApp, avatar, idioma `pt-BR` e timezone `America/Sao_Paulo`.

**Total de campos:** 16

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `` | Identificador único do registro. |
| `full_name` | `text` | Não | `` | Nome completo da pessoa cadastrada. |
| `display_name` | `text` | Não | `` | Campo específico da tabela, usado para complementar o cadastro e os relatórios do módulo. |
| `email` | `text` | Não | `` | E-mail de contato. |
| `phone` | `text` | Não | `` | Telefone de contato. |
| `whatsapp` | `text` | Não | `` | Número de WhatsApp. |
| `avatar_url` | `text` | Não | `` | Campo específico da tabela, usado para complementar o cadastro e os relatórios do módulo. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `is_platform_admin` | `boolean` | Sim | `false` | Indica se o usuário é administrador da plataforma como um todo. |
| `locale` | `text` | Sim | `pt-BR` | Idioma/localidade preferencial do usuário. |
| `timezone` | `text` | Sim | `America/Sao_Paulo` | Fuso horário preferencial do usuário. |
| `last_seen_at` | `timestamp with time zone` | Não | `` | Último momento em que o usuário foi visto/acessou. |
| `accepted_terms_at` | `timestamp with time zone` | Não | `` | Data em que o usuário aceitou os termos. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `profiles_pkey` — Chave primária: `primary key (id)`
- `profiles_id_fkey` — Chave estrangeira: `foreign KEY (id) references auth.users (id) on delete CASCADE`
- `profiles_status_check` — Validação: `check ( ( status = any ( array[ 'ACTIVE'::text, 'INACTIVE'::text, 'BLOCKED'::text, 'PENDING'::text ] ) ) )`

**Índices cadastrados:**

- `profiles_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `profiles_email_idx` — índice, método `btree`, expressão/colunas: `(email)`
- `profiles_is_platform_admin_idx` — índice, método `btree`, expressão/colunas: `(is_platform_admin)`
- `profiles_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `profiles_email_unique_idx` — único, método `btree`, expressão/colunas: `(lower(email)) where ( (email is not null) and (email <> ''::text) and (deleted_at is null) )`

**Triggers:**

- `set_profiles_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `user_church_access`

**Finalidade:** Controle de acesso do usuário a uma igreja, regional, congregação ou ministério. Define escopo, papel e status do acesso.

**Exemplo de cadastro:** Usuário com papel `ADMIN` no Campo de Porangatu, com acesso a todas as congregações.

**Total de campos:** 17

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `profile_id` | `uuid` | Sim | `` | Perfil/usuário vinculado ao registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `region_id` | `uuid` | Não | `` | Regional vinculada ao registro. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `ministry_id` | `uuid` | Não | `` | Ministério vinculado ao registro. |
| `role` | `text` | Sim | `` | Campo específico da tabela, usado para complementar o cadastro e os relatórios do módulo. |
| `access_scope` | `text` | Sim | `CHURCH` | Escopo do acesso do usuário: igreja inteira, regional, congregação ou ministério. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `invited_by` | `uuid` | Não | `` | Usuário que convidou/liberou o acesso. |
| `invited_at` | `timestamp with time zone` | Não | `` | Data do convite. |
| `accepted_at` | `timestamp with time zone` | Não | `` | Data de aceite do convite/acesso. |
| `last_access_at` | `timestamp with time zone` | Não | `` | Último acesso dentro desse vínculo. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `user_church_access_pkey` — Chave primária: `primary key (id)`
- `user_church_access_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `user_church_access_invited_by_fkey` — Chave estrangeira: `foreign KEY (invited_by) references profiles (id) on delete set null`
- `user_church_access_ministry_id_fkey` — Chave estrangeira: `foreign KEY (ministry_id) references ministries (id) on delete set null`
- `user_church_access_profile_id_fkey` — Chave estrangeira: `foreign KEY (profile_id) references profiles (id) on delete CASCADE`
- `user_church_access_region_id_fkey` — Chave estrangeira: `foreign KEY (region_id) references regions (id) on delete set null`
- `user_church_access_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `user_church_access_role_check` — Validação: `check ( ( role = any ( array[ 'ADMIN'::text, 'SECRETARY'::text, 'TREASURER'::text, 'LEADER'::text, 'MINISTRY_LEADER'::text, 'VIEWER'::text ] ) ) )`
- `user_church_access_scope_check` — Validação: `check ( ( access_scope = any ( array[ 'CHURCH'::text, 'REGION'::text, 'CONGREGATION'::text, 'MINISTRY'::text ] ) ) )`
- `user_church_access_scope_target_check` — Validação: `check ( ( ( (access_scope = 'CHURCH'::text) and (region_id is null) and (congregation_id is null) and (ministry_id is null) ) or ( (access_scope = 'REGION'::text) and (region_id is not null) and (congregation_id is nu...`
- `user_church_access_status_check` — Validação: `check ( ( status = any ( array[ 'ACTIVE'::text, 'INACTIVE'::text, 'PENDING'::text, 'BLOCKED'::text ] ) ) )`

**Índices cadastrados:**

- `user_church_access_profile_id_idx` — índice, método `btree`, expressão/colunas: `(profile_id)`
- `user_church_access_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `user_church_access_region_id_idx` — índice, método `btree`, expressão/colunas: `(region_id)`
- `user_church_access_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `user_church_access_ministry_id_idx` — índice, método `btree`, expressão/colunas: `(ministry_id)`
- `user_church_access_role_idx` — índice, método `btree`, expressão/colunas: `(role)`
- `user_church_access_scope_idx` — índice, método `btree`, expressão/colunas: `(access_scope)`
- `user_church_access_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `user_church_access_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `user_church_access_unique_active_idx` — único, método `btree`, expressão/colunas: `( profile_id, church_id, access_scope, COALESCE( region_id, '00000000-0000-0000-0000-000000000000'::uuid ), COALESCE( congregation_id, '00000000-0000-0000-0000-000000000000'::uu...`

**Triggers:**

- `set_user_church_access_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `permissions`

**Finalidade:** Catálogo de permissões do sistema. Define ações liberáveis por módulo, como visualizar ou gerenciar financeiro.

**Exemplo de cadastro:** Permissão `finance.manage`, módulo `finance`, ação `manage`, marcada como sensível.

**Total de campos:** 11

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `key` | `text` | Sim | `` | Chave técnica única da permissão usada no código. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `module` | `text` | Sim | `` | Módulo do sistema ao qual o registro se refere. |
| `action` | `text` | Sim | `` | Ação permitida ou registrada, como view, create, update, delete ou manage. |
| `is_sensitive` | `boolean` | Sim | `false` | Indica se o registro/documento deve ser tratado como sensível. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `permissions_pkey` — Chave primária: `primary key (id)`
- `permissions_status_check` — Validação: `check ( ( status = any (array['ACTIVE'::text, 'INACTIVE'::text]) ) )`

**Índices cadastrados:**

- `permissions_key_unique_idx` — único, método `btree`, expressão/colunas: `(lower(key)) where (deleted_at is null)`
- `permissions_key_idx` — índice, método `btree`, expressão/colunas: `(key)`
- `permissions_module_idx` — índice, método `btree`, expressão/colunas: `(module)`
- `permissions_action_idx` — índice, método `btree`, expressão/colunas: `(action)`
- `permissions_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `permissions_is_sensitive_idx` — índice, método `btree`, expressão/colunas: `(is_sensitive)`
- `permissions_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`

**Triggers:**

- `set_permissions_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `role_permissions`

**Finalidade:** Tabela de ligação entre papéis de acesso e permissões. Permite configurar o que cada perfil pode fazer.

**Exemplo de cadastro:** Papel `TREASURER` vinculado à permissão `finance.view` ou `finance.manage`.

**Total de campos:** 7

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `role` | `text` | Sim | `` | Campo específico da tabela, usado para complementar o cadastro e os relatórios do módulo. |
| `permission_id` | `uuid` | Sim | `` | Permissão vinculada ao registro. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `role_permissions_pkey` — Chave primária: `primary key (id)`
- `role_permissions_permission_id_fkey` — Chave estrangeira: `foreign KEY (permission_id) references permissions (id) on delete CASCADE`
- `role_permissions_role_check` — Validação: `check ( ( role = any ( array[ 'ADMIN'::text, 'SECRETARY'::text, 'TREASURER'::text, 'LEADER'::text, 'MINISTRY_LEADER'::text, 'VIEWER'::text ] ) ) )`
- `role_permissions_status_check` — Validação: `check ( ( status = any (array['ACTIVE'::text, 'INACTIVE'::text]) ) )`

**Índices cadastrados:**

- `role_permissions_role_idx` — índice, método `btree`, expressão/colunas: `(role)`
- `role_permissions_permission_id_idx` — índice, método `btree`, expressão/colunas: `(permission_id)`
- `role_permissions_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `role_permissions_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `role_permissions_role_permission_unique_idx` — único, método `btree`, expressão/colunas: `(role, permission_id) where (deleted_at is null)`

**Triggers:**

- `set_role_permissions_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `audit_logs`

**Finalidade:** Registro de auditoria do sistema. Guarda ações importantes, usuário responsável, valores antigos/novos e metadados.

**Exemplo de cadastro:** Registro informando que um usuário alterou o cadastro de um membro ou finalizou uma entrega de relatório.

**Total de campos:** 17

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Não | `` | Igreja/campo ao qual o registro pertence. |
| `actor_profile_id` | `uuid` | Não | `` | Usuário/perfil que realizou a ação auditada. |
| `actor_email` | `text` | Não | `` | E-mail do usuário que realizou a ação auditada. |
| `module` | `text` | Sim | `` | Módulo do sistema ao qual o registro se refere. |
| `action` | `text` | Sim | `` | Ação permitida ou registrada, como view, create, update, delete ou manage. |
| `entity_type` | `text` | Não | `` | Tipo de entidade afetada pela ação. |
| `entity_id` | `uuid` | Não | `` | ID da entidade afetada pela ação. |
| `entity_label` | `text` | Não | `` | Nome amigável da entidade afetada. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `old_values` | `jsonb` | Não | `` | Dados anteriores à alteração. |
| `new_values` | `jsonb` | Não | `` | Dados novos após a alteração. |
| `metadata` | `jsonb` | Não | `` | Dados extras em JSON para configurações e informações flexíveis. |
| `ip_address` | `text` | Não | `` | Endereço IP relacionado à ação. |
| `user_agent` | `text` | Não | `` | Navegador/dispositivo usado na ação. |
| `severity` | `text` | Sim | `INFO` | Gravidade do log: informativo, alerta ou crítico. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |

**Restrições principais:**

- `audit_logs_pkey` — Chave primária: `primary key (id)`
- `audit_logs_actor_profile_id_fkey` — Chave estrangeira: `foreign KEY (actor_profile_id) references profiles (id) on delete set null`
- `audit_logs_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete set null`
- `audit_logs_severity_check` — Validação: `check ( ( severity = any ( array['INFO'::text, 'WARNING'::text, 'CRITICAL'::text] ) ) )`

**Índices cadastrados:**

- `audit_logs_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `audit_logs_actor_profile_id_idx` — índice, método `btree`, expressão/colunas: `(actor_profile_id)`
- `audit_logs_module_idx` — índice, método `btree`, expressão/colunas: `(module)`
- `audit_logs_action_idx` — índice, método `btree`, expressão/colunas: `(action)`
- `audit_logs_entity_idx` — índice, método `btree`, expressão/colunas: `(entity_type, entity_id)`
- `audit_logs_severity_idx` — índice, método `btree`, expressão/colunas: `(severity)`
- `audit_logs_created_at_idx` — índice, método `btree`, expressão/colunas: `(created_at)`
- `audit_logs_old_values_gin_idx` — índice, método `gin`, expressão/colunas: `(old_values)`
- `audit_logs_new_values_gin_idx` — índice, método `gin`, expressão/colunas: `(new_values)`
- `audit_logs_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`

---

# Membros, cargos e ministérios

## `members`

**Finalidade:** Cadastro principal de membros, congregados, visitantes ou pessoas vinculadas à igreja. Contém dados pessoais, ministeriais, endereço, família e histórico eclesiástico.

**Exemplo de cadastro:** Membro João da Silva, casado, pertencente à Vila Planaltina, com cargo principal de diácono e código `MEM0001`.

**Total de campos:** 62

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `congregation_id` | `uuid` | Sim | `` | Congregação vinculada ao registro. |
| `photo_url` | `text` | Não | `` | Campo específico da tabela, usado para complementar o cadastro e os relatórios do módulo. |
| `full_name` | `text` | Sim | `` | Nome completo da pessoa cadastrada. |
| `preferred_name` | `text` | Não | `` | Nome pelo qual a pessoa prefere ser chamada. |
| `gender` | `text` | Não | `` | Gênero informado no cadastro. |
| `birth_date` | `date` | Não | `` | Data de nascimento. |
| `marital_status` | `text` | Não | `` | Estado civil. |
| `wedding_date` | `date` | Não | `` | Data de casamento. |
| `nationality` | `text` | Não | `Brasileira` | Nacionalidade. |
| `natural_city` | `text` | Não | `` | Cidade de nascimento. |
| `natural_state` | `text` | Não | `` | Estado de nascimento. |
| `cpf` | `text` | Não | `` | CPF da pessoa. |
| `rg` | `text` | Não | `` | RG/documento de identidade. |
| `issuing_agency` | `text` | Não | `` | Órgão emissor do documento. |
| `profession` | `text` | Não | `` | Profissão da pessoa. |
| `education_level` | `text` | Não | `` | Escolaridade. |
| `physical_file_number` | `text` | Não | `` | Número da ficha física/arquivo manual, quando existir. |
| `phone` | `text` | Não | `` | Telefone de contato. |
| `whatsapp` | `text` | Não | `` | Número de WhatsApp. |
| `email` | `text` | Não | `` | E-mail de contato. |
| `zip_code` | `text` | Não | `` | CEP do endereço. |
| `address` | `text` | Não | `` | Logradouro/endereço. |
| `number` | `text` | Não | `` | Número do endereço. |
| `complement` | `text` | Não | `` | Complemento do endereço. |
| `district` | `text` | Não | `` | Bairro. |
| `city` | `text` | Não | `` | Cidade. |
| `state` | `text` | Não | `` | Estado/UF. |
| `country` | `text` | Sim | `Brasil` | País. |
| `father_name` | `text` | Não | `` | Nome do pai. |
| `mother_name` | `text` | Não | `` | Nome da mãe. |
| `spouse_name` | `text` | Não | `` | Nome do cônjuge. |
| `guardian_name` | `text` | Não | `` | Nome do responsável legal ou responsável pelo menor. |
| `guardian_phone` | `text` | Não | `` | Telefone do responsável. |
| `member_code` | `text` | Não | `` | Código interno do membro, geralmente gerado automaticamente. |
| `member_status` | `text` | Sim | `ACTIVE` | Situação do membro no cadastro, como ativo, inativo ou transferido. |
| `member_type` | `text` | Sim | `MEMBER` | Tipo da pessoa no sistema, como membro, congregado, visitante ou criança. |
| `joined_at` | `date` | Não | `` | Data de entrada/recebimento na igreja. |
| `conversion_date` | `date` | Não | `` | Data de conversão. |
| `baptism_date` | `date` | Não | `` | Data do batismo em águas. |
| `baptism_church` | `text` | Não | `` | Igreja onde ocorreu o batismo em águas. |
| `child_presentation_date` | `date` | Não | `` | Data de apresentação da criança. |
| `has_holy_spirit_baptism` | `boolean` | Sim | `false` | Indica se a pessoa possui batismo com o Espírito Santo registrado. |
| `holy_spirit_baptism_date` | `date` | Não | `` | Data do batismo com o Espírito Santo. |
| `previous_church` | `text` | Não | `` | Igreja de origem anterior. |
| `received_by` | `text` | Não | `` | Forma ou responsável pelo recebimento do membro. |
| `received_date` | `date` | Não | `` | Data oficial de recebimento. |
| `letter_origin_church` | `text` | Não | `` | Igreja de origem da carta de mudança/recomendação. |
| `letter_destination_church` | `text` | Não | `` | Igreja de destino em caso de transferência. |
| `transfer_date` | `date` | Não | `` | Data da transferência. |
| `inactive_reason` | `text` | Não | `` | Motivo de inativação do membro. |
| `main_role` | `text` | Não | `` | Cargo/função principal informado de forma simples no cadastro do membro. |
| `ministry` | `text` | Não | `` | Ministério principal informado de forma simples no cadastro do membro. |
| `is_public_worker` | `boolean` | Sim | `false` | Indica se a pessoa atua publicamente como obreiro/liderança. |
| `is_active_in_ministry` | `boolean` | Sim | `false` | Indica se está ativo em algum ministério. |
| `can_receive_notifications` | `boolean` | Sim | `true` | Indica se pode receber notificações do sistema. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `pastoral_notes` | `text` | Não | `` | Observações pastorais de caráter mais restrito/sensível. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `members_pkey` — Chave primária: `primary key (id)`
- `members_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete RESTRICT`
- `members_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `members_marital_status_check` — Validação: `check ( ( (marital_status is null) or ( marital_status = any ( array[ 'SINGLE'::text, 'MARRIED'::text, 'DIVORCED'::text, 'WIDOWED'::text, 'STABLE_UNION'::text, 'OTHER'::text ] ) ) ) )`
- `members_gender_check` — Validação: `check ( ( (gender is null) or ( gender = any (array['MALE'::text, 'FEMALE'::text]) ) ) )`
- `members_received_by_check` — Validação: `check ( ( (received_by is null) or ( received_by = any ( array[ 'BAPTISM'::text, 'LETTER'::text, 'ACCLAMATION'::text, 'RECONCILIATION'::text, 'TRANSFER'::text, 'OTHER'::text ] ) ) ) )`
- `members_status_check` — Validação: `check ( ( member_status = any ( array[ 'ACTIVE'::text, 'INACTIVE'::text, 'TRANSFERRED'::text, 'DISCIPLINED'::text, 'DECEASED'::text, 'VISITOR'::text ] ) ) )`
- `members_type_check` — Validação: `check ( ( member_type = any ( array[ 'MEMBER'::text, 'CONGREGATED'::text, 'VISITOR'::text, 'CHILD'::text ] ) ) )`

**Índices cadastrados:**

- `members_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `members_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `members_full_name_idx` — índice, método `btree`, expressão/colunas: `(full_name)`
- `members_member_status_idx` — índice, método `btree`, expressão/colunas: `(member_status)`
- `members_member_type_idx` — índice, método `btree`, expressão/colunas: `(member_type)`
- `members_main_role_idx` — índice, método `btree`, expressão/colunas: `(main_role)`
- `members_ministry_idx` — índice, método `btree`, expressão/colunas: `(ministry)`
- `members_city_state_idx` — índice, método `btree`, expressão/colunas: `(city, state)`
- `members_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `members_cpf_unique_idx` — único, método `btree`, expressão/colunas: `(cpf) where ( (cpf is not null) and (cpf <> ''::text) )`
- `members_church_member_code_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, member_code) where ( (member_code is not null) and (member_code <> ''::text) )`

**Triggers:**

- `set_members_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `member_history`

**Finalidade:** Histórico de alterações e eventos importantes do membro, como mudança de congregação, batismo, transferência ou observações pastorais.

**Exemplo de cadastro:** Histórico registrando que João da Silva foi transferido da congregação A para a congregação B.

**Total de campos:** 15

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `member_id` | `uuid` | Sim | `` | Membro vinculado ao registro. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `history_type` | `text` | Sim | `` | Tipo de histórico registrado para o membro. |
| `title` | `text` | Sim | `` | Título amigável do registro/documento. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `old_value` | `text` | Não | `` | Valor anterior antes de uma alteração. |
| `new_value` | `text` | Não | `` | Novo valor após uma alteração. |
| `event_date` | `date` | Sim | `CURRENT_DATE` | Data em que o fato histórico aconteceu. |
| `is_sensitive` | `boolean` | Sim | `false` | Indica se o registro/documento deve ser tratado como sensível. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `member_history_pkey` — Chave primária: `primary key (id)`
- `member_history_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `member_history_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `member_history_member_id_fkey` — Chave estrangeira: `foreign KEY (member_id) references members (id) on delete CASCADE`
- `member_history_type_check` — Validação: `check ( ( history_type = any ( array[ 'STATUS_CHANGE'::text, 'CONGREGATION_CHANGE'::text, 'ROLE_CHANGE'::text, 'MINISTRY_CHANGE'::text, 'MEMBER_RECEIVED'::text, 'MEMBER_TRANSFERRED'::text, 'MEMBER_INACTIVATED'::text, ...`

**Índices cadastrados:**

- `member_history_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `member_history_member_id_idx` — índice, método `btree`, expressão/colunas: `(member_id)`
- `member_history_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `member_history_type_idx` — índice, método `btree`, expressão/colunas: `(history_type)`
- `member_history_event_date_idx` — índice, método `btree`, expressão/colunas: `(event_date)`
- `member_history_is_sensitive_idx` — índice, método `btree`, expressão/colunas: `(is_sensitive)`
- `member_history_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`

**Triggers:**

- `set_member_history_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `member_documents`

**Finalidade:** Documentos anexados ao cadastro do membro, como carta, documento pessoal, autorização, foto ou comprovante.

**Exemplo de cadastro:** PDF de carta de recomendação, documento pessoal ou autorização anexado ao membro.

**Total de campos:** 18

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `member_id` | `uuid` | Sim | `` | Membro vinculado ao registro. |
| `document_type` | `text` | Sim | `` | Tipo do documento/anexo. |
| `title` | `text` | Sim | `` | Título amigável do registro/documento. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `file_name` | `text` | Sim | `` | Nome original ou exibido do arquivo. |
| `file_url` | `text` | Não | `` | URL pública/assinada do arquivo, quando houver. |
| `storage_bucket` | `text` | Sim | `member-documents` | Bucket do Supabase Storage onde o arquivo está salvo. |
| `storage_path` | `text` | Sim | `` | Caminho do arquivo dentro do bucket. |
| `mime_type` | `text` | Não | `` | Tipo MIME do arquivo, como application/pdf ou image/png. |
| `file_size` | `bigint` | Não | `` | Tamanho do arquivo em bytes. |
| `is_sensitive` | `boolean` | Sim | `false` | Indica se o registro/documento deve ser tratado como sensível. |
| `uploaded_by` | `uuid` | Não | `` | Usuário que enviou o arquivo. |
| `uploaded_at` | `timestamp with time zone` | Sim | `now()` | Data/hora do upload. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `member_documents_pkey` — Chave primária: `primary key (id)`
- `member_documents_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `member_documents_member_id_fkey` — Chave estrangeira: `foreign KEY (member_id) references members (id) on delete CASCADE`
- `member_documents_file_size_check` — Validação: `check ( ( (file_size is null) or (file_size >= 0) ) )`
- `member_documents_type_check` — Validação: `check ( ( document_type = any ( array[ 'PHOTO'::text, 'CPF'::text, 'RG'::text, 'BIRTH_CERTIFICATE'::text, 'MARRIAGE_CERTIFICATE'::text, 'TRANSFER_LETTER'::text, 'ADDRESS_PROOF'::text, 'BAPTISM_CERTIFICATE'::text, 'MEM...`

**Índices cadastrados:**

- `member_documents_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `member_documents_member_id_idx` — índice, método `btree`, expressão/colunas: `(member_id)`
- `member_documents_type_idx` — índice, método `btree`, expressão/colunas: `(document_type)`
- `member_documents_is_sensitive_idx` — índice, método `btree`, expressão/colunas: `(is_sensitive)`
- `member_documents_uploaded_at_idx` — índice, método `btree`, expressão/colunas: `(uploaded_at)`
- `member_documents_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `member_documents_storage_path_unique_idx` — único, método `btree`, expressão/colunas: `(storage_bucket, storage_path) where (deleted_at is null)`

**Triggers:**

- `set_member_documents_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `roles`

**Finalidade:** Cadastro de cargos e funções eclesiásticas, como pastor, presbítero, diácono, auxiliar e líder.

**Exemplo de cadastro:** Cargo “Presbítero”, categoria ministerial, nível 4, marcado como liderança.

**Total de campos:** 12

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `category` | `text` | Sim | `ECCLESIASTICAL` | Categoria ou agrupamento do cadastro. |
| `level` | `integer` | Sim | `100` | Nível hierárquico ou ordem do cargo. |
| `is_ministerial` | `boolean` | Sim | `false` | Indica se é cargo/função ministerial. |
| `is_leadership` | `boolean` | Sim | `false` | Indica se é cargo/função de liderança. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `roles_pkey` — Chave primária: `primary key (id)`
- `roles_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `roles_category_check` — Validação: `check ( ( category = any ( array[ 'ECCLESIASTICAL'::text, 'ADMINISTRATIVE'::text, 'MINISTRY'::text, 'SUPPORT'::text, 'OTHER'::text ] ) ) )`
- `roles_status_check` — Validação: `check ( ( status = any (array['ACTIVE'::text, 'INACTIVE'::text]) ) )`

**Índices cadastrados:**

- `roles_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `roles_category_idx` — índice, método `btree`, expressão/colunas: `(category)`
- `roles_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `roles_level_idx` — índice, método `btree`, expressão/colunas: `(level)`
- `roles_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `roles_church_name_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, lower(name)) where (deleted_at is null)`

**Triggers:**

- `set_roles_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `member_roles`

**Finalidade:** Vínculo entre membro e cargo/função. Permite registrar cargo principal, período e congregação onde exerce.

**Exemplo de cadastro:** João da Silva vinculado ao cargo “Diácono” desde 01/01/2026.

**Total de campos:** 14

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `member_id` | `uuid` | Sim | `` | Membro vinculado ao registro. |
| `role_id` | `uuid` | Sim | `` | Cargo/função vinculado ao registro. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `is_primary` | `boolean` | Sim | `false` | Indica se este é o vínculo principal entre múltiplos vínculos possíveis. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `start_date` | `date` | Não | `` | Data inicial do vínculo ou função. |
| `end_date` | `date` | Não | `` | Data final do vínculo ou função. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `member_roles_pkey` — Chave primária: `primary key (id)`
- `member_roles_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `member_roles_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `member_roles_member_id_fkey` — Chave estrangeira: `foreign KEY (member_id) references members (id) on delete CASCADE`
- `member_roles_role_id_fkey` — Chave estrangeira: `foreign KEY (role_id) references roles (id) on delete RESTRICT`
- `member_roles_status_check` — Validação: `check ( ( status = any ( array[ 'ACTIVE'::text, 'INACTIVE'::text, 'ENDED'::text, 'SUSPENDED'::text ] ) ) )`
- `member_roles_dates_check` — Validação: `check ( ( (end_date is null) or (start_date is null) or (end_date >= start_date) ) )`

**Índices cadastrados:**

- `member_roles_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `member_roles_member_id_idx` — índice, método `btree`, expressão/colunas: `(member_id)`
- `member_roles_role_id_idx` — índice, método `btree`, expressão/colunas: `(role_id)`
- `member_roles_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `member_roles_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `member_roles_is_primary_idx` — índice, método `btree`, expressão/colunas: `(is_primary)`
- `member_roles_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `member_roles_active_unique_idx` — único, método `btree`, expressão/colunas: `(member_id, role_id) where ( (deleted_at is null) and (status = 'ACTIVE'::text) )`
- `member_roles_one_primary_active_idx` — único, método `btree`, expressão/colunas: `(member_id) where ( (deleted_at is null) and (status = 'ACTIVE'::text) and (is_primary = true) )`

**Triggers:**

- `set_member_roles_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `ministries`

**Finalidade:** Cadastro de ministérios/departamentos ministeriais, como jovens, louvor, missões, escola bíblica e infantil.

**Exemplo de cadastro:** Ministério de Jovens, global ou vinculado à congregação, com líder responsável.

**Total de campos:** 12

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `leader_member_id` | `uuid` | Não | `` | Membro responsável/líder do ministério. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `category` | `text` | Sim | `OTHER` | Categoria ou agrupamento do cadastro. |
| `is_global` | `boolean` | Sim | `false` | Indica se o registro vale para toda a igreja/campo, e não apenas uma congregação. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `ministries_pkey` — Chave primária: `primary key (id)`
- `ministries_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `ministries_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `ministries_leader_member_id_fkey` — Chave estrangeira: `foreign KEY (leader_member_id) references members (id) on delete set null`
- `ministries_category_check` — Validação: `check ( ( category = any ( array[ 'WORSHIP'::text, 'YOUTH'::text, 'WOMEN'::text, 'MEN'::text, 'CHILDREN'::text, 'EDUCATION'::text, 'MISSIONS'::text, 'EVANGELISM'::text, 'ADMINISTRATIVE'::text, 'FINANCIAL'::text, 'COMM...`
- `ministries_status_check` — Validação: `check ( ( status = any (array['ACTIVE'::text, 'INACTIVE'::text]) ) )`

**Índices cadastrados:**

- `ministries_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `ministries_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `ministries_leader_member_id_idx` — índice, método `btree`, expressão/colunas: `(leader_member_id)`
- `ministries_category_idx` — índice, método `btree`, expressão/colunas: `(category)`
- `ministries_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `ministries_is_global_idx` — índice, método `btree`, expressão/colunas: `(is_global)`
- `ministries_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `ministries_church_congregation_name_unique_idx` — único, método `btree`, expressão/colunas: `( church_id, COALESCE( congregation_id, '00000000-0000-0000-0000-000000000000'::uuid ), lower(name) ) where (deleted_at is null)`

**Triggers:**

- `set_ministries_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `member_ministries`

**Finalidade:** Vínculo entre membro e ministério. Define liderança, ministério principal, período e status de participação.

**Exemplo de cadastro:** Maria Souza como líder do Ministério de Louvor da Vila Planaltina.

**Total de campos:** 15

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `member_id` | `uuid` | Sim | `` | Membro vinculado ao registro. |
| `ministry_id` | `uuid` | Sim | `` | Ministério vinculado ao registro. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `is_leader` | `boolean` | Sim | `false` | Indica se a pessoa é líder naquele vínculo. |
| `is_primary` | `boolean` | Sim | `false` | Indica se este é o vínculo principal entre múltiplos vínculos possíveis. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `start_date` | `date` | Não | `` | Data inicial do vínculo ou função. |
| `end_date` | `date` | Não | `` | Data final do vínculo ou função. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `member_ministries_pkey` — Chave primária: `primary key (id)`
- `member_ministries_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `member_ministries_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `member_ministries_ministry_id_fkey` — Chave estrangeira: `foreign KEY (ministry_id) references ministries (id) on delete RESTRICT`
- `member_ministries_member_id_fkey` — Chave estrangeira: `foreign KEY (member_id) references members (id) on delete CASCADE`
- `member_ministries_dates_check` — Validação: `check ( ( (end_date is null) or (start_date is null) or (end_date >= start_date) ) )`
- `member_ministries_status_check` — Validação: `check ( ( status = any ( array[ 'ACTIVE'::text, 'INACTIVE'::text, 'ENDED'::text, 'SUSPENDED'::text ] ) ) )`

**Índices cadastrados:**

- `member_ministries_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `member_ministries_member_id_idx` — índice, método `btree`, expressão/colunas: `(member_id)`
- `member_ministries_ministry_id_idx` — índice, método `btree`, expressão/colunas: `(ministry_id)`
- `member_ministries_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `member_ministries_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `member_ministries_is_leader_idx` — índice, método `btree`, expressão/colunas: `(is_leader)`
- `member_ministries_is_primary_idx` — índice, método `btree`, expressão/colunas: `(is_primary)`
- `member_ministries_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `member_ministries_active_unique_idx` — único, método `btree`, expressão/colunas: `(member_id, ministry_id) where ( (deleted_at is null) and (status = 'ACTIVE'::text) )`
- `member_ministries_one_primary_active_idx` — único, método `btree`, expressão/colunas: `(member_id) where ( (deleted_at is null) and (status = 'ACTIVE'::text) and (is_primary = true) )`

**Triggers:**

- `set_member_ministries_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

# Eventos

## `events`

**Finalidade:** Cadastro principal dos eventos da igreja, incluindo tipo, visibilidade, datas, local, inscrições, pagamentos, cotas e configurações.

**Exemplo de cadastro:** CONFRAJOVEM 2026, com inscrições abertas, pagamento por Pix, vagas limitadas e QR Code para check-in.

**Total de campos:** 43

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `ministry_id` | `uuid` | Não | `` | Ministério vinculado ao registro. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `slug` | `text` | Não | `` | Identificador amigável para URL/página pública do evento. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `event_type` | `text` | Sim | `OTHER` | Tipo do evento, como congresso, curso, culto, retiro ou acampamento. |
| `visibility` | `text` | Sim | `INTERNAL` | Visibilidade do evento: público, privado ou interno. |
| `status` | `text` | Sim | `DRAFT` | Status atual do registro. |
| `registration_mode` | `text` | Sim | `INDIVIDUAL` | Modo de inscrição: individual, grupo ou misto. |
| `quota_mode` | `text` | Sim | `GENERAL` | Modo de cota: geral, por congregação, por cidade ou sem cota. |
| `host_city` | `text` | Não | `` | Cidade anfitriã ou cidade principal do evento. |
| `host_state` | `text` | Não | `` | Estado da cidade anfitriã. |
| `location_name` | `text` | Não | `` | Nome do local onde o evento acontece. |
| `zip_code` | `text` | Não | `` | CEP do endereço. |
| `address` | `text` | Não | `` | Logradouro/endereço. |
| `number` | `text` | Não | `` | Número do endereço. |
| `complement` | `text` | Não | `` | Complemento do endereço. |
| `district` | `text` | Não | `` | Bairro. |
| `city` | `text` | Não | `` | Cidade. |
| `state` | `text` | Não | `` | Estado/UF. |
| `country` | `text` | Sim | `Brasil` | País. |
| `starts_at` | `timestamp with time zone` | Sim | `` | Data e hora de início do evento. |
| `ends_at` | `timestamp with time zone` | Não | `` | Data e hora de fim do evento. |
| `registration_starts_at` | `timestamp with time zone` | Não | `` | Data/hora de início das inscrições. |
| `registration_ends_at` | `timestamp with time zone` | Não | `` | Data/hora de encerramento das inscrições. |
| `capacity` | `integer` | Não | `` | Capacidade/vagas máximas do evento. |
| `allow_waitlist` | `boolean` | Sim | `false` | Permite lista de espera quando as vagas acabarem. |
| `requires_payment` | `boolean` | Sim | `false` | Indica se o evento exige pagamento. |
| `allow_installments` | `boolean` | Sim | `false` | Permite parcelamento do pagamento. |
| `max_installments` | `integer` | Sim | `1` | Quantidade máxima de parcelas permitidas. |
| `requires_group_responsible` | `boolean` | Sim | `false` | Exige responsável para inscrições/caravanas em grupo. |
| `requires_gender_totals` | `boolean` | Sim | `false` | Exige totais masculino/feminino no grupo. |
| `requires_pastor_info` | `boolean` | Sim | `false` | Exige informações do pastor responsável. |
| `uses_registration_batches` | `boolean` | Sim | `false` | Indica se o evento usa lotes de inscrição. |
| `banner_url` | `text` | Não | `` | Imagem/banner do evento. |
| `settings` | `jsonb` | Sim | `jsonb_build_object(...)` | Configurações extras em JSON. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `events_pkey` — Chave primária: `primary key (id)`
- `events_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `events_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `events_ministry_id_fkey` — Chave estrangeira: `foreign KEY (ministry_id) references ministries (id) on delete set null`
- `events_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `events_registration_mode_check` — Validação: `check ( ( registration_mode = any ( array['INDIVIDUAL'::text, 'GROUP'::text, 'MIXED'::text] ) ) )`
- `events_status_check` — Validação: `check ( ( status = any ( array[ 'DRAFT'::text, 'PUBLISHED'::text, 'REGISTRATION_OPEN'::text, 'REGISTRATION_CLOSED'::text, 'IN_PROGRESS'::text, 'FINISHED'::text, 'CANCELLED'::text ] ) ) )`
- `events_type_check` — Validação: `check ( ( event_type = any ( array[ 'CONFERENCE'::text, 'CAMP'::text, 'RETREAT'::text, 'COURSE'::text, 'MEETING'::text, 'SERVICE'::text, 'CONGRESS'::text, 'TRAINING'::text, 'DINNER'::text, 'SYMPOSIUM'::text, 'OTHER'::...`
- `events_capacity_check` — Validação: `check ( ( (capacity is null) or (capacity >= 0) ) )`
- `events_visibility_check` — Validação: `check ( ( visibility = any ( array['PUBLIC'::text, 'PRIVATE'::text, 'INTERNAL'::text] ) ) )`
- `events_dates_check` — Validação: `check ( ( (ends_at is null) or (ends_at >= starts_at) ) )`
- `events_max_installments_check` — Validação: `check ( ( (max_installments >= 1) and (max_installments <= 12) ) )`
- `events_quota_mode_check` — Validação: `check ( ( quota_mode = any ( array[ 'GENERAL'::text, 'BY_CONGREGATION'::text, 'BY_CITY'::text, 'NONE'::text ] ) ) )`
- `events_registration_dates_check` — Validação: `check ( ( (registration_ends_at is null) or (registration_starts_at is null) or (registration_ends_at >= registration_starts_at) ) )`

**Índices cadastrados:**

- `events_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `events_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `events_ministry_id_idx` — índice, método `btree`, expressão/colunas: `(ministry_id)`
- `events_name_idx` — índice, método `btree`, expressão/colunas: `(name)`
- `events_slug_idx` — índice, método `btree`, expressão/colunas: `(slug)`
- `events_type_idx` — índice, método `btree`, expressão/colunas: `(event_type)`
- `events_visibility_idx` — índice, método `btree`, expressão/colunas: `(visibility)`
- `events_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `events_registration_mode_idx` — índice, método `btree`, expressão/colunas: `(registration_mode)`
- `events_quota_mode_idx` — índice, método `btree`, expressão/colunas: `(quota_mode)`
- `events_host_city_state_idx` — índice, método `btree`, expressão/colunas: `(host_city, host_state)`
- `events_starts_at_idx` — índice, método `btree`, expressão/colunas: `(starts_at)`
- `events_registration_period_idx` — índice, método `btree`, expressão/colunas: `(registration_starts_at, registration_ends_at)`
- `events_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `events_church_slug_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, lower(slug)) where ( (slug is not null) and (slug <> ''::text) and (deleted_at is null) )`
- `events_settings_gin_idx` — índice, método `gin`, expressão/colunas: `(settings)`

---

## `event_congregation_quotas`

**Finalidade:** Controle de cotas de inscrição por congregação dentro de um evento.

**Exemplo de cadastro:** Vila Planaltina com cota de 8 inscrições no CONFRAJOVEM.

**Total de campos:** 10

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `event_id` | `uuid` | Sim | `` | Evento vinculado ao registro. |
| `congregation_id` | `uuid` | Sim | `` | Congregação vinculada ao registro. |
| `quota_total` | `integer` | Sim | `0` | Quantidade de vagas/cotas reservadas para a congregação. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `event_congregation_quotas_pkey` — Chave primária: `primary key (id)`
- `event_congregation_quotas_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `event_congregation_quotas_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete CASCADE`
- `event_congregation_quotas_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `event_congregation_quotas_event_id_fkey` — Chave estrangeira: `foreign KEY (event_id) references events (id) on delete CASCADE`
- `event_congregation_quotas_total_check` — Validação: `check ((quota_total >= 0))`

**Índices cadastrados:**

- `event_congregation_quotas_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `event_congregation_quotas_event_id_idx` — índice, método `btree`, expressão/colunas: `(event_id)`
- `event_congregation_quotas_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `event_congregation_quotas_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `event_congregation_quotas_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `event_congregation_quotas_unique_idx` — único, método `btree`, expressão/colunas: `(event_id, congregation_id) where (deleted_at is null)`

**Triggers:**

- `set_event_congregation_quotas_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `event_groups`

**Finalidade:** Cadastro de caravanas/grupos de eventos, com cidade de origem, responsável, pastor e totais por gênero.

**Exemplo de cadastro:** Caravana de São Miguel do Araguaia com responsável, pastor e totais masculino/feminino.

**Total de campos:** 21

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `event_id` | `uuid` | Sim | `` | Evento vinculado ao registro. |
| `origin_church_name` | `text` | Não | `` | Nome da igreja de origem do grupo/caravana. |
| `origin_field_name` | `text` | Não | `` | Nome do campo/ministério de origem do grupo/caravana. |
| `origin_city` | `text` | Sim | `` | Cidade de origem do grupo/caravana. |
| `origin_state` | `text` | Sim | `GO` | Estado de origem do grupo/caravana. |
| `responsible_name` | `text` | Sim | `` | Nome do responsável pelo grupo/caravana. |
| `responsible_phone` | `text` | Não | `` | Telefone do responsável pelo grupo/caravana. |
| `responsible_email` | `text` | Não | `` | E-mail do responsável pelo grupo/caravana. |
| `pastor_name` | `text` | Não | `` | Nome do pastor responsável. |
| `pastor_phone` | `text` | Não | `` | Telefone do pastor responsável. |
| `total_registrations` | `integer` | Sim | `0` | Total de inscrições/participantes do grupo. |
| `male_count` | `integer` | Sim | `0` | Quantidade de participantes masculinos. |
| `female_count` | `integer` | Sim | `0` | Quantidade de participantes femininos. |
| `status` | `text` | Sim | `PENDING` | Status atual do registro. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `event_groups_pkey` — Chave primária: `primary key (id)`
- `event_groups_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `event_groups_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `event_groups_event_id_fkey` — Chave estrangeira: `foreign KEY (event_id) references events (id) on delete CASCADE`
- `event_groups_counts_check` — Validação: `check ( ( (total_registrations >= 0) and (male_count >= 0) and (female_count >= 0) and ( total_registrations >= (male_count + female_count) ) ) )`
- `event_groups_status_check` — Validação: `check ( ( status = any ( array[ 'PENDING'::text, 'CONFIRMED'::text, 'PARTIALLY_PAID'::text, 'PAID'::text, 'CANCELLED'::text ] ) ) )`

**Índices cadastrados:**

- `event_groups_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `event_groups_event_id_idx` — índice, método `btree`, expressão/colunas: `(event_id)`
- `event_groups_origin_city_state_idx` — índice, método `btree`, expressão/colunas: `(origin_city, origin_state)`
- `event_groups_responsible_name_idx` — índice, método `btree`, expressão/colunas: `(responsible_name)`
- `event_groups_pastor_name_idx` — índice, método `btree`, expressão/colunas: `(pastor_name)`
- `event_groups_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `event_groups_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `event_groups_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `event_groups_event_origin_unique_idx` — único, método `btree`, expressão/colunas: `( event_id, lower(origin_city), lower(origin_state), lower(COALESCE(origin_field_name, ''::text)) ) where (deleted_at is null)`

**Triggers:**

- `set_event_groups_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `event_items`

**Finalidade:** Itens cobrados ou controlados em um evento, como inscrição, camiseta, alimentação, hospedagem, transporte ou kit.

**Exemplo de cadastro:** Item “Inscrição”, tipo `REGISTRATION`, preço R$ 35, obrigatório e contando para capacidade.

**Total de campos:** 21

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `event_id` | `uuid` | Sim | `` | Evento vinculado ao registro. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `item_type` | `text` | Sim | `OTHER` | Tipo do item do evento, como inscrição, camiseta, alimentação ou hospedagem. |
| `price` | `numeric(12, 2)` | Sim | `0` | Preço de venda/cobrança do item. |
| `cost_price` | `numeric(12, 2)` | Não | `` | Custo interno do item, quando aplicável. |
| `is_required` | `boolean` | Sim | `false` | Indica se o item/regra é obrigatório. |
| `is_active` | `boolean` | Sim | `true` | Indica se o item está ativo para uso. |
| `allow_quantity` | `boolean` | Sim | `false` | Permite escolher quantidade do item. |
| `min_quantity` | `integer` | Sim | `1` | Quantidade mínima permitida. |
| `max_quantity` | `integer` | Não | `` | Quantidade máxima permitida. |
| `available_quantity` | `integer` | Não | `` | Quantidade disponível em estoque/vagas. |
| `sort_order` | `integer` | Sim | `0` | Ordem de exibição nas telas e relatórios. |
| `settings` | `jsonb` | Sim | `jsonb_build_object(...)` | Configurações extras em JSON. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `event_items_pkey` — Chave primária: `primary key (id)`
- `event_items_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `event_items_event_id_fkey` — Chave estrangeira: `foreign KEY (event_id) references events (id) on delete CASCADE`
- `event_items_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `event_items_cost_price_check` — Validação: `check ( ( (cost_price is null) or (cost_price >= (0)::numeric) ) )`
- `event_items_price_check` — Validação: `check ((price >= (0)::numeric))`
- `event_items_quantity_check` — Validação: `check ( ( (min_quantity >= 0) and ( (max_quantity is null) or (max_quantity >= min_quantity) ) and ( (available_quantity is null) or (available_quantity >= 0) ) ) )`
- `event_items_type_check` — Validação: `check ( ( item_type = any ( array[ 'REGISTRATION'::text, 'SHIRT'::text, 'FOOD'::text, 'LODGING'::text, 'TRANSPORT'::text, 'KIT'::text, 'DONATION'::text, 'OTHER'::text ] ) ) )`

**Índices cadastrados:**

- `event_items_settings_gin_idx` — índice, método `gin`, expressão/colunas: `(settings)`
- `event_items_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `event_items_event_id_idx` — índice, método `btree`, expressão/colunas: `(event_id)`
- `event_items_type_idx` — índice, método `btree`, expressão/colunas: `(item_type)`
- `event_items_is_required_idx` — índice, método `btree`, expressão/colunas: `(is_required)`
- `event_items_is_active_idx` — índice, método `btree`, expressão/colunas: `(is_active)`
- `event_items_sort_order_idx` — índice, método `btree`, expressão/colunas: `(sort_order)`
- `event_items_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `event_items_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `event_items_event_name_unique_idx` — único, método `btree`, expressão/colunas: `(event_id, lower(name)) where (deleted_at is null)`

**Triggers:**

- `set_event_items_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `event_registrations`

**Finalidade:** Inscrições individuais em eventos, vinculadas ou não a membro/congregação/grupo.

**Exemplo de cadastro:** Inscrição de Ana Souza no CONFRAJOVEM, vinculada à congregação e com status `CONFIRMED`.

**Total de campos:** 32

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `event_id` | `uuid` | Sim | `` | Evento vinculado ao registro. |
| `event_group_id` | `uuid` | Não | `` | Grupo/caravana do evento vinculada ao registro. |
| `member_id` | `uuid` | Não | `` | Membro vinculado ao registro. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `registration_number` | `text` | Não | `` | Número/código da inscrição. |
| `participant_name` | `text` | Sim | `` | Nome do participante inscrito. |
| `participant_document` | `text` | Não | `` | Documento do participante. |
| `participant_phone` | `text` | Não | `` | Telefone do participante. |
| `participant_email` | `text` | Não | `` | E-mail do participante. |
| `participant_birth_date` | `date` | Não | `` | Data de nascimento do participante. |
| `participant_gender` | `text` | Não | `` | Gênero do participante. |
| `participant_city` | `text` | Não | `` | Cidade do participante. |
| `participant_state` | `text` | Não | `` | Estado do participante. |
| `participant_type` | `text` | Sim | `EXTERNAL` | Tipo do participante, como membro, visitante, criança, obreiro ou pastor. |
| `status` | `text` | Sim | `PENDING` | Status atual do registro. |
| `payment_status` | `text` | Sim | `PENDING` | Situação do pagamento. |
| `total_amount` | `numeric(12, 2)` | Sim | `0` | Valor total a pagar/receber. |
| `paid_amount` | `numeric(12, 2)` | Sim | `0` | Valor já pago. |
| `remaining_amount` | `numeric` | Calculado | `calculado automaticamente` | Saldo restante calculado automaticamente. |
| `registered_at` | `timestamp with time zone` | Sim | `now()` | Data/hora em que a inscrição foi registrada. |
| `confirmed_at` | `timestamp with time zone` | Não | `` | Data/hora de confirmação. |
| `cancelled_at` | `timestamp with time zone` | Não | `` | Data/hora de cancelamento. |
| `cancel_reason` | `text` | Não | `` | Motivo do cancelamento. |
| `qr_code_value` | `text` | Não | `` | Valor/código usado para gerar ou validar QR Code. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `metadata` | `jsonb` | Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `event_registrations_pkey` — Chave primária: `primary key (id)`
- `event_registrations_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `event_registrations_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `event_registrations_member_id_fkey` — Chave estrangeira: `foreign KEY (member_id) references members (id) on delete set null`
- `event_registrations_event_group_id_fkey` — Chave estrangeira: `foreign KEY (event_group_id) references event_groups (id) on delete set null`
- `event_registrations_event_id_fkey` — Chave estrangeira: `foreign KEY (event_id) references events (id) on delete CASCADE`
- `event_registrations_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `event_registrations_status_check` — Validação: `check ( ( status = any ( array[ 'PENDING'::text, 'CONFIRMED'::text, 'WAITLIST'::text, 'CANCELLED'::text, 'CHECKED_IN'::text, 'NO_SHOW'::text ] ) ) )`
- `event_registrations_gender_check` — Validação: `check ( ( (participant_gender is null) or ( participant_gender = any (array['MALE'::text, 'FEMALE'::text]) ) ) )`
- `event_registrations_participant_type_check` — Validação: `check ( ( participant_type = any ( array[ 'MEMBER'::text, 'CONGREGATED'::text, 'VISITOR'::text, 'EXTERNAL'::text, 'CHILD'::text, 'WORKER'::text, 'PASTOR'::text ] ) ) )`
- `event_registrations_payment_status_check` — Validação: `check ( ( payment_status = any ( array[ 'NOT_REQUIRED'::text, 'PENDING'::text, 'PARTIAL'::text, 'PAID'::text, 'REFUNDED'::text, 'CANCELLED'::text ] ) ) )`
- `event_registrations_amounts_check` — Validação: `check ( ( (total_amount >= (0)::numeric) and (paid_amount >= (0)::numeric) and (paid_amount <= total_amount) ) )`

**Índices cadastrados:**

- `event_registrations_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `event_registrations_event_id_idx` — índice, método `btree`, expressão/colunas: `(event_id)`
- `event_registrations_event_group_id_idx` — índice, método `btree`, expressão/colunas: `(event_group_id)`
- `event_registrations_member_id_idx` — índice, método `btree`, expressão/colunas: `(member_id)`
- `event_registrations_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `event_registrations_registration_number_idx` — índice, método `btree`, expressão/colunas: `(registration_number)`
- `event_registrations_participant_name_idx` — índice, método `btree`, expressão/colunas: `(participant_name)`
- `event_registrations_participant_document_idx` — índice, método `btree`, expressão/colunas: `(participant_document)`
- `event_registrations_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `event_registrations_payment_status_idx` — índice, método `btree`, expressão/colunas: `(payment_status)`
- `event_registrations_registered_at_idx` — índice, método `btree`, expressão/colunas: `(registered_at)`
- `event_registrations_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `event_registrations_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `event_registrations_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`
- `event_registrations_event_member_unique_idx` — único, método `btree`, expressão/colunas: `(event_id, member_id) where ( (member_id is not null) and (deleted_at is null) and (status <> 'CANCELLED'::text) )`
- `event_registrations_event_document_unique_idx` — único, método `btree`, expressão/colunas: `(event_id, participant_document) where ( (participant_document is not null) and (participant_document <> ''::text) and (deleted_at is null) and (status <> 'CANCELLED'::text) )`
- `event_registrations_number_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, registration_number) where ( (registration_number is not null) and (registration_number <> ''::text) and (deleted_at is null) )`

**Triggers:**

- `set_event_registrations_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `event_registration_items`

**Finalidade:** Itens escolhidos/comprados em uma inscrição individual ou de grupo, com quantidade, preço e observações.

**Exemplo de cadastro:** Ana Souza comprou 1 inscrição e 1 camiseta tamanho M no evento.

**Total de campos:** 18

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `event_id` | `uuid` | Sim | `` | Evento vinculado ao registro. |
| `event_registration_id` | `uuid` | Não | `` | Inscrição do evento vinculada ao registro. |
| `event_group_id` | `uuid` | Não | `` | Grupo/caravana do evento vinculada ao registro. |
| `event_item_id` | `uuid` | Sim | `` | Item de evento selecionado na inscrição ou grupo. |
| `item_name` | `text` | Sim | `` | Nome do item salvo no momento da inscrição. |
| `item_type` | `text` | Sim | `` | Tipo do item do evento, como inscrição, camiseta, alimentação ou hospedagem. |
| `unit_price` | `numeric(12, 2)` | Sim | `0` | Preço unitário do item. |
| `quantity` | `integer` | Sim | `1` | Quantidade do item. |
| `total_price` | `numeric` | Calculado | `calculado automaticamente` | Valor total calculado automaticamente pelo preço unitário x quantidade. |
| `size` | `text` | Não | `` | Tamanho escolhido, como tamanho de camiseta. |
| `observation` | `text` | Não | `` | Observação específica do item selecionado. |
| `metadata` | `jsonb` | Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `event_registration_items_pkey` — Chave primária: `primary key (id)`
- `event_registration_items_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `event_registration_items_event_group_id_fkey` — Chave estrangeira: `foreign KEY (event_group_id) references event_groups (id) on delete CASCADE`
- `event_registration_items_event_id_fkey` — Chave estrangeira: `foreign KEY (event_id) references events (id) on delete CASCADE`
- `event_registration_items_event_item_id_fkey` — Chave estrangeira: `foreign KEY (event_item_id) references event_items (id) on delete RESTRICT`
- `event_registration_items_event_registration_id_fkey` — Chave estrangeira: `foreign KEY (event_registration_id) references event_registrations (id) on delete CASCADE`
- `event_registration_items_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `event_registration_items_owner_check` — Validação: `check ( ( (event_registration_id is not null) or (event_group_id is not null) ) )`
- `event_registration_items_price_check` — Validação: `check ((unit_price >= (0)::numeric))`
- `event_registration_items_quantity_check` — Validação: `check ((quantity >= 1))`
- `event_registration_items_type_check` — Validação: `check ( ( item_type = any ( array[ 'REGISTRATION'::text, 'SHIRT'::text, 'FOOD'::text, 'LODGING'::text, 'TRANSPORT'::text, 'KIT'::text, 'DONATION'::text, 'OTHER'::text ] ) ) )`

**Índices cadastrados:**

- `event_registration_items_event_item_id_idx` — índice, método `btree`, expressão/colunas: `(event_item_id)`
- `event_registration_items_item_type_idx` — índice, método `btree`, expressão/colunas: `(item_type)`
- `event_registration_items_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `event_registration_items_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `event_registration_items_event_id_idx` — índice, método `btree`, expressão/colunas: `(event_id)`
- `event_registration_items_registration_id_idx` — índice, método `btree`, expressão/colunas: `(event_registration_id)`
- `event_registration_items_group_id_idx` — índice, método `btree`, expressão/colunas: `(event_group_id)`
- `event_registration_items_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `event_registration_items_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`
- `event_registration_items_registration_item_unique_idx` — único, método `btree`, expressão/colunas: `(event_registration_id, event_item_id) where ( (event_registration_id is not null) and (deleted_at is null) )`
- `event_registration_items_group_item_unique_idx` — único, método `btree`, expressão/colunas: `(event_group_id, event_item_id) where ( (event_group_id is not null) and (deleted_at is null) )`

**Triggers:**

- `set_event_registration_items_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `event_payments`

**Finalidade:** Pagamentos de inscrições ou grupos de eventos, com forma, status, parcelas e comprovantes.

**Exemplo de cadastro:** Pagamento Pix de R$ 35 referente à inscrição, com status `CONFIRMED` e comprovante anexado.

**Total de campos:** 25

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `event_id` | `uuid` | Sim | `` | Evento vinculado ao registro. |
| `event_registration_id` | `uuid` | Não | `` | Inscrição do evento vinculada ao registro. |
| `event_group_id` | `uuid` | Não | `` | Grupo/caravana do evento vinculada ao registro. |
| `payment_number` | `text` | Não | `` | Número/código do pagamento. |
| `payment_method` | `text` | Sim | `PIX` | Forma de pagamento usada no evento. |
| `payment_status` | `text` | Sim | `PENDING` | Situação do pagamento. |
| `amount` | `numeric(12, 2)` | Sim | `0` | Valor financeiro do registro. |
| `paid_at` | `timestamp with time zone` | Não | `` | Data/hora em que o pagamento foi realizado. |
| `due_date` | `date` | Não | `` | Data de vencimento. |
| `installment_number` | `integer` | Sim | `1` | Número da parcela. |
| `installments_total` | `integer` | Sim | `1` | Total de parcelas. |
| `transaction_reference` | `text` | Não | `` | Referência externa da transação/pagamento. |
| `payer_name` | `text` | Não | `` | Nome de quem pagou. |
| `payer_document` | `text` | Não | `` | Documento de quem pagou. |
| `receipt_file_url` | `text` | Não | `` | URL do comprovante do pagamento do evento. |
| `receipt_storage_path` | `text` | Não | `` | Caminho do comprovante no Storage. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `metadata` | `jsonb` | Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis. |
| `confirmed_by` | `uuid` | Não | `` | Usuário que confirmou o lançamento. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `event_payments_pkey` — Chave primária: `primary key (id)`
- `event_payments_confirmed_by_fkey` — Chave estrangeira: `foreign KEY (confirmed_by) references profiles (id) on delete set null`
- `event_payments_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `event_payments_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `event_payments_event_group_id_fkey` — Chave estrangeira: `foreign KEY (event_group_id) references event_groups (id) on delete CASCADE`
- `event_payments_event_id_fkey` — Chave estrangeira: `foreign KEY (event_id) references events (id) on delete CASCADE`
- `event_payments_event_registration_id_fkey` — Chave estrangeira: `foreign KEY (event_registration_id) references event_registrations (id) on delete CASCADE`
- `event_payments_status_check` — Validação: `check ( ( payment_status = any ( array[ 'PENDING'::text, 'CONFIRMED'::text, 'CANCELLED'::text, 'REFUNDED'::text, 'FAILED'::text ] ) ) )`
- `event_payments_installments_check` — Validação: `check ( ( (installment_number >= 1) and (installments_total >= 1) and (installment_number <= installments_total) ) )`
- `event_payments_method_check` — Validação: `check ( ( payment_method = any ( array[ 'PIX'::text, 'CASH'::text, 'CREDIT_CARD'::text, 'DEBIT_CARD'::text, 'BANK_TRANSFER'::text, 'BANK_SLIP'::text, 'OTHER'::text ] ) ) )`
- `event_payments_owner_check` — Validação: `check ( ( (event_registration_id is not null) or (event_group_id is not null) ) )`
- `event_payments_amount_check` — Validação: `check ((amount >= (0)::numeric))`

**Índices cadastrados:**

- `event_payments_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `event_payments_event_id_idx` — índice, método `btree`, expressão/colunas: `(event_id)`
- `event_payments_registration_id_idx` — índice, método `btree`, expressão/colunas: `(event_registration_id)`
- `event_payments_group_id_idx` — índice, método `btree`, expressão/colunas: `(event_group_id)`
- `event_payments_payment_number_idx` — índice, método `btree`, expressão/colunas: `(payment_number)`
- `event_payments_method_idx` — índice, método `btree`, expressão/colunas: `(payment_method)`
- `event_payments_status_idx` — índice, método `btree`, expressão/colunas: `(payment_status)`
- `event_payments_paid_at_idx` — índice, método `btree`, expressão/colunas: `(paid_at)`
- `event_payments_due_date_idx` — índice, método `btree`, expressão/colunas: `(due_date)`
- `event_payments_confirmed_by_idx` — índice, método `btree`, expressão/colunas: `(confirmed_by)`
- `event_payments_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `event_payments_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `event_payments_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`
- `event_payments_number_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, payment_number) where ( (payment_number is not null) and (payment_number <> ''::text) and (deleted_at is null) )`
- `event_payments_registration_installment_unique_idx` — único, método `btree`, expressão/colunas: `(event_registration_id, installment_number) where ( (event_registration_id is not null) and (deleted_at is null) and (payment_status <> 'CANCELLED'::text) )`
- `event_payments_group_installment_unique_idx` — único, método `btree`, expressão/colunas: `(event_group_id, installment_number) where ( (event_group_id is not null) and (deleted_at is null) and (payment_status <> 'CANCELLED'::text) )`

**Triggers:**

- `set_event_payments_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `event_checkins`

**Finalidade:** Controle de check-in dos participantes no evento, via QR Code, busca ou lançamento manual.

**Exemplo de cadastro:** Check-in de participante validado por QR Code na entrada do evento.

**Total de campos:** 16

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `event_id` | `uuid` | Sim | `` | Evento vinculado ao registro. |
| `event_registration_id` | `uuid` | Sim | `` | Inscrição do evento vinculada ao registro. |
| `event_group_id` | `uuid` | Não | `` | Grupo/caravana do evento vinculada ao registro. |
| `checkin_code` | `text` | Não | `` | Código usado para check-in. |
| `checkin_method` | `text` | Sim | `MANUAL` | Método de check-in: QR Code, manual, busca, importação etc. |
| `status` | `text` | Sim | `CHECKED_IN` | Status atual do registro. |
| `checked_in_at` | `timestamp with time zone` | Não | `` | Data/hora do check-in. |
| `checked_in_by` | `uuid` | Não | `` | Usuário que realizou o check-in. |
| `device_info` | `text` | Não | `` | Informações do dispositivo usado no check-in. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `metadata` | `jsonb` | Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `event_checkins_pkey` — Chave primária: `primary key (id)`
- `event_checkins_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `event_checkins_event_group_id_fkey` — Chave estrangeira: `foreign KEY (event_group_id) references event_groups (id) on delete set null`
- `event_checkins_event_id_fkey` — Chave estrangeira: `foreign KEY (event_id) references events (id) on delete CASCADE`
- `event_checkins_event_registration_id_fkey` — Chave estrangeira: `foreign KEY (event_registration_id) references event_registrations (id) on delete CASCADE`
- `event_checkins_checked_in_by_fkey` — Chave estrangeira: `foreign KEY (checked_in_by) references profiles (id) on delete set null`
- `event_checkins_method_check` — Validação: `check ( ( checkin_method = any ( array[ 'QR_CODE'::text, 'MANUAL'::text, 'SEARCH'::text, 'IMPORT'::text, 'OTHER'::text ] ) ) )`
- `event_checkins_status_check` — Validação: `check ( ( status = any ( array[ 'PENDING'::text, 'CHECKED_IN'::text, 'CANCELLED'::text, 'INVALID'::text ] ) ) )`

**Índices cadastrados:**

- `event_checkins_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `event_checkins_event_id_idx` — índice, método `btree`, expressão/colunas: `(event_id)`
- `event_checkins_registration_id_idx` — índice, método `btree`, expressão/colunas: `(event_registration_id)`
- `event_checkins_group_id_idx` — índice, método `btree`, expressão/colunas: `(event_group_id)`
- `event_checkins_code_idx` — índice, método `btree`, expressão/colunas: `(checkin_code)`
- `event_checkins_method_idx` — índice, método `btree`, expressão/colunas: `(checkin_method)`
- `event_checkins_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `event_checkins_checked_in_at_idx` — índice, método `btree`, expressão/colunas: `(checked_in_at)`
- `event_checkins_checked_in_by_idx` — índice, método `btree`, expressão/colunas: `(checked_in_by)`
- `event_checkins_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `event_checkins_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`
- `event_checkins_registration_unique_idx` — único, método `btree`, expressão/colunas: `(event_registration_id) where ( (deleted_at is null) and (status = 'CHECKED_IN'::text) )`
- `event_checkins_code_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, checkin_code) where ( (checkin_code is not null) and (checkin_code <> ''::text) and (deleted_at is null) )`

**Triggers:**

- `set_event_checkins_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `event_documents`

**Finalidade:** Documentos e anexos relacionados a eventos, inscrições, grupos ou pagamentos.

**Exemplo de cadastro:** Comprovante de pagamento, lista de caravana, contrato de local ou relatório do evento.

**Total de campos:** 23

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `event_id` | `uuid` | Sim | `` | Evento vinculado ao registro. |
| `event_registration_id` | `uuid` | Não | `` | Inscrição do evento vinculada ao registro. |
| `event_group_id` | `uuid` | Não | `` | Grupo/caravana do evento vinculada ao registro. |
| `event_payment_id` | `uuid` | Não | `` | Pagamento do evento vinculado ao registro. |
| `document_type` | `text` | Sim | `OTHER` | Tipo do documento/anexo. |
| `title` | `text` | Sim | `` | Título amigável do registro/documento. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `file_name` | `text` | Sim | `` | Nome original ou exibido do arquivo. |
| `file_url` | `text` | Não | `` | URL pública/assinada do arquivo, quando houver. |
| `storage_bucket` | `text` | Sim | `event-documents` | Bucket do Supabase Storage onde o arquivo está salvo. |
| `storage_path` | `text` | Sim | `` | Caminho do arquivo dentro do bucket. |
| `mime_type` | `text` | Não | `` | Tipo MIME do arquivo, como application/pdf ou image/png. |
| `file_size` | `bigint` | Não | `` | Tamanho do arquivo em bytes. |
| `is_sensitive` | `boolean` | Sim | `false` | Indica se o registro/documento deve ser tratado como sensível. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `metadata` | `jsonb` | Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis. |
| `uploaded_by` | `uuid` | Não | `` | Usuário que enviou o arquivo. |
| `uploaded_at` | `timestamp with time zone` | Sim | `now()` | Data/hora do upload. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `event_documents_pkey` — Chave primária: `primary key (id)`
- `event_documents_event_group_id_fkey` — Chave estrangeira: `foreign KEY (event_group_id) references event_groups (id) on delete CASCADE`
- `event_documents_event_id_fkey` — Chave estrangeira: `foreign KEY (event_id) references events (id) on delete CASCADE`
- `event_documents_event_payment_id_fkey` — Chave estrangeira: `foreign KEY (event_payment_id) references event_payments (id) on delete CASCADE`
- `event_documents_event_registration_id_fkey` — Chave estrangeira: `foreign KEY (event_registration_id) references event_registrations (id) on delete CASCADE`
- `event_documents_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `event_documents_uploaded_by_fkey` — Chave estrangeira: `foreign KEY (uploaded_by) references profiles (id) on delete set null`
- `event_documents_status_check` — Validação: `check ( ( status = any ( array[ 'ACTIVE'::text, 'INACTIVE'::text, 'ARCHIVED'::text ] ) ) )`
- `event_documents_type_check` — Validação: `check ( ( document_type = any ( array[ 'BANNER'::text, 'PAYMENT_RECEIPT'::text, 'REGISTRATION_RECEIPT'::text, 'GROUP_LIST'::text, 'AUTHORIZATION'::text, 'SPREADSHEET'::text, 'CONTRACT'::text, 'REPORT'::text, 'ADMINIST...`
- `event_documents_file_size_check` — Validação: `check ( ( (file_size is null) or (file_size >= 0) ) )`

**Índices cadastrados:**

- `event_documents_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `event_documents_event_id_idx` — índice, método `btree`, expressão/colunas: `(event_id)`
- `event_documents_registration_id_idx` — índice, método `btree`, expressão/colunas: `(event_registration_id)`
- `event_documents_group_id_idx` — índice, método `btree`, expressão/colunas: `(event_group_id)`
- `event_documents_payment_id_idx` — índice, método `btree`, expressão/colunas: `(event_payment_id)`
- `event_documents_type_idx` — índice, método `btree`, expressão/colunas: `(document_type)`
- `event_documents_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `event_documents_is_sensitive_idx` — índice, método `btree`, expressão/colunas: `(is_sensitive)`
- `event_documents_uploaded_by_idx` — índice, método `btree`, expressão/colunas: `(uploaded_by)`
- `event_documents_uploaded_at_idx` — índice, método `btree`, expressão/colunas: `(uploaded_at)`
- `event_documents_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `event_documents_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`
- `event_documents_storage_path_unique_idx` — único, método `btree`, expressão/colunas: `(storage_bucket, storage_path) where (deleted_at is null)`

**Triggers:**

- `set_event_documents_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

# Financeiro

## `financial_departments`

**Finalidade:** Departamentos financeiros cadastráveis, como Tesouraria, Construção, Missões, Eventos ou Administrativo.

**Exemplo de cadastro:** Departamento “Tesouraria”, tipo `TREASURY`, padrão para lançamentos financeiros.

**Total de campos:** 14

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `code` | `text` | Não | `` | Código interno opcional para busca, relatórios ou integração. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `department_type` | `text` | Sim | `OTHER` | Tipo do departamento financeiro. |
| `is_default` | `boolean` | Sim | `false` | Indica se o registro é o padrão. |
| `sort_order` | `integer` | Sim | `0` | Ordem de exibição nas telas e relatórios. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `financial_departments_pkey` — Chave primária: `primary key (id)`
- `financial_departments_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `financial_departments_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `financial_departments_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `financial_departments_status_check` — Validação: `check ( ( status = any (array['ACTIVE'::text, 'INACTIVE'::text]) ) )`
- `financial_departments_type_check` — Validação: `check ( ( department_type = any ( array[ 'TREASURY'::text, 'CONSTRUCTION'::text, 'MISSIONS'::text, 'EVENTS'::text, 'MINISTRY'::text, 'SOCIAL'::text, 'ADMINISTRATIVE'::text, 'OTHER'::text ] ) ) )`

**Índices cadastrados:**

- `financial_departments_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `financial_departments_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `financial_departments_name_idx` — índice, método `btree`, expressão/colunas: `(name)`
- `financial_departments_code_idx` — índice, método `btree`, expressão/colunas: `(code)`
- `financial_departments_type_idx` — índice, método `btree`, expressão/colunas: `(department_type)`
- `financial_departments_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `financial_departments_sort_order_idx` — índice, método `btree`, expressão/colunas: `(sort_order)`
- `financial_departments_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `financial_departments_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `financial_departments_unique_idx` — único, método `btree`, expressão/colunas: `( church_id, COALESCE( congregation_id, '00000000-0000-0000-0000-000000000000'::uuid ), lower(name) ) where (deleted_at is null)`
- `financial_departments_code_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, lower(code)) where ( (code is not null) and (code <> ''::text) and (deleted_at is null) )`

**Triggers:**

- `set_financial_departments_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `financial_cashboxes`

**Finalidade:** Caixas/locais onde o dinheiro fica, como Caixa Dinheiro, Conta Bancária, Caixa Pix ou caixa específico de evento.

**Exemplo de cadastro:** Caixa Pix ou Conta Bancária, com saldo inicial e saldo atual informativo.

**Total de campos:** 20

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `code` | `text` | Não | `` | Código interno opcional para busca, relatórios ou integração. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `cashbox_type` | `text` | Sim | `OTHER` | Tipo do caixa financeiro. |
| `bank_name` | `text` | Não | `` | Nome do banco. |
| `agency` | `text` | Não | `` | Agência bancária. |
| `account_number` | `text` | Não | `` | Número da conta bancária. |
| `pix_key` | `text` | Não | `` | Chave Pix vinculada ao caixa/conta. |
| `opening_balance` | `numeric(12, 2)` | Sim | `0` | Saldo inicial informado para o caixa. |
| `current_balance` | `numeric(12, 2)` | Sim | `0` | Saldo atual registrado/informativo do caixa. |
| `is_default` | `boolean` | Sim | `false` | Indica se o registro é o padrão. |
| `sort_order` | `integer` | Sim | `0` | Ordem de exibição nas telas e relatórios. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `financial_cashboxes_pkey` — Chave primária: `primary key (id)`
- `financial_cashboxes_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `financial_cashboxes_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `financial_cashboxes_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `financial_cashboxes_status_check` — Validação: `check ( ( status = any (array['ACTIVE'::text, 'INACTIVE'::text]) ) )`
- `financial_cashboxes_type_check` — Validação: `check ( ( cashbox_type = any ( array[ 'CASH'::text, 'BANK_ACCOUNT'::text, 'PIX'::text, 'CARD'::text, 'EVENT'::text, 'OTHER'::text ] ) ) )`

**Índices cadastrados:**

- `financial_cashboxes_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `financial_cashboxes_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `financial_cashboxes_name_idx` — índice, método `btree`, expressão/colunas: `(name)`
- `financial_cashboxes_code_idx` — índice, método `btree`, expressão/colunas: `(code)`
- `financial_cashboxes_type_idx` — índice, método `btree`, expressão/colunas: `(cashbox_type)`
- `financial_cashboxes_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `financial_cashboxes_is_default_idx` — índice, método `btree`, expressão/colunas: `(is_default)`
- `financial_cashboxes_sort_order_idx` — índice, método `btree`, expressão/colunas: `(sort_order)`
- `financial_cashboxes_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `financial_cashboxes_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `financial_cashboxes_unique_idx` — único, método `btree`, expressão/colunas: `( church_id, COALESCE( congregation_id, '00000000-0000-0000-0000-000000000000'::uuid ), lower(name) ) where (deleted_at is null)`
- `financial_cashboxes_code_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, lower(code)) where ( (code is not null) and (code <> ''::text) and (deleted_at is null) )`

**Triggers:**

- `set_financial_cashboxes_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `financial_payment_methods`

**Finalidade:** Formas de pagamento/recebimento, como Dinheiro, Pix, Cartão, Transferência, Boleto e Cheque.

**Exemplo de cadastro:** Forma “Pix”, que exige referência e comprovante de recebimento.

**Total de campos:** 15

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `code` | `text` | Não | `` | Código interno opcional para busca, relatórios ou integração. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `method_type` | `text` | Sim | `OTHER` | Tipo da forma de pagamento. |
| `requires_reference` | `boolean` | Sim | `false` | Indica se a forma exige referência/código de transação. |
| `requires_receipt_upload` | `boolean` | Sim | `false` | Indica se normalmente exige upload de comprovante. |
| `is_default` | `boolean` | Sim | `false` | Indica se o registro é o padrão. |
| `sort_order` | `integer` | Sim | `0` | Ordem de exibição nas telas e relatórios. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `financial_payment_methods_pkey` — Chave primária: `primary key (id)`
- `financial_payment_methods_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `financial_payment_methods_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `financial_payment_methods_status_check` — Validação: `check ( ( status = any (array['ACTIVE'::text, 'INACTIVE'::text]) ) )`
- `financial_payment_methods_type_check` — Validação: `check ( ( method_type = any ( array[ 'CASH'::text, 'PIX'::text, 'DEBIT_CARD'::text, 'CREDIT_CARD'::text, 'BANK_TRANSFER'::text, 'BANK_SLIP'::text, 'CHECK'::text, 'OTHER'::text ] ) ) )`

**Índices cadastrados:**

- `financial_payment_methods_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `financial_payment_methods_name_idx` — índice, método `btree`, expressão/colunas: `(name)`
- `financial_payment_methods_code_idx` — índice, método `btree`, expressão/colunas: `(code)`
- `financial_payment_methods_type_idx` — índice, método `btree`, expressão/colunas: `(method_type)`
- `financial_payment_methods_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `financial_payment_methods_is_default_idx` — índice, método `btree`, expressão/colunas: `(is_default)`
- `financial_payment_methods_sort_order_idx` — índice, método `btree`, expressão/colunas: `(sort_order)`
- `financial_payment_methods_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `financial_payment_methods_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `financial_payment_methods_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, lower(name)) where (deleted_at is null)`
- `financial_payment_methods_code_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, lower(code)) where ( (code is not null) and (code <> ''::text) and (deleted_at is null) )`

**Triggers:**

- `set_financial_payment_methods_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `financial_categories`

**Finalidade:** Plano de contas financeiro. Organiza categorias de entradas, saídas, dízimos, ofertas e itens de entrega de relatório.

**Exemplo de cadastro:** Categoria “Dízimo - Senhor”, tipo entrada, grupo dízimo, exige membro e gera recibo.

**Total de campos:** 21

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `department_id` | `uuid` | Não | `` | Departamento financeiro vinculado ao registro. |
| `parent_id` | `uuid` | Não | `` | Identificador/vínculo com parent relacionado ao registro. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `code` | `text` | Não | `` | Código interno opcional para busca, relatórios ou integração. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `category_type` | `text` | Sim | `INCOME` | Define se a categoria é de entrada, saída ou ambos. |
| `category_group` | `text` | Sim | `OTHER` | Grupo da categoria, como dízimo, oferta, construção, seguro ou relatório. |
| `is_tithe` | `boolean` | Sim | `false` | Indica se a categoria representa dízimo. |
| `is_offering` | `boolean` | Sim | `false` | Indica se a categoria representa oferta. |
| `is_report_delivery_item` | `boolean` | Sim | `false` | Indica se a categoria é usada na entrega de relatório. |
| `requires_member` | `boolean` | Sim | `false` | Indica se o lançamento deve pedir membro/pessoa. |
| `generate_receipt` | `boolean` | Sim | `false` | Indica se deve gerar recibo automaticamente. |
| `is_default` | `boolean` | Sim | `false` | Indica se o registro é o padrão. |
| `sort_order` | `integer` | Sim | `0` | Ordem de exibição nas telas e relatórios. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `financial_categories_pkey` — Chave primária: `primary key (id)`
- `financial_categories_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `financial_categories_department_id_fkey` — Chave estrangeira: `foreign KEY (department_id) references financial_departments (id) on delete set null`
- `financial_categories_parent_id_fkey` — Chave estrangeira: `foreign KEY (parent_id) references financial_categories (id) on delete set null`
- `financial_categories_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `financial_categories_group_check` — Validação: `check ( ( category_group = any ( array[ 'TITHE'::text, 'OFFERING'::text, 'DONATION'::text, 'EVENT'::text, 'MISSION'::text, 'CONSTRUCTION'::text, 'ADMINISTRATIVE'::text, 'PASTORAL'::text, 'REPORT_DELIVERY'::text, 'TAX'...`
- `financial_categories_status_check` — Validação: `check ( ( status = any (array['ACTIVE'::text, 'INACTIVE'::text]) ) )`
- `financial_categories_type_check` — Validação: `check ( ( category_type = any ( array['INCOME'::text, 'EXPENSE'::text, 'BOTH'::text] ) ) )`

**Índices cadastrados:**

- `financial_categories_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `financial_categories_department_id_idx` — índice, método `btree`, expressão/colunas: `(department_id)`
- `financial_categories_parent_id_idx` — índice, método `btree`, expressão/colunas: `(parent_id)`
- `financial_categories_name_idx` — índice, método `btree`, expressão/colunas: `(name)`
- `financial_categories_code_idx` — índice, método `btree`, expressão/colunas: `(code)`
- `financial_categories_type_idx` — índice, método `btree`, expressão/colunas: `(category_type)`
- `financial_categories_group_idx` — índice, método `btree`, expressão/colunas: `(category_group)`
- `financial_categories_is_tithe_idx` — índice, método `btree`, expressão/colunas: `(is_tithe)`
- `financial_categories_is_offering_idx` — índice, método `btree`, expressão/colunas: `(is_offering)`
- `financial_categories_is_report_delivery_item_idx` — índice, método `btree`, expressão/colunas: `(is_report_delivery_item)`
- `financial_categories_requires_member_idx` — índice, método `btree`, expressão/colunas: `(requires_member)`
- `financial_categories_generate_receipt_idx` — índice, método `btree`, expressão/colunas: `(generate_receipt)`
- `financial_categories_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `financial_categories_sort_order_idx` — índice, método `btree`, expressão/colunas: `(sort_order)`
- `financial_categories_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `financial_categories_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `financial_categories_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, lower(name)) where (deleted_at is null)`
- `financial_categories_code_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, lower(code)) where ( (code is not null) and (code <> ''::text) and (deleted_at is null) )`

---

## `financial_transactions`

**Finalidade:** Tabela central dos lançamentos financeiros. Registra entradas, saídas, dízimos, ofertas, despesas e vínculos com membro/pessoa.

**Exemplo de cadastro:** Entrada de dízimo de R$ 150,00 via Pix, vinculada a membro, caixa e categoria.

**Total de campos:** 35

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `member_id` | `uuid` | Não | `` | Membro vinculado ao registro. |
| `department_id` | `uuid` | Não | `` | Departamento financeiro vinculado ao registro. |
| `cashbox_id` | `uuid` | Não | `` | Caixa financeiro vinculado ao registro. |
| `payment_method_id` | `uuid` | Não | `` | Forma de pagamento vinculada ao registro. |
| `category_id` | `uuid` | Sim | `` | Categoria financeira vinculada ao registro. |
| `transaction_type` | `text` | Sim | `` | Tipo do lançamento: entrada ou saída. |
| `source_type` | `text` | Sim | `MANUAL` | Origem do lançamento: manual, evento, entrega de relatório, contas a pagar etc. |
| `transaction_number` | `text` | Não | `` | Número/código interno da transação. |
| `document_number` | `text` | Não | `` | Número de documento, nota, recibo físico ou referência manual. |
| `person_name` | `text` | Não | `` | Nome da pessoa relacionada ao lançamento, mesmo quando não há cadastro. |
| `is_unregistered_person` | `boolean` | Sim | `false` | Indica que a pessoa informada não possui cadastro de membro. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `amount` | `numeric(12, 2)` | Sim | `0` | Valor financeiro do registro. |
| `transaction_date` | `date` | Sim | `CURRENT_DATE` | Data da transação financeira. |
| `reference_month` | `integer` | Não | `` | Mês de referência do lançamento ou relatório. |
| `reference_year` | `integer` | Não | `` | Ano de referência do lançamento ou relatório. |
| `payment_reference` | `text` | Não | `` | Referência de pagamento, como ID Pix, autorização de cartão ou código bancário. |
| `has_attachment` | `boolean` | Sim | `false` | Indica se existe anexo/comprovante vinculado. |
| `generate_receipt` | `boolean` | Sim | `false` | Indica se deve gerar recibo automaticamente. |
| `receipt_printed` | `boolean` | Sim | `false` | Indica se o recibo já foi impresso. |
| `status` | `text` | Sim | `CONFIRMED` | Status atual do registro. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `metadata` | `jsonb` | Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis. |
| `confirmed_by` | `uuid` | Não | `` | Usuário que confirmou o lançamento. |
| `confirmed_at` | `timestamp with time zone` | Não | `` | Data/hora de confirmação. |
| `cancelled_by` | `uuid` | Não | `` | Usuário que cancelou o registro. |
| `cancelled_at` | `timestamp with time zone` | Não | `` | Data/hora de cancelamento. |
| `cancel_reason` | `text` | Não | `` | Motivo do cancelamento. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `financial_transactions_pkey` — Chave primária: `primary key (id)`
- `financial_transactions_cashbox_id_fkey` — Chave estrangeira: `foreign KEY (cashbox_id) references financial_cashboxes (id) on delete set null`
- `financial_transactions_category_id_fkey` — Chave estrangeira: `foreign KEY (category_id) references financial_categories (id) on delete RESTRICT`
- `financial_transactions_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `financial_transactions_confirmed_by_fkey` — Chave estrangeira: `foreign KEY (confirmed_by) references profiles (id) on delete set null`
- `financial_transactions_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `financial_transactions_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `financial_transactions_department_id_fkey` — Chave estrangeira: `foreign KEY (department_id) references financial_departments (id) on delete set null`
- `financial_transactions_member_id_fkey` — Chave estrangeira: `foreign KEY (member_id) references members (id) on delete set null`
- `financial_transactions_cancelled_by_fkey` — Chave estrangeira: `foreign KEY (cancelled_by) references profiles (id) on delete set null`
- `financial_transactions_payment_method_id_fkey` — Chave estrangeira: `foreign KEY (payment_method_id) references financial_payment_methods (id) on delete set null`
- `financial_transactions_type_check` — Validação: `check ( ( transaction_type = any (array['INCOME'::text, 'EXPENSE'::text]) ) )`
- `financial_transactions_person_check` — Validação: `check ( ( ( (member_id is not null) and (is_unregistered_person = false) ) or ( (member_id is null) and (is_unregistered_person = true) and (person_name is not null) and ( length( TRIM( both from person_name ) ) > 0 )...`
- `financial_transactions_reference_month_check` — Validação: `check ( ( (reference_month is null) or ( (reference_month >= 1) and (reference_month <= 12) ) ) )`
- `financial_transactions_reference_year_check` — Validação: `check ( ( (reference_year is null) or (reference_year >= 2000) ) )`
- `financial_transactions_source_check` — Validação: `check ( ( source_type = any ( array[ 'MANUAL'::text, 'EVENT'::text, 'REPORT_DELIVERY'::text, 'ACCOUNTS_PAYABLE'::text, 'IMPORT'::text, 'OTHER'::text ] ) ) )`
- `financial_transactions_status_check` — Validação: `check ( ( status = any ( array[ 'DRAFT'::text, 'CONFIRMED'::text, 'CANCELLED'::text, 'REVERSED'::text ] ) ) )`
- `financial_transactions_amount_check` — Validação: `check ((amount >= (0)::numeric))`

**Índices cadastrados:**

- `financial_transactions_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `financial_transactions_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `financial_transactions_member_id_idx` — índice, método `btree`, expressão/colunas: `(member_id)`
- `financial_transactions_department_id_idx` — índice, método `btree`, expressão/colunas: `(department_id)`
- `financial_transactions_cashbox_id_idx` — índice, método `btree`, expressão/colunas: `(cashbox_id)`
- `financial_transactions_payment_method_id_idx` — índice, método `btree`, expressão/colunas: `(payment_method_id)`
- `financial_transactions_category_id_idx` — índice, método `btree`, expressão/colunas: `(category_id)`
- `financial_transactions_type_idx` — índice, método `btree`, expressão/colunas: `(transaction_type)`
- `financial_transactions_source_idx` — índice, método `btree`, expressão/colunas: `(source_type)`
- `financial_transactions_number_idx` — índice, método `btree`, expressão/colunas: `(transaction_number)`
- `financial_transactions_document_number_idx` — índice, método `btree`, expressão/colunas: `(document_number)`
- `financial_transactions_person_name_idx` — índice, método `btree`, expressão/colunas: `(person_name)`
- `financial_transactions_is_unregistered_person_idx` — índice, método `btree`, expressão/colunas: `(is_unregistered_person)`
- `financial_transactions_transaction_date_idx` — índice, método `btree`, expressão/colunas: `(transaction_date)`
- `financial_transactions_reference_month_year_idx` — índice, método `btree`, expressão/colunas: `(reference_year, reference_month)`
- `financial_transactions_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `financial_transactions_has_attachment_idx` — índice, método `btree`, expressão/colunas: `(has_attachment)`
- `financial_transactions_generate_receipt_idx` — índice, método `btree`, expressão/colunas: `(generate_receipt)`
- `financial_transactions_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `financial_transactions_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `financial_transactions_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`
- `financial_transactions_number_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, transaction_number) where ( (transaction_number is not null) and (transaction_number <> ''::text) and (deleted_at is null) )`

**Triggers:**

- `set_financial_transactions_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `financial_receipts`

**Finalidade:** Recibos financeiros gerados pelo sistema, principalmente recibos térmicos de dízimos, ofertas e entradas.

**Exemplo de cadastro:** Recibo `REC-2026-000001` de dízimo, emitido e impresso em impressora térmica.

**Total de campos:** 25

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `financial_transaction_id` | `uuid` | Sim | `` | Transação financeira vinculada ao registro. |
| `receipt_number` | `text` | Sim | `` | Número/código do recibo. |
| `receipt_type` | `text` | Sim | `INCOME` | Tipo do recibo, como dízimo, oferta, entrada ou relatório. |
| `receipt_status` | `text` | Sim | `ISSUED` | Status do recibo. |
| `receipt_title` | `text` | Não | `` | Título exibido no recibo. |
| `person_name` | `text` | Não | `` | Nome da pessoa relacionada ao lançamento, mesmo quando não há cadastro. |
| `amount` | `numeric(12, 2)` | Sim | `0` | Valor financeiro do registro. |
| `issued_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de emissão do recibo. |
| `printed_at` | `timestamp with time zone` | Não | `` | Data/hora de impressão do recibo. |
| `printed_by` | `uuid` | Não | `` | Usuário que imprimiu o recibo. |
| `print_count` | `integer` | Sim | `0` | Quantidade de vezes que o recibo foi impresso. |
| `printer_name` | `text` | Não | `` | Nome da impressora usada. |
| `receipt_content` | `text` | Não | `` | Conteúdo textual do recibo. |
| `receipt_html` | `text` | Não | `` | Conteúdo HTML do recibo, quando usado. |
| `metadata` | `jsonb` | Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis. |
| `cancelled_by` | `uuid` | Não | `` | Usuário que cancelou o registro. |
| `cancelled_at` | `timestamp with time zone` | Não | `` | Data/hora de cancelamento. |
| `cancel_reason` | `text` | Não | `` | Motivo do cancelamento. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `financial_receipts_pkey` — Chave primária: `primary key (id)`
- `financial_receipts_printed_by_fkey` — Chave estrangeira: `foreign KEY (printed_by) references profiles (id) on delete set null`
- `financial_receipts_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `financial_receipts_cancelled_by_fkey` — Chave estrangeira: `foreign KEY (cancelled_by) references profiles (id) on delete set null`
- `financial_receipts_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `financial_receipts_financial_transaction_id_fkey` — Chave estrangeira: `foreign KEY (financial_transaction_id) references financial_transactions (id) on delete CASCADE`
- `financial_receipts_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `financial_receipts_type_check` — Validação: `check ( ( receipt_type = any ( array[ 'TITHE'::text, 'OFFERING'::text, 'INCOME'::text, 'EXPENSE'::text, 'REPORT_DELIVERY'::text, 'OTHER'::text ] ) ) )`
- `financial_receipts_print_count_check` — Validação: `check ((print_count >= 0))`
- `financial_receipts_status_check` — Validação: `check ( ( receipt_status = any ( array[ 'ISSUED'::text, 'PRINTED'::text, 'CANCELLED'::text, 'REPRINTED'::text ] ) ) )`
- `financial_receipts_amount_check` — Validação: `check ((amount >= (0)::numeric))`

**Índices cadastrados:**

- `financial_receipts_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `financial_receipts_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `financial_receipts_transaction_id_idx` — índice, método `btree`, expressão/colunas: `(financial_transaction_id)`
- `financial_receipts_number_idx` — índice, método `btree`, expressão/colunas: `(receipt_number)`
- `financial_receipts_type_idx` — índice, método `btree`, expressão/colunas: `(receipt_type)`
- `financial_receipts_status_idx` — índice, método `btree`, expressão/colunas: `(receipt_status)`
- `financial_receipts_person_name_idx` — índice, método `btree`, expressão/colunas: `(person_name)`
- `financial_receipts_issued_at_idx` — índice, método `btree`, expressão/colunas: `(issued_at)`
- `financial_receipts_printed_at_idx` — índice, método `btree`, expressão/colunas: `(printed_at)`
- `financial_receipts_printed_by_idx` — índice, método `btree`, expressão/colunas: `(printed_by)`
- `financial_receipts_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `financial_receipts_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `financial_receipts_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`
- `financial_receipts_number_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, receipt_number) where (deleted_at is null)`

**Triggers:**

- `set_financial_receipts_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `financial_documents`

**Finalidade:** Documentos financeiros anexados a transações, recibos ou contas a pagar, como comprovantes Pix, notas fiscais e boletos.

**Exemplo de cadastro:** Comprovante Pix ou nota fiscal anexado a uma transação, recibo ou conta a pagar.

**Total de campos:** 23

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `financial_transaction_id` | `uuid` | Não | `` | Transação financeira vinculada ao registro. |
| `financial_receipt_id` | `uuid` | Não | `` | Recibo financeiro vinculado ao registro. |
| `document_type` | `text` | Sim | `OTHER` | Tipo do documento/anexo. |
| `title` | `text` | Sim | `` | Título amigável do registro/documento. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `file_name` | `text` | Sim | `` | Nome original ou exibido do arquivo. |
| `file_url` | `text` | Não | `` | URL pública/assinada do arquivo, quando houver. |
| `storage_bucket` | `text` | Sim | `financial-documents` | Bucket do Supabase Storage onde o arquivo está salvo. |
| `storage_path` | `text` | Sim | `` | Caminho do arquivo dentro do bucket. |
| `mime_type` | `text` | Não | `` | Tipo MIME do arquivo, como application/pdf ou image/png. |
| `file_size` | `bigint` | Não | `` | Tamanho do arquivo em bytes. |
| `is_sensitive` | `boolean` | Sim | `true` | Indica se o registro/documento deve ser tratado como sensível. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `metadata` | `jsonb` | Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis. |
| `uploaded_by` | `uuid` | Não | `` | Usuário que enviou o arquivo. |
| `uploaded_at` | `timestamp with time zone` | Sim | `now()` | Data/hora do upload. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |
| `accounts_payable_id` | `uuid` | Não | `` | Conta a pagar vinculada ao documento. |

**Restrições principais:**

- `financial_documents_pkey` — Chave primária: `primary key (id)`
- `financial_documents_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `financial_documents_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `financial_documents_financial_receipt_id_fkey` — Chave estrangeira: `foreign KEY (financial_receipt_id) references financial_receipts (id) on delete CASCADE`
- `financial_documents_financial_transaction_id_fkey` — Chave estrangeira: `foreign KEY (financial_transaction_id) references financial_transactions (id) on delete CASCADE`
- `financial_documents_uploaded_by_fkey` — Chave estrangeira: `foreign KEY (uploaded_by) references profiles (id) on delete set null`
- `financial_documents_accounts_payable_id_fkey` — Chave estrangeira: `foreign KEY (accounts_payable_id) references accounts_payable (id) on delete CASCADE`
- `financial_documents_relation_check` — Validação: `check ( ( (financial_transaction_id is not null) or (financial_receipt_id is not null) or (accounts_payable_id is not null) ) )`
- `financial_documents_status_check` — Validação: `check ( ( status = any ( array[ 'ACTIVE'::text, 'INACTIVE'::text, 'ARCHIVED'::text ] ) ) )`
- `financial_documents_type_check` — Validação: `check ( ( document_type = any ( array[ 'PAYMENT_PROOF'::text, 'PIX_RECEIPT'::text, 'INVOICE'::text, 'BANK_SLIP'::text, 'CARD_RECEIPT'::text, 'MANUAL_RECEIPT'::text, 'THERMAL_RECEIPT'::text, 'REPORT'::text, 'CONTRACT':...`
- `financial_documents_file_size_check` — Validação: `check ( ( (file_size is null) or (file_size >= 0) ) )`

**Índices cadastrados:**

- `financial_documents_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `financial_documents_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `financial_documents_transaction_id_idx` — índice, método `btree`, expressão/colunas: `(financial_transaction_id)`
- `financial_documents_receipt_id_idx` — índice, método `btree`, expressão/colunas: `(financial_receipt_id)`
- `financial_documents_type_idx` — índice, método `btree`, expressão/colunas: `(document_type)`
- `financial_documents_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `financial_documents_is_sensitive_idx` — índice, método `btree`, expressão/colunas: `(is_sensitive)`
- `financial_documents_uploaded_by_idx` — índice, método `btree`, expressão/colunas: `(uploaded_by)`
- `financial_documents_uploaded_at_idx` — índice, método `btree`, expressão/colunas: `(uploaded_at)`
- `financial_documents_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `financial_documents_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`
- `financial_documents_storage_path_unique_idx` — único, método `btree`, expressão/colunas: `(storage_bucket, storage_path) where (deleted_at is null)`
- `financial_documents_accounts_payable_id_idx` — índice, método `btree`, expressão/colunas: `(accounts_payable_id)`

**Triggers:**

- `set_financial_documents_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `accounts_payable`

**Finalidade:** Controle de contas a pagar, com vencimento, status, fornecedor, valor, pagamento e possível vínculo com saída financeira.

**Exemplo de cadastro:** Conta de energia de R$ 320,00, vencendo em 10/07/2026, status `PENDING`.

**Total de campos:** 28

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `department_id` | `uuid` | Não | `` | Departamento financeiro vinculado ao registro. |
| `category_id` | `uuid` | Não | `` | Categoria financeira vinculada ao registro. |
| `cashbox_id` | `uuid` | Não | `` | Caixa financeiro vinculado ao registro. |
| `payment_method_id` | `uuid` | Não | `` | Forma de pagamento vinculada ao registro. |
| `financial_transaction_id` | `uuid` | Não | `` | Transação financeira vinculada ao registro. |
| `payable_number` | `text` | Não | `` | Número/código interno da conta a pagar. |
| `description` | `text` | Sim | `` | Descrição detalhada do registro. |
| `supplier_name` | `text` | Não | `` | Fornecedor, prestador ou favorecido. |
| `document_number` | `text` | Não | `` | Número de documento, nota, recibo físico ou referência manual. |
| `amount` | `numeric(12, 2)` | Sim | `0` | Valor financeiro do registro. |
| `due_date` | `date` | Sim | `` | Data de vencimento. |
| `paid_at` | `timestamp with time zone` | Não | `` | Data/hora em que o pagamento foi realizado. |
| `status` | `text` | Sim | `PENDING` | Status atual do registro. |
| `payment_reference` | `text` | Não | `` | Referência de pagamento, como ID Pix, autorização de cartão ou código bancário. |
| `has_attachment` | `boolean` | Sim | `false` | Indica se existe anexo/comprovante vinculado. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `metadata` | `jsonb` | Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `paid_by` | `uuid` | Não | `` | Usuário que marcou a conta como paga. |
| `cancelled_by` | `uuid` | Não | `` | Usuário que cancelou o registro. |
| `cancelled_at` | `timestamp with time zone` | Não | `` | Data/hora de cancelamento. |
| `cancel_reason` | `text` | Não | `` | Motivo do cancelamento. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `accounts_payable_pkey` — Chave primária: `primary key (id)`
- `accounts_payable_cashbox_id_fkey` — Chave estrangeira: `foreign KEY (cashbox_id) references financial_cashboxes (id) on delete set null`
- `accounts_payable_category_id_fkey` — Chave estrangeira: `foreign KEY (category_id) references financial_categories (id) on delete set null`
- `accounts_payable_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `accounts_payable_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `accounts_payable_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `accounts_payable_department_id_fkey` — Chave estrangeira: `foreign KEY (department_id) references financial_departments (id) on delete set null`
- `accounts_payable_financial_transaction_id_fkey` — Chave estrangeira: `foreign KEY (financial_transaction_id) references financial_transactions (id) on delete set null`
- `accounts_payable_paid_by_fkey` — Chave estrangeira: `foreign KEY (paid_by) references profiles (id) on delete set null`
- `accounts_payable_payment_method_id_fkey` — Chave estrangeira: `foreign KEY (payment_method_id) references financial_payment_methods (id) on delete set null`
- `accounts_payable_cancelled_by_fkey` — Chave estrangeira: `foreign KEY (cancelled_by) references profiles (id) on delete set null`
- `accounts_payable_status_check` — Validação: `check ( ( status = any ( array[ 'PENDING'::text, 'PAID'::text, 'OVERDUE'::text, 'CANCELLED'::text ] ) ) )`
- `accounts_payable_paid_check` — Validação: `check ( ( ( (status = 'PAID'::text) and (paid_at is not null) ) or (status <> 'PAID'::text) ) )`
- `accounts_payable_amount_check` — Validação: `check ((amount >= (0)::numeric))`

**Índices cadastrados:**

- `accounts_payable_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `accounts_payable_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `accounts_payable_department_id_idx` — índice, método `btree`, expressão/colunas: `(department_id)`
- `accounts_payable_category_id_idx` — índice, método `btree`, expressão/colunas: `(category_id)`
- `accounts_payable_cashbox_id_idx` — índice, método `btree`, expressão/colunas: `(cashbox_id)`
- `accounts_payable_payment_method_id_idx` — índice, método `btree`, expressão/colunas: `(payment_method_id)`
- `accounts_payable_financial_transaction_id_idx` — índice, método `btree`, expressão/colunas: `(financial_transaction_id)`
- `accounts_payable_number_idx` — índice, método `btree`, expressão/colunas: `(payable_number)`
- `accounts_payable_supplier_name_idx` — índice, método `btree`, expressão/colunas: `(supplier_name)`
- `accounts_payable_document_number_idx` — índice, método `btree`, expressão/colunas: `(document_number)`
- `accounts_payable_due_date_idx` — índice, método `btree`, expressão/colunas: `(due_date)`
- `accounts_payable_paid_at_idx` — índice, método `btree`, expressão/colunas: `(paid_at)`
- `accounts_payable_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `accounts_payable_has_attachment_idx` — índice, método `btree`, expressão/colunas: `(has_attachment)`
- `accounts_payable_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `accounts_payable_paid_by_idx` — índice, método `btree`, expressão/colunas: `(paid_by)`
- `accounts_payable_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `accounts_payable_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`
- `accounts_payable_number_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, payable_number) where ( (payable_number is not null) and (payable_number <> ''::text) and (deleted_at is null) )`

**Triggers:**

- `set_accounts_payable_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

# Entrega de relatório financeiro

## `report_delivery_rules`

**Finalidade:** Regras flexíveis da entrega mensal de relatório por igreja ou congregação, como repasse, prebenda, seguro e contador.

**Exemplo de cadastro:** Regra “Repasse Catedral”, percentual de 30% sobre total de entradas, válida para todas ou uma congregação.

**Total de campos:** 29

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `congregation_id` | `uuid` | Não | `` | Congregação vinculada ao registro. |
| `category_id` | `uuid` | Não | `` | Categoria financeira vinculada ao registro. |
| `name` | `text` | Sim | `` | Nome principal do registro. |
| `code` | `text` | Não | `` | Código interno opcional para busca, relatórios ou integração. |
| `description` | `text` | Não | `` | Descrição detalhada do registro. |
| `rule_type` | `text` | Sim | `PERCENTAGE` | Tipo da regra: percentual, valor fixo ou valor manual. |
| `rule_nature` | `text` | Sim | `OTHER` | Natureza da regra: repasse, prebenda, desconto, contribuição ou outro. |
| `calculation_base` | `text` | Sim | `TOTAL_INCOME` | Base usada para cálculo da regra. |
| `percentage_value` | `numeric(8, 4)` | Não | `` | Percentual aplicado na regra. |
| `fixed_amount` | `numeric(12, 2)` | Não | `` | Valor fixo aplicado na regra. |
| `applies_to_central_church` | `boolean` | Sim | `true` | Indica se a regra se aplica à Catedral/igreja central. |
| `applies_to_congregation` | `boolean` | Sim | `true` | Indica se a regra afeta a congregação. |
| `affects_pastoral_prebend` | `boolean` | Sim | `false` | Indica se a regra compõe/afeta a prebenda pastoral. |
| `deducts_from_pastoral_prebend` | `boolean` | Sim | `false` | Indica se a regra desconta da prebenda pastoral. |
| `generate_central_income` | `boolean` | Sim | `false` | Indica se o item pode gerar entrada para a Catedral. |
| `generate_congregation_expense` | `boolean` | Sim | `false` | Indica se o item pode gerar saída para a congregação. |
| `is_required` | `boolean` | Sim | `true` | Indica se o item/regra é obrigatório. |
| `is_default` | `boolean` | Sim | `false` | Indica se o registro é o padrão. |
| `sort_order` | `integer` | Sim | `0` | Ordem de exibição nas telas e relatórios. |
| `effective_from` | `date` | Sim | `CURRENT_DATE` | Data inicial de vigência da regra. |
| `effective_until` | `date` | Não | `` | Data final de vigência da regra. |
| `status` | `text` | Sim | `ACTIVE` | Status atual do registro. |
| `metadata` | `jsonb` | Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `report_delivery_rules_pkey` — Chave primária: `primary key (id)`
- `report_delivery_rules_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `report_delivery_rules_category_id_fkey` — Chave estrangeira: `foreign KEY (category_id) references financial_categories (id) on delete set null`
- `report_delivery_rules_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `report_delivery_rules_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete set null`
- `report_delivery_rules_status_check` — Validação: `check ( ( status = any (array['ACTIVE'::text, 'INACTIVE'::text]) ) )`
- `report_delivery_rules_type_check` — Validação: `check ( ( rule_type = any ( array[ 'PERCENTAGE'::text, 'FIXED_AMOUNT'::text, 'MANUAL_AMOUNT'::text ] ) ) )`
- `report_delivery_rules_calculation_base_check` — Validação: `check ( ( calculation_base = any ( array[ 'TOTAL_INCOME'::text, 'PASTORAL_PREBEND'::text, 'MANUAL'::text, 'NONE'::text ] ) ) )`
- `report_delivery_rules_value_check` — Validação: `check ( ( ( (rule_type = 'PERCENTAGE'::text) and (percentage_value is not null) ) or ( (rule_type = 'FIXED_AMOUNT'::text) and (fixed_amount is not null) ) or (rule_type = 'MANUAL_AMOUNT'::text) ) )`
- `report_delivery_rules_effective_dates_check` — Validação: `check ( ( (effective_until is null) or (effective_until >= effective_from) ) )`
- `report_delivery_rules_fixed_amount_check` — Validação: `check ( ( (fixed_amount is null) or (fixed_amount >= (0)::numeric) ) )`
- `report_delivery_rules_nature_check` — Validação: `check ( ( rule_nature = any ( array[ 'TRANSFER'::text, 'PASTORAL_PAYMENT'::text, 'DEDUCTION'::text, 'CONTRIBUTION'::text, 'OTHER'::text ] ) ) )`
- `report_delivery_rules_percentage_check` — Validação: `check ( ( (percentage_value is null) or ( (percentage_value >= (0)::numeric) and (percentage_value <= (100)::numeric) ) ) )`

**Índices cadastrados:**

- `report_delivery_rules_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `report_delivery_rules_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `report_delivery_rules_category_id_idx` — índice, método `btree`, expressão/colunas: `(category_id)`
- `report_delivery_rules_name_idx` — índice, método `btree`, expressão/colunas: `(name)`
- `report_delivery_rules_code_idx` — índice, método `btree`, expressão/colunas: `(code)`
- `report_delivery_rules_type_idx` — índice, método `btree`, expressão/colunas: `(rule_type)`
- `report_delivery_rules_nature_idx` — índice, método `btree`, expressão/colunas: `(rule_nature)`
- `report_delivery_rules_calculation_base_idx` — índice, método `btree`, expressão/colunas: `(calculation_base)`
- `report_delivery_rules_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `report_delivery_rules_sort_order_idx` — índice, método `btree`, expressão/colunas: `(sort_order)`
- `report_delivery_rules_effective_dates_idx` — índice, método `btree`, expressão/colunas: `(effective_from, effective_until)`
- `report_delivery_rules_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `report_delivery_rules_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `report_delivery_rules_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`
- `report_delivery_rules_unique_idx` — único, método `btree`, expressão/colunas: `( church_id, COALESCE( congregation_id, '00000000-0000-0000-0000-000000000000'::uuid ), lower(name), effective_from ) where (deleted_at is null)`
- `report_delivery_rules_code_unique_idx` — único, método `btree`, expressão/colunas: `( church_id, COALESCE( congregation_id, '00000000-0000-0000-0000-000000000000'::uuid ), lower(code) ) where ( (code is not null) and (code <> ''::text) and (deleted_at is null) )`

**Triggers:**

- `set_report_delivery_rules_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `report_deliveries`

**Finalidade:** Cabeçalho da entrega mensal de relatório financeiro de uma congregação, com período, totais e status.

**Exemplo de cadastro:** Entrega de relatório de Junho/2026 da Vila Planaltina, com total de entradas e status `CALCULATED`.

**Total de campos:** 31

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `congregation_id` | `uuid` | Sim | `` | Congregação vinculada ao registro. |
| `reference_month` | `integer` | Sim | `` | Mês de referência do lançamento ou relatório. |
| `reference_year` | `integer` | Sim | `` | Ano de referência do lançamento ou relatório. |
| `period_start` | `date` | Sim | `` | Data inicial do período do relatório. |
| `period_end` | `date` | Sim | `` | Data final do período do relatório. |
| `delivery_number` | `text` | Não | `` | Número/código da entrega de relatório. |
| `calculation_mode` | `text` | Sim | `AUTO` | Modo de cálculo: automático, manual ou misto. |
| `total_income` | `numeric(12, 2)` | Sim | `0` | Total de entradas consideradas na entrega. |
| `total_expense` | `numeric(12, 2)` | Sim | `0` | Total de saídas comuns consideradas na entrega. |
| `gross_amount` | `numeric(12, 2)` | Sim | `0` | Base bruta usada nos cálculos da entrega. |
| `total_central_income` | `numeric(12, 2)` | Sim | `0` | Total que deve ser reconhecido como entrada para a Catedral. |
| `total_congregation_expense` | `numeric(12, 2)` | Sim | `0` | Total que deve ser reconhecido como saída da congregação. |
| `pastoral_prebend_amount` | `numeric(12, 2)` | Sim | `0` | Valor bruto calculado para a prebenda pastoral. |
| `pastoral_prebend_tithe_amount` | `numeric(12, 2)` | Sim | `0` | Valor do dízimo calculado sobre a prebenda. |
| `net_pastoral_prebend_amount` | `numeric(12, 2)` | Sim | `0` | Valor líquido da prebenda após descontos. |
| `net_congregation_amount` | `numeric(12, 2)` | Sim | `0` | Valor líquido restante da congregação após cálculos. |
| `status` | `text` | Sim | `DRAFT` | Status atual do registro. |
| `delivered_at` | `timestamp with time zone` | Não | `` | Data/hora em que a entrega foi realizada. |
| `delivered_by` | `uuid` | Não | `` | Usuário que realizou a entrega. |
| `reviewed_at` | `timestamp with time zone` | Não | `` | Data/hora da conferência. |
| `reviewed_by` | `uuid` | Não | `` | Usuário que conferiu a entrega. |
| `finalized_at` | `timestamp with time zone` | Não | `` | Data/hora da finalização. |
| `finalized_by` | `uuid` | Não | `` | Usuário que finalizou a entrega. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `metadata` | `jsonb` | Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `report_deliveries_pkey` — Chave primária: `primary key (id)`
- `report_deliveries_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete RESTRICT`
- `report_deliveries_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `report_deliveries_reviewed_by_fkey` — Chave estrangeira: `foreign KEY (reviewed_by) references profiles (id) on delete set null`
- `report_deliveries_delivered_by_fkey` — Chave estrangeira: `foreign KEY (delivered_by) references profiles (id) on delete set null`
- `report_deliveries_finalized_by_fkey` — Chave estrangeira: `foreign KEY (finalized_by) references profiles (id) on delete set null`
- `report_deliveries_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `report_deliveries_status_check` — Validação: `check ( ( status = any ( array[ 'DRAFT'::text, 'CALCULATED'::text, 'DELIVERED'::text, 'REVIEWED'::text, 'FINALIZED'::text, 'CANCELLED'::text ] ) ) )`
- `report_deliveries_calculation_mode_check` — Validação: `check ( ( calculation_mode = any ( array['AUTO'::text, 'MANUAL'::text, 'MIXED'::text] ) ) )`
- `report_deliveries_period_check` — Validação: `check ((period_end >= period_start))`
- `report_deliveries_reference_month_check` — Validação: `check ( ( (reference_month >= 1) and (reference_month <= 12) ) )`
- `report_deliveries_reference_year_check` — Validação: `check ((reference_year >= 2000))`
- `report_deliveries_amounts_check` — Validação: `check ( ( (total_income >= (0)::numeric) and (total_expense >= (0)::numeric) and (gross_amount >= (0)::numeric) and (total_central_income >= (0)::numeric) and (total_congregation_expense >= (0)::numeric) and (pastoral...`

**Índices cadastrados:**

- `report_deliveries_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `report_deliveries_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `report_deliveries_reference_month_year_idx` — índice, método `btree`, expressão/colunas: `(reference_year, reference_month)`
- `report_deliveries_period_idx` — índice, método `btree`, expressão/colunas: `(period_start, period_end)`
- `report_deliveries_delivery_number_idx` — índice, método `btree`, expressão/colunas: `(delivery_number)`
- `report_deliveries_calculation_mode_idx` — índice, método `btree`, expressão/colunas: `(calculation_mode)`
- `report_deliveries_status_idx` — índice, método `btree`, expressão/colunas: `(status)`
- `report_deliveries_delivered_at_idx` — índice, método `btree`, expressão/colunas: `(delivered_at)`
- `report_deliveries_reviewed_at_idx` — índice, método `btree`, expressão/colunas: `(reviewed_at)`
- `report_deliveries_finalized_at_idx` — índice, método `btree`, expressão/colunas: `(finalized_at)`
- `report_deliveries_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `report_deliveries_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `report_deliveries_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`
- `report_deliveries_unique_month_idx` — único, método `btree`, expressão/colunas: `( church_id, congregation_id, reference_year, reference_month ) where ( (deleted_at is null) and (status <> 'CANCELLED'::text) )`
- `report_deliveries_number_unique_idx` — único, método `btree`, expressão/colunas: `(church_id, delivery_number) where ( (delivery_number is not null) and (delivery_number <> ''::text) and (deleted_at is null) )`

**Triggers:**

- `set_report_deliveries_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

## `report_delivery_items`

**Finalidade:** Itens calculados dentro de uma entrega de relatório, salvando o snapshot da regra, base, percentual/valor e resultado calculado.

**Exemplo de cadastro:** Item “Repasse Catedral”: base R$ 10.000,00, percentual 30%, calculado R$ 3.000,00.

**Total de campos:** 32

| Campo | Tipo | Obrigatório | Padrão/Gerado | O que faz |
|---|---|---:|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | Identificador único do registro. |
| `church_id` | `uuid` | Sim | `` | Igreja/campo ao qual o registro pertence. |
| `congregation_id` | `uuid` | Sim | `` | Congregação vinculada ao registro. |
| `report_delivery_id` | `uuid` | Sim | `` | Entrega de relatório vinculada ao item. |
| `report_delivery_rule_id` | `uuid` | Não | `` | Regra original usada para gerar o item. |
| `category_id` | `uuid` | Não | `` | Categoria financeira vinculada ao registro. |
| `rule_name` | `text` | Sim | `` | Nome da regra salvo no momento do cálculo. |
| `rule_code` | `text` | Não | `` | Código da regra salvo no momento do cálculo. |
| `rule_description` | `text` | Não | `` | Descrição da regra salva no momento do cálculo. |
| `rule_type` | `text` | Sim | `` | Tipo da regra: percentual, valor fixo ou valor manual. |
| `rule_nature` | `text` | Sim | `` | Natureza da regra: repasse, prebenda, desconto, contribuição ou outro. |
| `calculation_base` | `text` | Sim | `` | Base usada para cálculo da regra. |
| `base_amount` | `numeric(12, 2)` | Sim | `0` | Valor base usado para calcular o item. |
| `percentage_value` | `numeric(8, 4)` | Não | `` | Percentual aplicado na regra. |
| `fixed_amount` | `numeric(12, 2)` | Não | `` | Valor fixo aplicado na regra. |
| `manual_amount` | `numeric(12, 2)` | Não | `` | Valor manual informado no momento do cálculo. |
| `calculated_amount` | `numeric(12, 2)` | Sim | `0` | Valor final calculado para o item. |
| `applies_to_central_church` | `boolean` | Sim | `true` | Indica se a regra se aplica à Catedral/igreja central. |
| `applies_to_congregation` | `boolean` | Sim | `true` | Indica se a regra afeta a congregação. |
| `affects_pastoral_prebend` | `boolean` | Sim | `false` | Indica se a regra compõe/afeta a prebenda pastoral. |
| `deducts_from_pastoral_prebend` | `boolean` | Sim | `false` | Indica se a regra desconta da prebenda pastoral. |
| `generate_central_income` | `boolean` | Sim | `false` | Indica se o item pode gerar entrada para a Catedral. |
| `generate_congregation_expense` | `boolean` | Sim | `false` | Indica se o item pode gerar saída para a congregação. |
| `central_transaction_id` | `uuid` | Não | `` | Transação financeira gerada para a Catedral, quando houver. |
| `congregation_transaction_id` | `uuid` | Não | `` | Transação financeira gerada para a congregação, quando houver. |
| `sort_order` | `integer` | Sim | `0` | Ordem de exibição nas telas e relatórios. |
| `notes` | `text` | Não | `` | Observações gerais. |
| `metadata` | `jsonb` | Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis. |
| `created_by` | `uuid` | Não | `` | Usuário que criou o registro. |
| `created_at` | `timestamp with time zone` | Sim | `now()` | Data/hora de criação do registro. |
| `updated_at` | `timestamp with time zone` | Sim | `now()` | Data/hora da última atualização. |
| `deleted_at` | `timestamp with time zone` | Não | `` | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

**Restrições principais:**

- `report_delivery_items_pkey` — Chave primária: `primary key (id)`
- `report_delivery_items_report_delivery_id_fkey` — Chave estrangeira: `foreign KEY (report_delivery_id) references report_deliveries (id) on delete CASCADE`
- `report_delivery_items_report_delivery_rule_id_fkey` — Chave estrangeira: `foreign KEY (report_delivery_rule_id) references report_delivery_rules (id) on delete set null`
- `report_delivery_items_central_transaction_id_fkey` — Chave estrangeira: `foreign KEY (central_transaction_id) references financial_transactions (id) on delete set null`
- `report_delivery_items_church_id_fkey` — Chave estrangeira: `foreign KEY (church_id) references churches (id) on delete RESTRICT`
- `report_delivery_items_congregation_id_fkey` — Chave estrangeira: `foreign KEY (congregation_id) references congregations (id) on delete RESTRICT`
- `report_delivery_items_congregation_transaction_id_fkey` — Chave estrangeira: `foreign KEY (congregation_transaction_id) references financial_transactions (id) on delete set null`
- `report_delivery_items_created_by_fkey` — Chave estrangeira: `foreign KEY (created_by) references profiles (id) on delete set null`
- `report_delivery_items_category_id_fkey` — Chave estrangeira: `foreign KEY (category_id) references financial_categories (id) on delete set null`
- `report_delivery_items_value_check` — Validação: `check ( ( ( (rule_type = 'PERCENTAGE'::text) and (percentage_value is not null) ) or ( (rule_type = 'FIXED_AMOUNT'::text) and (fixed_amount is not null) ) or (rule_type = 'MANUAL_AMOUNT'::text) ) )`
- `report_delivery_items_calculation_base_check` — Validação: `check ( ( calculation_base = any ( array[ 'TOTAL_INCOME'::text, 'PASTORAL_PREBEND'::text, 'MANUAL'::text, 'NONE'::text ] ) ) )`
- `report_delivery_items_nature_check` — Validação: `check ( ( rule_nature = any ( array[ 'TRANSFER'::text, 'PASTORAL_PAYMENT'::text, 'DEDUCTION'::text, 'CONTRIBUTION'::text, 'OTHER'::text ] ) ) )`
- `report_delivery_items_type_check` — Validação: `check ( ( rule_type = any ( array[ 'PERCENTAGE'::text, 'FIXED_AMOUNT'::text, 'MANUAL_AMOUNT'::text ] ) ) )`
- `report_delivery_items_amounts_check` — Validação: `check ( ( (base_amount >= (0)::numeric) and (calculated_amount >= (0)::numeric) and ( (percentage_value is null) or ( (percentage_value >= (0)::numeric) and (percentage_value <= (100)::numeric) ) ) and ( (fixed_amount...`

**Índices cadastrados:**

- `report_delivery_items_church_id_idx` — índice, método `btree`, expressão/colunas: `(church_id)`
- `report_delivery_items_congregation_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_id)`
- `report_delivery_items_delivery_id_idx` — índice, método `btree`, expressão/colunas: `(report_delivery_id)`
- `report_delivery_items_rule_id_idx` — índice, método `btree`, expressão/colunas: `(report_delivery_rule_id)`
- `report_delivery_items_category_id_idx` — índice, método `btree`, expressão/colunas: `(category_id)`
- `report_delivery_items_rule_code_idx` — índice, método `btree`, expressão/colunas: `(rule_code)`
- `report_delivery_items_rule_type_idx` — índice, método `btree`, expressão/colunas: `(rule_type)`
- `report_delivery_items_rule_nature_idx` — índice, método `btree`, expressão/colunas: `(rule_nature)`
- `report_delivery_items_calculation_base_idx` — índice, método `btree`, expressão/colunas: `(calculation_base)`
- `report_delivery_items_central_transaction_id_idx` — índice, método `btree`, expressão/colunas: `(central_transaction_id)`
- `report_delivery_items_congregation_transaction_id_idx` — índice, método `btree`, expressão/colunas: `(congregation_transaction_id)`
- `report_delivery_items_sort_order_idx` — índice, método `btree`, expressão/colunas: `(sort_order)`
- `report_delivery_items_created_by_idx` — índice, método `btree`, expressão/colunas: `(created_by)`
- `report_delivery_items_deleted_at_idx` — índice, método `btree`, expressão/colunas: `(deleted_at)`
- `report_delivery_items_metadata_gin_idx` — índice, método `gin`, expressão/colunas: `(metadata)`
- `report_delivery_items_unique_idx` — único, método `btree`, expressão/colunas: `(report_delivery_id, lower(rule_name)) where (deleted_at is null)`

**Triggers:**

- `set_report_delivery_items_updated_at` — executa `set_updated_at()` antes de atualizações, normalmente para manter `updated_at` atualizado.

---

# Conferência final

Esta seção resume a quantidade de campos documentados por tabela para facilitar revisão rápida.

| Tabela | Campos documentados |
|---|---:|
| `accounts_payable` | 28 |
| `app_settings` | 27 |
| `audit_logs` | 17 |
| `churches` | 23 |
| `congregations` | 23 |
| `event_checkins` | 16 |
| `event_congregation_quotas` | 10 |
| `event_documents` | 23 |
| `event_groups` | 21 |
| `event_items` | 21 |
| `event_payments` | 25 |
| `event_registration_items` | 18 |
| `event_registrations` | 32 |
| `events` | 43 |
| `financial_cashboxes` | 20 |
| `financial_categories` | 21 |
| `financial_departments` | 14 |
| `financial_documents` | 23 |
| `financial_payment_methods` | 15 |
| `financial_receipts` | 25 |
| `financial_transactions` | 35 |
| `member_documents` | 18 |
| `member_history` | 15 |
| `member_ministries` | 15 |
| `member_roles` | 14 |
| `members` | 62 |
| `ministries` | 12 |
| `permissions` | 11 |
| `profiles` | 16 |
| `regions` | 10 |
| `report_deliveries` | 31 |
| `report_delivery_items` | 32 |
| `report_delivery_rules` | 29 |
| `role_permissions` | 7 |
| `roles` | 12 |
| `user_church_access` | 17 |

## Observações importantes

- Campos `deleted_at` indicam exclusão lógica; registros não precisam ser apagados fisicamente.
- Campos `metadata`, `settings` e similares guardam dados flexíveis em JSON para evolução futura sem quebrar a estrutura principal.
- Índices `unique` com `where deleted_at is null` permitem reaproveitar nomes/códigos quando registros antigos forem excluídos logicamente.
- Triggers `set_*_updated_at` usam a função `set_updated_at()` para atualizar automaticamente o campo `updated_at`.