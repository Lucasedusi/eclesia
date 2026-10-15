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

## Pré-requisitos de verificação

- Os E2E financeiros autenticados precisam de `E2E_STORAGE_STATE` e `E2E_FINANCE_FIXTURE` com dados fictícios locais. O preparo pelo `scripts/finance-local.mjs` depende do socket Colima/Docker; o acesso solicitado nesta sessão foi recusado. Não se usará banco remoto nem dados reais para substituí-los.
- Instalação, retomada de sessão, impressão e abertura de PDF precisam ser conferidas em Android e iPhone físicos antes da disponibilização. Esses dispositivos não estão conectados a esta sessão.
- A comparação final de bundles será executada após a implementação com o mesmo comando e conjunto de rotas.
