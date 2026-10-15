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

Em 15/10/2026, o build de produção, o lint sem avisos, o typecheck e os 483 testes Vitest passaram. O conjunto de 24 cenários E2E mobile rodou contra o servidor local de produção: o teste público da PWA passou (manifesto, ícones, worker e página neutra responderam com HTTP 200); 23 cenários autenticados foram ignorados pela ausência da fixture local.

| Rota | JS gzip inicial | JS gzip final | Variação |
| --- | ---: | ---: | ---: |
| `/financeiro` | 46,2 KB | 52,4 KB | +6,2 KB |
| `/financeiro/lancamentos` | 184,3 KB | 191,0 KB | +6,7 KB |
| `/financeiro/atendimento` | 176,9 KB | 183,1 KB | +6,2 KB |
| `/financeiro/caixas` | 49,1 KB | 54,8 KB | +5,7 KB |
| `/financeiro/demonstrativos` | 47,0 KB | 52,7 KB | +5,7 KB |
| `/financeiro/relatorios` | 44,7 KB | 50,4 KB | +5,7 KB |
| `/financeiro/configuracoes` | 51,6 KB | 57,3 KB | +5,7 KB |

Os recursos públicos da PWA somam 36.547 bytes sem compressão: manifesto 532 B, worker 1.290 B, página offline 1.455 B e três ícones PNG 33.270 B. A medição de bundles usa os mesmos chunks e comando da linha de base. LCP, INP e CLS reais ainda não foram medidos; a telemetria existente coleta essas métricas por rota e tipo de navegação após a publicação autorizada.

## Segurança e comportamento verificados

- Manifesto com início em `/financeiro`, modo `standalone`, ícones 192/512 px e ícone Apple. O ícone foi inspecionado visualmente.
- Worker usa a rede para navegações no Financeiro e login. O teste isolado confirmou que apenas `/financeiro-offline.html` entra em Cache Storage; nenhuma resposta financeira, API, PDF, rascunho ou credencial é armazenada por ele.
- O script do worker respondeu com `Cache-Control: no-cache, max-age=0` e `Service-Worker-Allowed: /` no servidor de produção local. As respostas financeiras recebem `private, no-store` no proxy e na configuração de cabeçalhos; o endpoint de PDF já tinha `private, no-store`.
- Testes isolados verificaram que os recursos PWA são públicos, a rota financeira sem sessão redireciona com `next`, e uma sessão válida mantém um retorno seguro ao Financeiro. A autorização final permanece nos serviços existentes.
- A atualização exige ação explícita. A decisão de ativar ou recarregar bloqueia formulários sujos; o controlador repete a checagem quando o worker assume o controle.
- Os componentes mobile recebem as mesmas capacidades, DTOs e ações financeiras das telas desktop. Nenhuma migração, cálculo ou regra financeira foi modificada.

## Pré-requisitos de verificação antes da disponibilização

- Executar os E2E autenticados com `E2E_STORAGE_STATE` e `E2E_FINANCE_FIXTURE` fictícios locais, inclusive permissão somente de consulta, isolamento por congregação, formulário com teclado aberto, resposta incerta, versões, PDF e impressão. Nesta sessão, `scripts/finance-local.mjs setup` precisou do socket Colima/Docker; o acesso solicitado foi recusado. Nenhum banco remoto ou dado real foi usado como substituto. O servidor de produção local sem variáveis Supabase retornou HTTP 500 para `/financeiro`, portanto a inspeção visual autenticada não foi possível. Os testes de acesso no proxy passaram com Supabase simulado, mas não substituem a verificação completa.
- Conferir em aparelhos Android e iPhone físicos: instalação, expiração e retorno após login, rolagem com teclado, falta de conexão durante gravação, atualização com formulário sujo, abertura/baixar PDF e impressão de 58/80 mm. Os aparelhos não estavam disponíveis nesta sessão.
- Após publicação autorizada, comparar o percentil 75 de LCP, INP e CLS com as metas acima e observar erros de geração de PDF, login e service worker. Nenhuma publicação foi realizada nesta etapa.
