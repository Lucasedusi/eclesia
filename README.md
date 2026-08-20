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

## Configuração do fluxo de convites

O convite de usuários utiliza um token interno do Eclésias e o Brevo apenas para entregar esse link. O convidado cria a senha diretamente no sistema; não há Magic Link, segundo cadastro ou nova confirmação por e-mail.

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
SUPABASE_SECRET_KEY=sb_secret_SUA_CHAVE
NEXT_PUBLIC_SITE_URL=http://localhost:3000

BREVO_API_KEY=xkeysib-SUA_CHAVE_API
BREVO_SENDER_EMAIL=seu-remetente-verificado@exemplo.com
BREVO_SENDER_NAME=Eclésias
```

`BREVO_API_KEY` deve ser uma chave da aba **API Keys** do Brevo, não a chave SMTP. `SUPABASE_SECRET_KEY` e `BREVO_API_KEY` são usadas somente no servidor e nunca devem receber o prefixo `NEXT_PUBLIC_`.

## Checkout Pix dos eventos

O checkout público multifases e a integração Pix via Mercado Pago estão documentados em [docs/EVENTOS_CHECKOUT_PIX.md](docs/EVENTOS_CHECKOUT_PIX.md). O Access Token e o segredo de Webhook são variáveis exclusivas do servidor.

## Módulo de documentos administrativos

A rota `/documentos` oferece uma central privada organizada em
`Categoria → Pasta/Dossiê → Documento`. O módulo é exclusivo para acessos ativos
com papel `ADMIN` e escopo `CHURCH`, utiliza o bucket privado
`administrative-documents` e mantém as operações relevantes na auditoria geral.

Para instalar o banco em um novo ambiente, aplique em ordem as migrations de
`supabase/migrations`. Os detalhes técnicos e as verificações realizadas estão em
`RELATORIO_IMPLEMENTACAO_MODULO_DOCUMENTOS.md`.

## Cadastro inicial controlado

O cadastro público existe somente enquanto o sistema ainda não possui usuário,
perfil ou igreja. A primeira conta é confirmada no servidor, entra
automaticamente e segue para o onboarding. Depois disso, `/cadastro` redireciona
para o login, o link de criação desaparece e todos os novos usuários entram
exclusivamente por convite do Administrador.

Fluxo final:

```text
Administrador cria o convite
→ Brevo envia o link interno
→ Nome e e-mail aparecem bloqueados
→ Convidado cria a senha
→ Conta e convite são ativados
→ Login automático
→ Sistema
```

---

## Stack Principal

O projeto utiliza:

- **Next.js**
- **React**
- **TypeScript**
- **Styled-Components**
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

---

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
Edição e inativação. 2. Congregações

Base para relacionar membros, relatórios e organização administrativa.

Possíveis dados:

Nome da congregação;
Regional;
Endereço;
Dirigente;
Status;
Observações. 3. Eventos

Evolução da ideia inicial feita no Bubble.

Possibilidades:

Cadastro de eventos;
Inscrições;
Itens do evento;
Pagamentos;
Check-in;
Relatórios;
Status de inscrição. 4. Financeiro

Módulo para controle de tesouraria e movimentações.

Possibilidades:

Caixas;
Entradas;
Saídas;
Categorias;
Transferências;
Comprovantes;
Relatórios;
Dashboard financeiro. 5. Documentos

Área interna para organização e arquivamento.

Possibilidades:

Pastas;
Upload de arquivos;
Documentos por módulo;
Documentos por membro;
Documentos administrativos;
Controle de acesso;
Histórico de uploads. 6. Permissões

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
```
