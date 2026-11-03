# Contas a pagar — disponibilidade exclusiva no desktop

Alteração solicitada em 02/11/2026, executada diretamente e sem subagentes na branch `codex/finance-accounts-payable`.

## Comportamento

- Item removido do menu mobile. Celulares e tablets identificados pelo Next.js também não recebem o atalho na sidebar, incluindo celular na horizontal.
- A página verifica autorização antes de identificar o dispositivo. Para celulares/tablets identificados, retorna a orientação de uso pelo computador antes de consultar as contas ou seus catálogos.
- No modo mobile do Financeiro (até 760 px), a fronteira de apresentação não mantém a listagem ou seus modais montados. A classe responsiva existente evita exibir o conteúdo desktop antes da hidratação.
- O acesso direto apresenta “Contas a pagar está disponível apenas no computador.” e retorno à visão geral, preservando congregação e mês.
- Autorização administrativa, Catedral, isolamento por igreja, serviços, RLS, histórico e operações de pagamento/cópia permanecem iguais. A identificação do dispositivo controla a disponibilidade da interface; não substitui autorização.

## Validação

- Lint sem warnings, typecheck e build aprovados; 633 testes Vitest aprovados.
- 27 cenários Playwright aprovados na versão compilada, com dados e sessões exclusivamente locais.
- Cobertura: ausência do atalho e acesso direto em 320, 390 e 760 px; emulação de iPhone na horizontal e iPad; remoção de modal ao reduzir a janela; permissão de administrador também no celular; operações em 1024 e 1280 px e regressões de navegação mobile.
- Mensagem inspecionada visualmente no celular. Os cenários antigos de operação mobile foram substituídos pela restrição solicitada; as regressões de operação foram mantidas em desktop.
- Antes da implementação, os testes detectaram ausência da mensagem de restrição em celular na horizontal e permanência do modal ao reduzir a janela.

Ocorrências resolvidas: a preparação de dados locais de outubro passou a exigir justificativa retroativa após a virada para novembro; `finance-local.mjs` agora informa `retroactiveReason`. A preparação incompleta deixou a primeira execução com sessões/fixture incompatíveis, e a sobreposição das ferramentas de desenvolvimento também interceptou cliques no menu. A validação final usou a fixture completa e a versão compilada. A primeira regressão compilada aprovou 26/27 cenários: a captura de página inteira no Chromium alterava temporariamente a janela de 1024×900 para 1×1, acionando corretamente a restrição mobile e desmontando o modal. A causa foi reproduzida com eventos de `matchMedia`; as capturas de contas a pagar passaram a usar apenas a área visível. Rodada final: 27/27.

SQL/advisors não se aplicam: sem mudanças de banco. `analyze:routes` não executado, pois a alteração não tem objetivo de otimização de bundles/carregamento. Nenhuma migração ou escrita online, push ou merge. Servidor e serviços locais de teste encerrados ao finalizar.
