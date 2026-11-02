# Comprovante digital — validação e publicação

Implementado em 02/11/2026 na branch `codex/finance-digital-receipt`, a partir de
`6919cb9`, com execução e revisão diretas, sem subagentes. A base contém o trabalho
de contas a pagar; a publicação precisa preservar essa dependência.

## Comportamento

- A opção aparece exclusivamente nos detalhes, para comprovantes válidos de
  lançamentos confirmados. Novo lançamento, atendimento e impressão térmica
  continuam com o fluxo existente.
- A janela oferece prévia, PDF, telefone e **Abrir WhatsApp**. A conversa recebe
  uma mensagem genérica e o link; o operador confirma o envio. O navegador usa a
  conta já conectada ao WhatsApp, portanto a interface orienta usar a conta da igreja.
- O telefone fica apenas na janela e na URL aberta do WhatsApp. Não é enviado
  ao servidor do Eclesias, persistido nem incluído no comprovante.
- Página pública responsiva, sem login, com identidade da igreja, pessoa,
  data, forma de pagamento, contribuições, total e número do recibo. O PDF
  compacto permite selecionar texto e continua em novas páginas quando necessário.
- Cada link vale por 30 dias. Quem possui o link pode acessá-lo; o aviso inclui
  a data de validade. Cancelamento, substituição, exclusão, revogação ou expiração
  impedem novas leituras do HTML e do PDF. Uma cópia já baixada é um arquivo do destinatário.

## Acesso e dados

Emissão autenticada com `finance.view`, igreja e congregação autorizadas. O banco
repete as verificações de permissão e escopo; a chave composta impede referências
entre igrejas ou congregações. RLS habilitada e acesso direto negado a `anon` e
`authenticated`; somente a função de emissão é autorizada ao usuário autenticado.

Os tokens usam 32 bytes aleatórios e somente o hash SHA-256 fica no banco. A leitura
pública resolve o escopo no servidor e retorna uma projeção validada, sem CPF,
observações, caixa/conta ou IDs internos das transações. Limites persistentes:
20 emissões por recibo a cada 10 minutos e 60 leituras por link a cada 10 minutos.
Compartilhar não altera os valores nem o histórico de impressão térmica.

As respostas usam `no-store`, `no-referrer`, `noindex` e CSP restritiva. A página
escapa os valores, usa fontes locais e não inclui dados financeiros em metadados
sociais. Os logs próprios e de desenvolvimento do Next ocultam o token desta rota.
Logs de acesso da hospedagem devem seguir a mesma política de proteção de URLs
com tokens já utilizada nas demais rotas públicas da aplicação.

## Evidências locais

Todos os dados e contatos dos testes são fictícios. O WhatsApp foi interceptado
no navegador; nenhum envio real foi realizado.

| Verificação | Resultado |
| --- | --- |
| `npm run lint -- --max-warnings=0` | Passou |
| `npm run typecheck` | Passou |
| `npm test` | 122 arquivos, 666 testes passaram |
| Build pelo harness `scripts/finance-local.mjs build` | Passou, Next.js 16.3.5 |
| Playwright na versão de produção local | 10 testes passaram, nenhum ignorado |
| `supabase/tests/finance_digital_receipts.sql` | Passou, fixtures revertidas por rollback |
| Supabase Security e Performance Advisors locais | Nenhum erro; 13 avisos em objetos existentes, nenhum nos novos objetos |
| Tipos Supabase | Regenerados pelo CLI contra o banco local |
| `git diff --check` | Passou |
| Inspeção visual | Janela e página em desktop/celular; PDF sem logo, com logo e multipágina |
| PDF com 75 itens e nome longo | 7 páginas; extração confirmou os 75 itens presentes uma única vez |

Os dez testes de navegador incluem cinco cenários digitais: desktop, celular,
correção/cancelamento, atendimento com vários itens e falha de rede com nova
tentativa. Os demais cobrem atendimento existente, cartões e transferências no
celular, impressão térmica nas duas larguras e criação/correção/cancelamento de
lançamento. A ausência da opção digital no cadastro também foi verificada.

Os testes SQL cobrem `anon`, `authenticated`, outra igreja, outra congregação,
grants/RLS, chaves compostas, autor, validade, limites, invalidação e preservação
do histórico financeiro/térmico. Os 13 avisos dos Advisors são de avaliação de
auth em RLS e políticas permissivas múltiplas em tabelas existentes:
`app_settings`, `audit_logs`, `profiles`, `user_church_access`,
`user_permission_overrides`, `church_invitations` e `congregation_documents`.

Durante a validação, um teste antigo precisou simular a nova Server Action para
manter o isolamento de código de servidor; a suíte completa passou após o ajuste.
A extração de texto do PDF utilizou `pypdf` do runtime fornecido, pois `pdftotext`
e o pacote `pypdf` do Python do sistema não estavam disponíveis.

A revisão final não encontrou bloqueios: foram conferidos escopo, estados do
recibo, projeção pública, paginação, erros, links e preservação do fluxo existente.
Os artefatos estão nas pastas ignoradas `tmp/finance-digital-*`,
`tmp/finance-digital-review/` e `test-results/finance-digital-receipt-*`.

## Publicação

### Migração online aplicada

Após autorização expressa do usuário, a migração
`20261102194716_finance_digital_receipt_links.sql` foi aplicada em 02/11/2026 ao
projeto `eclesias_bd_sp` (`dhgrfvakdbtedqfgecys`). A origem foi confirmada contra a
configuração local da aplicação e o projeto ativo no Supabase.

O dry-run identificou somente esse arquivo pendente. A aplicação pelo CLI preservou
a versão original no histórico, com `--skip-vault`, sem seeds ou alterações de
roles. O dry-run posterior confirmou `upToDate: true` e nenhuma migração pendente.

As consultas de verificação online foram somente de metadados: migração registrada,
RLS habilitada, acesso direto negado a `anon`/`authenticated`, emissão autorizada
somente ao papel autenticado entre os papéis públicos, consumo reservado ao
servidor, `search_path` vazio, chaves compostas/checks validados e quatro índices
presentes. Não foram executadas fixtures, criados comprovantes ou enviados contatos
reais no ambiente online. Os tipos já tinham sido regenerados contra essa mesma
migração no banco local; não houve nova alteração de esquema nesta etapa.

Os Advisors online não retornaram erros. A análise remota tem regras adicionais
em relação ao CLI local e apontou os seguintes itens relacionados à funcionalidade:

- [RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
  informativo: intencional; a tabela não concede acesso direto aos papéis públicos
  e é acessada pelas funções/servidor autorizados.
- [Função SECURITY DEFINER executável por autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
  aviso: intencional na emissão; exige `auth.uid()`, permissão `finance.view`,
  igreja/congregação autorizadas e recibo válido, com `search_path` vazio. Essas
  verificações foram testadas localmente e os privilégios conferidos online.
- [Índices ainda não utilizados](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index),
  informativo nos dois índices auxiliares recém-criados; mantidos por sustentarem
  a busca/limitação por recibo e a chave estrangeira do autor.

No conjunto do projeto, segurança retornou 67 avisos e 6 informativos; desempenho,
13 avisos e 481 informativos. Os demais itens são externos ao escopo desta migração,
incluindo [proteção de senha vazada desabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Nenhuma configuração de autenticação ou objeto fora do escopo foi alterado.

Logs locais ignorados: `tmp/finance-digital-online-push.log` e
`tmp/finance-digital-online-postcheck.log`.

### Código enviado ao GitHub; aplicação mantida local

Em 02/11/2026, o usuário esclareceu que o Eclesias roda somente no computador e
optou por manter esse funcionamento e enviar o código ao GitHub. A branch
`codex/finance-digital-receipt` foi enviada; a revisão usa
`codex/finance-accounts-payable` como base para preservar a dependência de contas
a pagar, cuja revisão ainda está aberta. Não houve merge na main ou configuração
de hospedagem. A conferência anterior ao envio aprovou novamente 666 testes,
lint sem warnings e typecheck; o código é o mesmo do build e dos dez E2E já validados.

O comprovante pode ser testado localmente. Um link com `localhost` não pode ser
aberto por um destinatário em outro dispositivo pela internet. Para disponibilizar
esse acesso em uma futura hospedagem, após autorização:

1. Preservar a base de contas a pagar ao integrar a branch; a migração do
   comprovante digital já está aplicada no banco online.
2. Configurar `NEXT_PUBLIC_SITE_URL` com a origem HTTPS correta do ambiente
   antes do build. Somente loopback local aceita HTTP. As credenciais de servidor
   do Supabase já usadas pela aplicação continuam necessárias.
3. Publicar a aplicação e conferir um comprovante com dados de teste autorizados,
   o acesso sem sessão, o download e a abertura manual do WhatsApp.

Não é necessário contratar Brevo, uma API de WhatsApp ou outro serviço.
