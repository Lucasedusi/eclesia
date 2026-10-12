# Financeiro

## `financial_departments`

**Finalidade:** Departamentos financeiros cadastráveis, como Tesouraria, Construção, Missões, Eventos ou Administrativo.

**Exemplo de cadastro:** Departamento “Tesouraria”, tipo `TREASURY`, padrão para lançamentos financeiros.

**Total de campos:** 14

| Campo             | Tipo                       | Obrigatório | Padrão/Gerado       | O que faz                                                                            |
| ----------------- | -------------------------- | ----------: | ------------------- | ------------------------------------------------------------------------------------ |
| `id`              | `uuid`                     |         Sim | `gen_random_uuid()` | Identificador único do registro.                                                     |
| `church_id`       | `uuid`                     |         Sim | ``                  | Igreja/campo ao qual o registro pertence.                                            |
| `congregation_id` | `uuid`                     |         Não | ``                  | Congregação vinculada ao registro.                                                   |
| `name`            | `text`                     |         Sim | ``                  | Nome principal do registro.                                                          |
| `code`            | `text`                     |         Não | ``                  | Código interno opcional para busca, relatórios ou integração.                        |
| `description`     | `text`                     |         Não | ``                  | Descrição detalhada do registro.                                                     |
| `department_type` | `text`                     |         Sim | `OTHER`             | Tipo do departamento financeiro.                                                     |
| `is_default`      | `boolean`                  |         Sim | `false`             | Indica se o registro é o padrão.                                                     |
| `sort_order`      | `integer`                  |         Sim | `0`                 | Ordem de exibição nas telas e relatórios.                                            |
| `status`          | `text`                     |         Sim | `ACTIVE`            | Status atual do registro.                                                            |
| `created_by`      | `uuid`                     |         Não | ``                  | Usuário que criou o registro.                                                        |
| `created_at`      | `timestamp with time zone` |         Sim | `now()`             | Data/hora de criação do registro.                                                    |
| `updated_at`      | `timestamp with time zone` |         Sim | `now()`             | Data/hora da última atualização.                                                     |
| `deleted_at`      | `timestamp with time zone` |         Não | ``                  | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

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

| Campo             | Tipo                       | Obrigatório | Padrão/Gerado       | O que faz                                                                            |
| ----------------- | -------------------------- | ----------: | ------------------- | ------------------------------------------------------------------------------------ |
| `id`              | `uuid`                     |         Sim | `gen_random_uuid()` | Identificador único do registro.                                                     |
| `church_id`       | `uuid`                     |         Sim | ``                  | Igreja/campo ao qual o registro pertence.                                            |
| `congregation_id` | `uuid`                     |         Não | ``                  | Congregação vinculada ao registro.                                                   |
| `name`            | `text`                     |         Sim | ``                  | Nome principal do registro.                                                          |
| `code`            | `text`                     |         Não | ``                  | Código interno opcional para busca, relatórios ou integração.                        |
| `description`     | `text`                     |         Não | ``                  | Descrição detalhada do registro.                                                     |
| `cashbox_type`    | `text`                     |         Sim | `OTHER`             | Tipo do caixa financeiro.                                                            |
| `bank_name`       | `text`                     |         Não | ``                  | Nome do banco.                                                                       |
| `agency`          | `text`                     |         Não | ``                  | Agência bancária.                                                                    |
| `account_number`  | `text`                     |         Não | ``                  | Número da conta bancária.                                                            |
| `pix_key`         | `text`                     |         Não | ``                  | Chave Pix vinculada ao caixa/conta.                                                  |
| `opening_balance` | `numeric(12, 2)`           |         Sim | `0`                 | Saldo inicial informado para o caixa.                                                |
| `current_balance` | `numeric(12, 2)`           |         Sim | `0`                 | Saldo atual registrado/informativo do caixa.                                         |
| `is_default`      | `boolean`                  |         Sim | `false`             | Indica se o registro é o padrão.                                                     |
| `sort_order`      | `integer`                  |         Sim | `0`                 | Ordem de exibição nas telas e relatórios.                                            |
| `status`          | `text`                     |         Sim | `ACTIVE`            | Status atual do registro.                                                            |
| `created_by`      | `uuid`                     |         Não | ``                  | Usuário que criou o registro.                                                        |
| `created_at`      | `timestamp with time zone` |         Sim | `now()`             | Data/hora de criação do registro.                                                    |
| `updated_at`      | `timestamp with time zone` |         Sim | `now()`             | Data/hora da última atualização.                                                     |
| `deleted_at`      | `timestamp with time zone` |         Não | ``                  | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

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

| Campo                     | Tipo                       | Obrigatório | Padrão/Gerado       | O que faz                                                                            |
| ------------------------- | -------------------------- | ----------: | ------------------- | ------------------------------------------------------------------------------------ |
| `id`                      | `uuid`                     |         Sim | `gen_random_uuid()` | Identificador único do registro.                                                     |
| `church_id`               | `uuid`                     |         Sim | ``                  | Igreja/campo ao qual o registro pertence.                                            |
| `name`                    | `text`                     |         Sim | ``                  | Nome principal do registro.                                                          |
| `code`                    | `text`                     |         Não | ``                  | Código interno opcional para busca, relatórios ou integração.                        |
| `description`             | `text`                     |         Não | ``                  | Descrição detalhada do registro.                                                     |
| `method_type`             | `text`                     |         Sim | `OTHER`             | Tipo da forma de pagamento.                                                          |
| `requires_reference`      | `boolean`                  |         Sim | `false`             | Indica se a forma exige referência/código de transação.                              |
| `requires_receipt_upload` | `boolean`                  |         Sim | `false`             | Indica se normalmente exige upload de comprovante.                                   |
| `is_default`              | `boolean`                  |         Sim | `false`             | Indica se o registro é o padrão.                                                     |
| `sort_order`              | `integer`                  |         Sim | `0`                 | Ordem de exibição nas telas e relatórios.                                            |
| `status`                  | `text`                     |         Sim | `ACTIVE`            | Status atual do registro.                                                            |
| `created_by`              | `uuid`                     |         Não | ``                  | Usuário que criou o registro.                                                        |
| `created_at`              | `timestamp with time zone` |         Sim | `now()`             | Data/hora de criação do registro.                                                    |
| `updated_at`              | `timestamp with time zone` |         Sim | `now()`             | Data/hora da última atualização.                                                     |
| `deleted_at`              | `timestamp with time zone` |         Não | ``                  | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

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

| Campo                     | Tipo                       | Obrigatório | Padrão/Gerado       | O que faz                                                                            |
| ------------------------- | -------------------------- | ----------: | ------------------- | ------------------------------------------------------------------------------------ |
| `id`                      | `uuid`                     |         Sim | `gen_random_uuid()` | Identificador único do registro.                                                     |
| `church_id`               | `uuid`                     |         Sim | ``                  | Igreja/campo ao qual o registro pertence.                                            |
| `department_id`           | `uuid`                     |         Não | ``                  | Departamento financeiro vinculado ao registro.                                       |
| `parent_id`               | `uuid`                     |         Não | ``                  | Identificador/vínculo com parent relacionado ao registro.                            |
| `name`                    | `text`                     |         Sim | ``                  | Nome principal do registro.                                                          |
| `code`                    | `text`                     |         Não | ``                  | Código interno opcional para busca, relatórios ou integração.                        |
| `description`             | `text`                     |         Não | ``                  | Descrição detalhada do registro.                                                     |
| `category_type`           | `text`                     |         Sim | `INCOME`            | Define se a categoria é de entrada, saída ou ambos.                                  |
| `category_group`          | `text`                     |         Sim | `OTHER`             | Grupo da categoria, como dízimo, oferta, construção, seguro ou relatório.            |
| `is_tithe`                | `boolean`                  |         Sim | `false`             | Indica se a categoria representa dízimo.                                             |
| `is_offering`             | `boolean`                  |         Sim | `false`             | Indica se a categoria representa oferta.                                             |
| `is_report_delivery_item` | `boolean`                  |         Sim | `false`             | Indica se a categoria é usada na entrega de relatório.                               |
| `requires_member`         | `boolean`                  |         Sim | `false`             | Indica se o lançamento deve pedir membro/pessoa.                                     |
| `generate_receipt`        | `boolean`                  |         Sim | `false`             | Indica se deve gerar recibo automaticamente.                                         |
| `is_default`              | `boolean`                  |         Sim | `false`             | Indica se o registro é o padrão.                                                     |
| `sort_order`              | `integer`                  |         Sim | `0`                 | Ordem de exibição nas telas e relatórios.                                            |
| `status`                  | `text`                     |         Sim | `ACTIVE`            | Status atual do registro.                                                            |
| `created_by`              | `uuid`                     |         Não | ``                  | Usuário que criou o registro.                                                        |
| `created_at`              | `timestamp with time zone` |         Sim | `now()`             | Data/hora de criação do registro.                                                    |
| `updated_at`              | `timestamp with time zone` |         Sim | `now()`             | Data/hora da última atualização.                                                     |
| `deleted_at`              | `timestamp with time zone` |         Não | ``                  | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

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

| Campo                    | Tipo                       | Obrigatório | Padrão/Gerado             | O que faz                                                                            |
| ------------------------ | -------------------------- | ----------: | ------------------------- | ------------------------------------------------------------------------------------ |
| `id`                     | `uuid`                     |         Sim | `gen_random_uuid()`       | Identificador único do registro.                                                     |
| `church_id`              | `uuid`                     |         Sim | ``                        | Igreja/campo ao qual o registro pertence.                                            |
| `congregation_id`        | `uuid`                     |         Não | ``                        | Congregação vinculada ao registro.                                                   |
| `member_id`              | `uuid`                     |         Não | ``                        | Membro vinculado ao registro.                                                        |
| `department_id`          | `uuid`                     |         Não | ``                        | Departamento financeiro vinculado ao registro.                                       |
| `cashbox_id`             | `uuid`                     |         Não | ``                        | Caixa financeiro vinculado ao registro.                                              |
| `payment_method_id`      | `uuid`                     |         Não | ``                        | Forma de pagamento vinculada ao registro.                                            |
| `category_id`            | `uuid`                     |         Sim | ``                        | Categoria financeira vinculada ao registro.                                          |
| `transaction_type`       | `text`                     |         Sim | ``                        | Tipo do lançamento: entrada ou saída.                                                |
| `source_type`            | `text`                     |         Sim | `MANUAL`                  | Origem do lançamento: manual, evento, entrega de relatório, contas a pagar etc.      |
| `transaction_number`     | `text`                     |         Não | ``                        | Número/código interno da transação.                                                  |
| `document_number`        | `text`                     |         Não | ``                        | Número de documento, nota, recibo físico ou referência manual.                       |
| `person_name`            | `text`                     |         Não | ``                        | Nome da pessoa relacionada ao lançamento, mesmo quando não há cadastro.              |
| `is_unregistered_person` | `boolean`                  |         Sim | `false`                   | Indica que a pessoa informada não possui cadastro de membro.                         |
| `description`            | `text`                     |         Não | ``                        | Descrição detalhada do registro.                                                     |
| `amount`                 | `numeric(12, 2)`           |         Sim | `0`                       | Valor financeiro do registro.                                                        |
| `transaction_date`       | `date`                     |         Sim | `CURRENT_DATE`            | Data da transação financeira.                                                        |
| `reference_month`        | `integer`                  |         Não | ``                        | Mês de referência do lançamento ou relatório.                                        |
| `reference_year`         | `integer`                  |         Não | ``                        | Ano de referência do lançamento ou relatório.                                        |
| `payment_reference`      | `text`                     |         Não | ``                        | Referência de pagamento, como ID Pix, autorização de cartão ou código bancário.      |
| `has_attachment`         | `boolean`                  |         Sim | `false`                   | Indica se existe anexo/comprovante vinculado.                                        |
| `generate_receipt`       | `boolean`                  |         Sim | `false`                   | Indica se deve gerar recibo automaticamente.                                         |
| `receipt_printed`        | `boolean`                  |         Sim | `false`                   | Indica se o recibo já foi impresso.                                                  |
| `status`                 | `text`                     |         Sim | `CONFIRMED`               | Status atual do registro.                                                            |
| `notes`                  | `text`                     |         Não | ``                        | Observações gerais.                                                                  |
| `metadata`               | `jsonb`                    |         Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis.                     |
| `confirmed_by`           | `uuid`                     |         Não | ``                        | Usuário que confirmou o lançamento.                                                  |
| `confirmed_at`           | `timestamp with time zone` |         Não | ``                        | Data/hora de confirmação.                                                            |
| `cancelled_by`           | `uuid`                     |         Não | ``                        | Usuário que cancelou o registro.                                                     |
| `cancelled_at`           | `timestamp with time zone` |         Não | ``                        | Data/hora de cancelamento.                                                           |
| `cancel_reason`          | `text`                     |         Não | ``                        | Motivo do cancelamento.                                                              |
| `created_by`             | `uuid`                     |         Não | ``                        | Usuário que criou o registro.                                                        |
| `created_at`             | `timestamp with time zone` |         Sim | `now()`                   | Data/hora de criação do registro.                                                    |
| `updated_at`             | `timestamp with time zone` |         Sim | `now()`                   | Data/hora da última atualização.                                                     |
| `deleted_at`             | `timestamp with time zone` |         Não | ``                        | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

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

| Campo                      | Tipo                       | Obrigatório | Padrão/Gerado             | O que faz                                                                            |
| -------------------------- | -------------------------- | ----------: | ------------------------- | ------------------------------------------------------------------------------------ |
| `id`                       | `uuid`                     |         Sim | `gen_random_uuid()`       | Identificador único do registro.                                                     |
| `church_id`                | `uuid`                     |         Sim | ``                        | Igreja/campo ao qual o registro pertence.                                            |
| `congregation_id`          | `uuid`                     |         Não | ``                        | Congregação vinculada ao registro.                                                   |
| `financial_transaction_id` | `uuid`                     |         Sim | ``                        | Transação financeira vinculada ao registro.                                          |
| `receipt_number`           | `text`                     |         Sim | ``                        | Número/código do recibo.                                                             |
| `receipt_type`             | `text`                     |         Sim | `INCOME`                  | Tipo do recibo, como dízimo, oferta, entrada ou relatório.                           |
| `receipt_status`           | `text`                     |         Sim | `ISSUED`                  | Status do recibo.                                                                    |
| `receipt_title`            | `text`                     |         Não | ``                        | Título exibido no recibo.                                                            |
| `person_name`              | `text`                     |         Não | ``                        | Nome da pessoa relacionada ao lançamento, mesmo quando não há cadastro.              |
| `amount`                   | `numeric(12, 2)`           |         Sim | `0`                       | Valor financeiro do registro.                                                        |
| `issued_at`                | `timestamp with time zone` |         Sim | `now()`                   | Data/hora de emissão do recibo.                                                      |
| `printed_at`               | `timestamp with time zone` |         Não | ``                        | Data/hora de impressão do recibo.                                                    |
| `printed_by`               | `uuid`                     |         Não | ``                        | Usuário que imprimiu o recibo.                                                       |
| `print_count`              | `integer`                  |         Sim | `0`                       | Quantidade de vezes que o recibo foi impresso.                                       |
| `printer_name`             | `text`                     |         Não | ``                        | Nome da impressora usada.                                                            |
| `receipt_content`          | `text`                     |         Não | ``                        | Conteúdo textual do recibo.                                                          |
| `receipt_html`             | `text`                     |         Não | ``                        | Conteúdo HTML do recibo, quando usado.                                               |
| `metadata`                 | `jsonb`                    |         Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis.                     |
| `cancelled_by`             | `uuid`                     |         Não | ``                        | Usuário que cancelou o registro.                                                     |
| `cancelled_at`             | `timestamp with time zone` |         Não | ``                        | Data/hora de cancelamento.                                                           |
| `cancel_reason`            | `text`                     |         Não | ``                        | Motivo do cancelamento.                                                              |
| `created_by`               | `uuid`                     |         Não | ``                        | Usuário que criou o registro.                                                        |
| `created_at`               | `timestamp with time zone` |         Sim | `now()`                   | Data/hora de criação do registro.                                                    |
| `updated_at`               | `timestamp with time zone` |         Sim | `now()`                   | Data/hora da última atualização.                                                     |
| `deleted_at`               | `timestamp with time zone` |         Não | ``                        | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

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

| Campo                      | Tipo                       | Obrigatório | Padrão/Gerado             | O que faz                                                                            |
| -------------------------- | -------------------------- | ----------: | ------------------------- | ------------------------------------------------------------------------------------ |
| `id`                       | `uuid`                     |         Sim | `gen_random_uuid()`       | Identificador único do registro.                                                     |
| `church_id`                | `uuid`                     |         Sim | ``                        | Igreja/campo ao qual o registro pertence.                                            |
| `congregation_id`          | `uuid`                     |         Não | ``                        | Congregação vinculada ao registro.                                                   |
| `financial_transaction_id` | `uuid`                     |         Não | ``                        | Transação financeira vinculada ao registro.                                          |
| `financial_receipt_id`     | `uuid`                     |         Não | ``                        | Recibo financeiro vinculado ao registro.                                             |
| `document_type`            | `text`                     |         Sim | `OTHER`                   | Tipo do documento/anexo.                                                             |
| `title`                    | `text`                     |         Sim | ``                        | Título amigável do registro/documento.                                               |
| `description`              | `text`                     |         Não | ``                        | Descrição detalhada do registro.                                                     |
| `file_name`                | `text`                     |         Sim | ``                        | Nome original ou exibido do arquivo.                                                 |
| `file_url`                 | `text`                     |         Não | ``                        | URL pública/assinada do arquivo, quando houver.                                      |
| `storage_bucket`           | `text`                     |         Sim | `financial-documents`     | Bucket do Supabase Storage onde o arquivo está salvo.                                |
| `storage_path`             | `text`                     |         Sim | ``                        | Caminho do arquivo dentro do bucket.                                                 |
| `mime_type`                | `text`                     |         Não | ``                        | Tipo MIME do arquivo, como application/pdf ou image/png.                             |
| `file_size`                | `bigint`                   |         Não | ``                        | Tamanho do arquivo em bytes.                                                         |
| `is_sensitive`             | `boolean`                  |         Sim | `true`                    | Indica se o registro/documento deve ser tratado como sensível.                       |
| `status`                   | `text`                     |         Sim | `ACTIVE`                  | Status atual do registro.                                                            |
| `metadata`                 | `jsonb`                    |         Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis.                     |
| `uploaded_by`              | `uuid`                     |         Não | ``                        | Usuário que enviou o arquivo.                                                        |
| `uploaded_at`              | `timestamp with time zone` |         Sim | `now()`                   | Data/hora do upload.                                                                 |
| `created_at`               | `timestamp with time zone` |         Sim | `now()`                   | Data/hora de criação do registro.                                                    |
| `updated_at`               | `timestamp with time zone` |         Sim | `now()`                   | Data/hora da última atualização.                                                     |
| `deleted_at`               | `timestamp with time zone` |         Não | ``                        | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |
| `accounts_payable_id`      | `uuid`                     |         Não | ``                        | Conta a pagar vinculada ao documento.                                                |

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

| Campo                      | Tipo                       | Obrigatório | Padrão/Gerado             | O que faz                                                                            |
| -------------------------- | -------------------------- | ----------: | ------------------------- | ------------------------------------------------------------------------------------ |
| `id`                       | `uuid`                     |         Sim | `gen_random_uuid()`       | Identificador único do registro.                                                     |
| `church_id`                | `uuid`                     |         Sim | ``                        | Igreja/campo ao qual o registro pertence.                                            |
| `congregation_id`          | `uuid`                     |         Não | ``                        | Congregação vinculada ao registro.                                                   |
| `department_id`            | `uuid`                     |         Não | ``                        | Departamento financeiro vinculado ao registro.                                       |
| `category_id`              | `uuid`                     |         Não | ``                        | Categoria financeira vinculada ao registro.                                          |
| `cashbox_id`               | `uuid`                     |         Não | ``                        | Caixa financeiro vinculado ao registro.                                              |
| `payment_method_id`        | `uuid`                     |         Não | ``                        | Forma de pagamento vinculada ao registro.                                            |
| `financial_transaction_id` | `uuid`                     |         Não | ``                        | Transação financeira vinculada ao registro.                                          |
| `payable_number`           | `text`                     |         Não | ``                        | Número/código interno da conta a pagar.                                              |
| `description`              | `text`                     |         Sim | ``                        | Descrição detalhada do registro.                                                     |
| `supplier_name`            | `text`                     |         Não | ``                        | Fornecedor, prestador ou favorecido.                                                 |
| `document_number`          | `text`                     |         Não | ``                        | Número de documento, nota, recibo físico ou referência manual.                       |
| `amount`                   | `numeric(12, 2)`           |         Sim | `0`                       | Valor financeiro do registro.                                                        |
| `due_date`                 | `date`                     |         Sim | ``                        | Data de vencimento.                                                                  |
| `paid_at`                  | `timestamp with time zone` |         Não | ``                        | Data/hora em que o pagamento foi realizado.                                          |
| `status`                   | `text`                     |         Sim | `PENDING`                 | Status atual do registro.                                                            |
| `payment_reference`        | `text`                     |         Não | ``                        | Referência de pagamento, como ID Pix, autorização de cartão ou código bancário.      |
| `has_attachment`           | `boolean`                  |         Sim | `false`                   | Indica se existe anexo/comprovante vinculado.                                        |
| `notes`                    | `text`                     |         Não | ``                        | Observações gerais.                                                                  |
| `metadata`                 | `jsonb`                    |         Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis.                     |
| `created_by`               | `uuid`                     |         Não | ``                        | Usuário que criou o registro.                                                        |
| `paid_by`                  | `uuid`                     |         Não | ``                        | Usuário que marcou a conta como paga.                                                |
| `cancelled_by`             | `uuid`                     |         Não | ``                        | Usuário que cancelou o registro.                                                     |
| `cancelled_at`             | `timestamp with time zone` |         Não | ``                        | Data/hora de cancelamento.                                                           |
| `cancel_reason`            | `text`                     |         Não | ``                        | Motivo do cancelamento.                                                              |
| `created_at`               | `timestamp with time zone` |         Sim | `now()`                   | Data/hora de criação do registro.                                                    |
| `updated_at`               | `timestamp with time zone` |         Sim | `now()`                   | Data/hora da última atualização.                                                     |
| `deleted_at`               | `timestamp with time zone` |         Não | ``                        | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

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

| Campo                           | Tipo                       | Obrigatório | Padrão/Gerado             | O que faz                                                                            |
| ------------------------------- | -------------------------- | ----------: | ------------------------- | ------------------------------------------------------------------------------------ |
| `id`                            | `uuid`                     |         Sim | `gen_random_uuid()`       | Identificador único do registro.                                                     |
| `church_id`                     | `uuid`                     |         Sim | ``                        | Igreja/campo ao qual o registro pertence.                                            |
| `congregation_id`               | `uuid`                     |         Não | ``                        | Congregação vinculada ao registro.                                                   |
| `category_id`                   | `uuid`                     |         Não | ``                        | Categoria financeira vinculada ao registro.                                          |
| `name`                          | `text`                     |         Sim | ``                        | Nome principal do registro.                                                          |
| `code`                          | `text`                     |         Não | ``                        | Código interno opcional para busca, relatórios ou integração.                        |
| `description`                   | `text`                     |         Não | ``                        | Descrição detalhada do registro.                                                     |
| `rule_type`                     | `text`                     |         Sim | `PERCENTAGE`              | Tipo da regra: percentual, valor fixo ou valor manual.                               |
| `rule_nature`                   | `text`                     |         Sim | `OTHER`                   | Natureza da regra: repasse, prebenda, desconto, contribuição ou outro.               |
| `calculation_base`              | `text`                     |         Sim | `TOTAL_INCOME`            | Base usada para cálculo da regra.                                                    |
| `percentage_value`              | `numeric(8, 4)`            |         Não | ``                        | Percentual aplicado na regra.                                                        |
| `fixed_amount`                  | `numeric(12, 2)`           |         Não | ``                        | Valor fixo aplicado na regra.                                                        |
| `applies_to_central_church`     | `boolean`                  |         Sim | `true`                    | Indica se a regra se aplica à Catedral/igreja central.                               |
| `applies_to_congregation`       | `boolean`                  |         Sim | `true`                    | Indica se a regra afeta a congregação.                                               |
| `affects_pastoral_prebend`      | `boolean`                  |         Sim | `false`                   | Indica se a regra compõe/afeta a prebenda pastoral.                                  |
| `deducts_from_pastoral_prebend` | `boolean`                  |         Sim | `false`                   | Indica se a regra desconta da prebenda pastoral.                                     |
| `generate_central_income`       | `boolean`                  |         Sim | `false`                   | Indica se o item pode gerar entrada para a Catedral.                                 |
| `generate_congregation_expense` | `boolean`                  |         Sim | `false`                   | Indica se o item pode gerar saída para a congregação.                                |
| `is_required`                   | `boolean`                  |         Sim | `true`                    | Indica se o item/regra é obrigatório.                                                |
| `is_default`                    | `boolean`                  |         Sim | `false`                   | Indica se o registro é o padrão.                                                     |
| `sort_order`                    | `integer`                  |         Sim | `0`                       | Ordem de exibição nas telas e relatórios.                                            |
| `effective_from`                | `date`                     |         Sim | `CURRENT_DATE`            | Data inicial de vigência da regra.                                                   |
| `effective_until`               | `date`                     |         Não | ``                        | Data final de vigência da regra.                                                     |
| `status`                        | `text`                     |         Sim | `ACTIVE`                  | Status atual do registro.                                                            |
| `metadata`                      | `jsonb`                    |         Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis.                     |
| `created_by`                    | `uuid`                     |         Não | ``                        | Usuário que criou o registro.                                                        |
| `created_at`                    | `timestamp with time zone` |         Sim | `now()`                   | Data/hora de criação do registro.                                                    |
| `updated_at`                    | `timestamp with time zone` |         Sim | `now()`                   | Data/hora da última atualização.                                                     |
| `deleted_at`                    | `timestamp with time zone` |         Não | ``                        | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

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

| Campo                           | Tipo                       | Obrigatório | Padrão/Gerado             | O que faz                                                                            |
| ------------------------------- | -------------------------- | ----------: | ------------------------- | ------------------------------------------------------------------------------------ |
| `id`                            | `uuid`                     |         Sim | `gen_random_uuid()`       | Identificador único do registro.                                                     |
| `church_id`                     | `uuid`                     |         Sim | ``                        | Igreja/campo ao qual o registro pertence.                                            |
| `congregation_id`               | `uuid`                     |         Sim | ``                        | Congregação vinculada ao registro.                                                   |
| `reference_month`               | `integer`                  |         Sim | ``                        | Mês de referência do lançamento ou relatório.                                        |
| `reference_year`                | `integer`                  |         Sim | ``                        | Ano de referência do lançamento ou relatório.                                        |
| `period_start`                  | `date`                     |         Sim | ``                        | Data inicial do período do relatório.                                                |
| `period_end`                    | `date`                     |         Sim | ``                        | Data final do período do relatório.                                                  |
| `delivery_number`               | `text`                     |         Não | ``                        | Número/código da entrega de relatório.                                               |
| `calculation_mode`              | `text`                     |         Sim | `AUTO`                    | Modo de cálculo: automático, manual ou misto.                                        |
| `total_income`                  | `numeric(12, 2)`           |         Sim | `0`                       | Total de entradas consideradas na entrega.                                           |
| `total_expense`                 | `numeric(12, 2)`           |         Sim | `0`                       | Total de saídas comuns consideradas na entrega.                                      |
| `gross_amount`                  | `numeric(12, 2)`           |         Sim | `0`                       | Base bruta usada nos cálculos da entrega.                                            |
| `total_central_income`          | `numeric(12, 2)`           |         Sim | `0`                       | Total que deve ser reconhecido como entrada para a Catedral.                         |
| `total_congregation_expense`    | `numeric(12, 2)`           |         Sim | `0`                       | Total que deve ser reconhecido como saída da congregação.                            |
| `pastoral_prebend_amount`       | `numeric(12, 2)`           |         Sim | `0`                       | Valor bruto calculado para a prebenda pastoral.                                      |
| `pastoral_prebend_tithe_amount` | `numeric(12, 2)`           |         Sim | `0`                       | Valor do dízimo calculado sobre a prebenda.                                          |
| `net_pastoral_prebend_amount`   | `numeric(12, 2)`           |         Sim | `0`                       | Valor líquido da prebenda após descontos.                                            |
| `net_congregation_amount`       | `numeric(12, 2)`           |         Sim | `0`                       | Valor líquido restante da congregação após cálculos.                                 |
| `status`                        | `text`                     |         Sim | `DRAFT`                   | Status atual do registro.                                                            |
| `delivered_at`                  | `timestamp with time zone` |         Não | ``                        | Data/hora em que a entrega foi realizada.                                            |
| `delivered_by`                  | `uuid`                     |         Não | ``                        | Usuário que realizou a entrega.                                                      |
| `reviewed_at`                   | `timestamp with time zone` |         Não | ``                        | Data/hora da conferência.                                                            |
| `reviewed_by`                   | `uuid`                     |         Não | ``                        | Usuário que conferiu a entrega.                                                      |
| `finalized_at`                  | `timestamp with time zone` |         Não | ``                        | Data/hora da finalização.                                                            |
| `finalized_by`                  | `uuid`                     |         Não | ``                        | Usuário que finalizou a entrega.                                                     |
| `notes`                         | `text`                     |         Não | ``                        | Observações gerais.                                                                  |
| `metadata`                      | `jsonb`                    |         Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis.                     |
| `created_by`                    | `uuid`                     |         Não | ``                        | Usuário que criou o registro.                                                        |
| `created_at`                    | `timestamp with time zone` |         Sim | `now()`                   | Data/hora de criação do registro.                                                    |
| `updated_at`                    | `timestamp with time zone` |         Sim | `now()`                   | Data/hora da última atualização.                                                     |
| `deleted_at`                    | `timestamp with time zone` |         Não | ``                        | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

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

| Campo                           | Tipo                       | Obrigatório | Padrão/Gerado             | O que faz                                                                            |
| ------------------------------- | -------------------------- | ----------: | ------------------------- | ------------------------------------------------------------------------------------ |
| `id`                            | `uuid`                     |         Sim | `gen_random_uuid()`       | Identificador único do registro.                                                     |
| `church_id`                     | `uuid`                     |         Sim | ``                        | Igreja/campo ao qual o registro pertence.                                            |
| `congregation_id`               | `uuid`                     |         Sim | ``                        | Congregação vinculada ao registro.                                                   |
| `report_delivery_id`            | `uuid`                     |         Sim | ``                        | Entrega de relatório vinculada ao item.                                              |
| `report_delivery_rule_id`       | `uuid`                     |         Não | ``                        | Regra original usada para gerar o item.                                              |
| `category_id`                   | `uuid`                     |         Não | ``                        | Categoria financeira vinculada ao registro.                                          |
| `rule_name`                     | `text`                     |         Sim | ``                        | Nome da regra salvo no momento do cálculo.                                           |
| `rule_code`                     | `text`                     |         Não | ``                        | Código da regra salvo no momento do cálculo.                                         |
| `rule_description`              | `text`                     |         Não | ``                        | Descrição da regra salva no momento do cálculo.                                      |
| `rule_type`                     | `text`                     |         Sim | ``                        | Tipo da regra: percentual, valor fixo ou valor manual.                               |
| `rule_nature`                   | `text`                     |         Sim | ``                        | Natureza da regra: repasse, prebenda, desconto, contribuição ou outro.               |
| `calculation_base`              | `text`                     |         Sim | ``                        | Base usada para cálculo da regra.                                                    |
| `base_amount`                   | `numeric(12, 2)`           |         Sim | `0`                       | Valor base usado para calcular o item.                                               |
| `percentage_value`              | `numeric(8, 4)`            |         Não | ``                        | Percentual aplicado na regra.                                                        |
| `fixed_amount`                  | `numeric(12, 2)`           |         Não | ``                        | Valor fixo aplicado na regra.                                                        |
| `manual_amount`                 | `numeric(12, 2)`           |         Não | ``                        | Valor manual informado no momento do cálculo.                                        |
| `calculated_amount`             | `numeric(12, 2)`           |         Sim | `0`                       | Valor final calculado para o item.                                                   |
| `applies_to_central_church`     | `boolean`                  |         Sim | `true`                    | Indica se a regra se aplica à Catedral/igreja central.                               |
| `applies_to_congregation`       | `boolean`                  |         Sim | `true`                    | Indica se a regra afeta a congregação.                                               |
| `affects_pastoral_prebend`      | `boolean`                  |         Sim | `false`                   | Indica se a regra compõe/afeta a prebenda pastoral.                                  |
| `deducts_from_pastoral_prebend` | `boolean`                  |         Sim | `false`                   | Indica se a regra desconta da prebenda pastoral.                                     |
| `generate_central_income`       | `boolean`                  |         Sim | `false`                   | Indica se o item pode gerar entrada para a Catedral.                                 |
| `generate_congregation_expense` | `boolean`                  |         Sim | `false`                   | Indica se o item pode gerar saída para a congregação.                                |
| `central_transaction_id`        | `uuid`                     |         Não | ``                        | Transação financeira gerada para a Catedral, quando houver.                          |
| `congregation_transaction_id`   | `uuid`                     |         Não | ``                        | Transação financeira gerada para a congregação, quando houver.                       |
| `sort_order`                    | `integer`                  |         Sim | `0`                       | Ordem de exibição nas telas e relatórios.                                            |
| `notes`                         | `text`                     |         Não | ``                        | Observações gerais.                                                                  |
| `metadata`                      | `jsonb`                    |         Sim | `jsonb_build_object(...)` | Dados extras em JSON para configurações e informações flexíveis.                     |
| `created_by`                    | `uuid`                     |         Não | ``                        | Usuário que criou o registro.                                                        |
| `created_at`                    | `timestamp with time zone` |         Sim | `now()`                   | Data/hora de criação do registro.                                                    |
| `updated_at`                    | `timestamp with time zone` |         Sim | `now()`                   | Data/hora da última atualização.                                                     |
| `deleted_at`                    | `timestamp with time zone` |         Não | ``                        | Data/hora de exclusão lógica; quando preenchido, o registro é tratado como removido. |

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
