# Eclesias — Plataforma de Gestão da Igreja

O **Eclesias** é uma plataforma web em desenvolvimento para gestão administrativa, ministerial e financeira de igrejas.

O projeto está sendo construído com foco em simplicidade, organização e escalabilidade, buscando atender secretarias, tesourarias, lideranças e equipes administrativas da igreja.

A proposta inicial é substituir fluxos manuais, planilhas isoladas e controles dispersos por uma aplicação centralizada, com módulos bem definidos e interface visual simples para usuários com diferentes níveis de familiaridade com tecnologia.

---

## Objetivo do Projeto

Criar uma plataforma completa para gestão da igreja, contemplando inicialmente:

- Cadastro e gestão de membros;
- Gestão de congregações;
- Eventos e inscrições;
- Financeiro;
- Área interna para documentos;
- Relatórios administrativos;
- Dashboard com indicadores;
- Controle de usuários e permissões.

O projeto ainda está em fase inicial. A base técnica, layout principal e design system foram configurados. A próxima etapa será iniciar o escopo oficial, modelagem geral e modelagem do módulo de membros.

---

## Stack Principal

O projeto utiliza:

- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **Supabase**
- **Manrope Font**
- **Lucide React Icons**
- **Git/GitHub**
- **Trello** para organização das atividades

---

## Arquitetura Geral

A aplicação foi pensada para usar o próprio **Next.js como frontend e backend da aplicação**.

## Estrutura Inicial de Pastas

```txt
Next.js
├── Interface React
├── Server Components
├── Server Actions
├── Services
├── Validações
├── Regras de negócio
└── Integração com Supabase

Supabase
├── PostgreSQL
├── Auth futuramente
├── Storage futuramente
├── RLS / Policies
└── APIs
```

src
├── actions
├── app
│ ├── design-system
│ ├── globals.css
│ ├── layout.tsx
│ └── page.tsx
├── components
│ ├── form
│ │ └── form-section.tsx
│ ├── layout
│ │ ├── app-header.tsx
│ │ ├── app-shell.tsx
│ │ ├── app-sidebar.tsx
│ │ └── mobile-sidebar.tsx
│ └── ui
│ ├── badge.tsx
│ ├── button.tsx
│ ├── card.tsx
│ ├── input.tsx
│ ├── page-header.tsx
│ ├── select.tsx
│ ├── stat-card.tsx
│ └── textarea.tsx
├── constants
│ ├── app.ts
│ └── navigation.ts
├── hooks
├── lib
│ └── supabase
│ ├── client.ts
│ └── server.ts
├── services
│ └── app-settings.service.ts
├── styles
├── types
│ └── common.ts
└── utils
└── cn.ts

```

----------------

## Módulos Gerais

1. Membros

Provável primeiro módulo real.

Deverá contemplar:

Cadastro de membros;
Dados pessoais;
Dados ministeriais;
Congregação;
Cargo/função;
Status do membro;
Histórico;
Documentos anexos;
Filtros e listagem;
Edição e inativação.
2. Congregações

Base para relacionar membros, relatórios e organização administrativa.

Possíveis dados:

Nome da congregação;
Regional;
Endereço;
Dirigente;
Status;
Observações.
3. Eventos

Evolução da ideia inicial feita no Bubble.

Possibilidades:

Cadastro de eventos;
Inscrições;
Itens do evento;
Pagamentos;
Check-in;
Relatórios;
Status de inscrição.
4. Financeiro

Módulo para controle de tesouraria e movimentações.

Possibilidades:

Caixas;
Entradas;
Saídas;
Categorias;
Transferências;
Comprovantes;
Relatórios;
Dashboard financeiro.
5. Documentos

Área interna para organização e arquivamento.

Possibilidades:

Pastas;
Upload de arquivos;
Documentos por módulo;
Documentos por membro;
Documentos administrativos;
Controle de acesso;
Histórico de uploads.
6. Permissões

Módulo essencial para segurança.

Perfis possíveis:

Administrador geral;
Secretaria;
Tesouraria;
Liderança;
Visualizador;
Usuário por departamento.
```

---

Decisões Técnicas Importantes
Next.js como aplicação completa

Não será criado um backend separado no início. O Next.js será responsável por:

Telas;
Services;
Server Actions;
Validações;
Regras de negócio;
Comunicação com o Supabase.
Supabase como banco e serviços

O Supabase será usado para:

Banco PostgreSQL;
Auth futuramente;
Storage futuramente;
Regras RLS;
Políticas de acesso.
Arquivos não devem ir para o banco

Documentos, imagens, PDFs e comprovantes devem ser armazenados no Supabase Storage.

No banco serão salvos apenas metadados:

## ESCOPO DO PROJETO

1. Definir o escopo do MVP

- Congregações
- Cargos/Funções
- Membros
- Usuários e permissões básicas
- Dashboard simples
- Documentos/anexos do membro, se já quiser usar Supabase Storage

Eventos, financeiro e relatórios mais complexos eu deixaria para depois, porque eles dependem de uma base bem feita de membros, congregações e permissões.

churches / igrejas
regions / regionais
congregations / congregações
members / membros
member_ministries / ministérios do membro
member_documents / documentos do membro
roles / cargos ou funções
users / usuários do sistema
user_profiles / perfis de acesso
audit_logs / histórico de ações
