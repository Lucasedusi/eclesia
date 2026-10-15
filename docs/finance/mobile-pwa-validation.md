# Financeiro mobile e PWA — validação

## Linha de base antes da interface mobile

Em 14/10/2026, no commit `12f7e2d`, `npm run build` passou com Next.js 16.3.5. O build precisou de acesso à rede para obter a fonte Rubik. `npm run analyze:routes` mediu os arquivos JavaScript associados a cada rota; os números abaixo são soma dos chunks da rota, sem imagens, fontes ou respostas HTML.

| Rota | Chunks | JS bruto | JS gzip |
| --- | ---: | ---: | ---: |
| `/financeiro` | 6 | 142,1 KB | 46,2 KB |
| `/financeiro/lancamentos` | 10 | 697,1 KB | 184,3 KB |
| `/financeiro/atendimento` | 9 | 673,5 KB | 176,9 KB |
| `/financeiro/caixas` | 6 | 150,4 KB | 49,1 KB |
| `/financeiro/demonstrativos` | 6 | 145,0 KB | 47,0 KB |
| `/financeiro/relatorios` | 6 | 137,7 KB | 44,7 KB |
| `/financeiro/configuracoes` | 6 | 158,7 KB | 51,6 KB |

LCP, INP e CLS reais exigem sessões autenticadas e tráfego mobile. A telemetria de Web Vitals já existe; comparar o percentil 75 após a publicação autorizada. As metas são LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1.

## Resultado da implementação

Na validação inicial, o build de produção, o lint sem avisos, o typecheck e os 483 testes Vitest passaram. Dos 24 cenários E2E mobile, somente o teste público da PWA pôde rodar; os outros 23 dependiam da fixture autenticada local.

Após a autorização para usar Colima/Docker e as correções descritas abaixo, a suíte completa terminou com **52/52 cenários E2E aprovados, zero falhas e zero cenários ignorados**, em aproximadamente 1,2 minuto: 24 mobile/PWA e 28 de regressão financeira. O servidor usado foi o build de produção com Supabase local. Lint sem avisos, typecheck, 483/483 testes Vitest, build, análise de bundles e `git diff --check` também passaram.

| Rota | JS gzip inicial | JS gzip final | Variação |
| --- | ---: | ---: | ---: |
| `/financeiro` | 46,2 KB | 52,5 KB | +6,3 KB |
| `/financeiro/lancamentos` | 184,3 KB | 191,1 KB | +6,8 KB |
| `/financeiro/atendimento` | 176,9 KB | 183,1 KB | +6,2 KB |
| `/financeiro/caixas` | 49,1 KB | 54,8 KB | +5,7 KB |
| `/financeiro/demonstrativos` | 47,0 KB | 52,7 KB | +5,7 KB |
| `/financeiro/relatorios` | 44,7 KB | 50,4 KB | +5,7 KB |
| `/financeiro/configuracoes` | 51,6 KB | 57,4 KB | +5,8 KB |

Os recursos públicos da PWA somam 36.547 bytes sem compressão: manifesto 532 B, worker 1.290 B, página offline 1.455 B e três ícones PNG 33.270 B. A medição de bundles usa os mesmos chunks e comando da linha de base. LCP, INP e CLS reais ainda não foram medidos; a telemetria existente coleta essas métricas por rota e tipo de navegação após a publicação autorizada.

## Correções após os testes autenticados

Após autorização expressa para usar Colima/Docker, a fixture foi preparada no Supabase local. O servidor de produção recebeu apenas a configuração desse ambiente; usuários, igrejas e lançamentos são fictícios. Não foi necessário alterar a estrutura do banco, migrações, serviços ou regras financeiras.

- Os modais de cadastro mobile agora ocupam toda a tela. Faltava posicionamento fixo, e as margens do modal reduziam a largura em 24 px.
- No desktop, “Limpar filtros” voltou a ficar dentro dos filtros avançados. No celular, permanece disponível quando há filtros ativos.
- Os testes aguardam o fim da animação dos modais e do carregamento por streaming; as verificações distinguem tabelas desktop de cartões mobile ocultos. O teste de largura dos links de PDF compara o botão ao espaço disponível e exige altura mínima de 48 px.
- O teste de operação financeira restaura a configuração anterior do usuário regional, evitando habilitar escrita para o usuário de consulta usado em outros cenários.
- Os cenários que simulam falhas ou atrasos de rede desabilitam o worker apenas nesses contextos de teste, conforme a [orientação do Playwright sobre interceptação](https://playwright.dev/docs/network#missing-network-events-and-service-workers). Os testes próprios da PWA usam o worker real para conferir cache e falta de conexão.

A inspeção adicional percorreu as sete telas financeiras em 390 px, os formulários de entrada e cadastro em 320 px e a visão geral desktop em 1440 px, sem rolagem horizontal ou exceções não tratadas. Capturas locais fictícias estão em `tmp/finance-mobile-validation/` (pasta ignorada pelo Git). A suíte também verifica larguras de 375, 430, 640 e 1024 px, navegação por teclado e movimento reduzido.

### Como repetir localmente

Com o perfil Colima `eclesia` e o Supabase local ativos, executar no checkout desta branch:

```sh
node scripts/finance-local.mjs setup
node scripts/finance-local.mjs build
node scripts/finance-local.mjs start
```

Em outro terminal:

```sh
node scripts/finance-local.mjs e2e 'e2e/finance-.*.spec.ts' --workers=1
```

O helper obtém a configuração local sem exibir chaves e guarda as sessões fictícias em `tmp/`. O `setup` cria um conjunto novo de dados. A suíte financeira usa um único worker porque alguns cenários alteram os mesmos cadastros e regras da fixture.

## Segurança e comportamento verificados

- Manifesto com início em `/financeiro`, modo `standalone`, ícones 192/512 px e ícone Apple. O ícone foi inspecionado visualmente.
- Worker usa a rede para navegações no Financeiro e login. O teste isolado confirmou que apenas `/financeiro-offline.html` entra em Cache Storage; nenhuma resposta financeira, API, PDF, rascunho ou credencial é armazenada por ele.
- O script do worker respondeu com `Cache-Control: no-cache, max-age=0` e `Service-Worker-Allowed: /` no servidor de produção local. As respostas financeiras recebem `private, no-store` no proxy e na configuração de cabeçalhos; o endpoint de PDF já tinha `private, no-store`.
- Testes isolados verificaram que os recursos PWA são públicos, a rota financeira sem sessão redireciona com `next`, e uma sessão válida mantém um retorno seguro ao Financeiro. A autorização final permanece nos serviços existentes.
- A atualização exige ação explícita. A decisão de ativar ou recarregar bloqueia formulários sujos; o controlador repete a checagem quando o worker assume o controle.
- Os componentes mobile recebem as mesmas capacidades, DTOs e ações financeiras das telas desktop. Nenhuma migração, cálculo ou regra financeira foi modificada.
- E2E autenticados confirmaram gravação, correção e cancelamento; múltiplas contribuições no mesmo comprovante; transferências separadas dos totais; versões e cálculos do demonstrativo; geração, abertura e download dos dois PDFs; restrição de caixa/configurações no servidor; PDF de outra congregação rejeitado com HTTP 403; ações de escrita ausentes no contexto de consulta.
- No navegador, o worker real armazenou apenas a página neutra e mostrou “Sem conexão” após perda de rede. O redirecionamento sem sessão e o retorno ao Financeiro com sessão válida passaram. A simulação de atualização preservou o formulário preenchido, inclusive quando o controle do worker mudou durante a edição.

## Pré-requisitos de verificação antes da disponibilização

- Conferir em aparelhos Android e iPhone físicos: instalação, expiração e retorno após login, rolagem com teclado, falta de conexão durante gravação, atualização com formulário sujo, abertura/baixar PDF e impressão de 58/80 mm. Os aparelhos não estavam disponíveis nesta sessão.
- Após publicação autorizada, comparar o percentil 75 de LCP, INP e CLS com as metas acima e observar erros de geração de PDF, login e service worker. Nenhuma publicação foi realizada nesta etapa.
