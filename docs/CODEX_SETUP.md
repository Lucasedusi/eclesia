# Configuracao local do Codex

## Pre-requisitos

- Git configurado e autenticado para o GitHub.
- `fnm` instalado.
- Node.js `24.21.0`, declarado em `.node-version`.
- npm 10 ou superior.

## Primeiro uso no Mac

Na raiz do repositorio:

```bash
cp .env.example .env.local
npm ci
```

Preencha somente o `.env.local` com as credenciais do ambiente de desenvolvimento. Esse arquivo e ignorado pelo Git.

Depois valide a instalacao:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Adicionar ao ChatGPT Desktop

1. Abra a area Codex no ChatGPT Desktop.
2. Adicione `/Users/mac/Developer/eclesia` como projeto local.
3. Defina essa pasta como a pasta primaria do projeto.
4. Marque o repositorio como confiavel quando solicitado.
5. Nas configuracoes do projeto, crie um ambiente local com `npm ci` como script de preparacao.
6. Adicione as acoes `npm run dev`, `npm test` e `npm run typecheck`.

## Fluxo recomendado

- Use Local para inspecionar o projeto ou trabalhar junto com o seu editor.
- Use Worktree para implementacoes isoladas.
- O `.worktreeinclude` copia o `.env.local` ignorado para worktrees gerenciadas pelo Codex.
- Revise o diff e os testes antes de criar uma branch, commit ou pull request.

## Seguranca

- Nunca cole segredos em prompts, issues ou commits.
- Use apenas credenciais de desenvolvimento durante testes locais.
- Operacoes em Supabase remoto, envio real de e-mail, cobrancas Pix e webhooks exigem aprovacao explicita.
