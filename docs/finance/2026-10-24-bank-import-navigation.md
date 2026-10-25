# Importação compacta e retorno à fila — validação local

Implementado na branch `codex/finance-bank-statement-import`, conforme aprovação do usuário. Sem subagentes, push, merge, migrações ou acesso ao banco online nesta etapa.

## Resultado

- Área de upload personalizada com 42 px de altura, alinhada ao campo de conta. Nome longo truncado, ícone de arquivo e remoção da seleção dentro do mesmo controle.
- Menu de três pontos no histórico. A exclusão conserva confirmação e impedimento quando já existe histórico financeiro.
- Sucesso do upload e saída da página limpam a seleção temporária; falha de envio mantém o arquivo para nova tentativa.
- Continuar abre a fila, sem restaurar uma edição encerrada. Rascunhos efetivamente salvos permanecem disponíveis quando o operador escolhe conferir o item.
- A prévia tem somente **Salvar**. **Salvar rascunho** fica em **Mais opções**, aceita classificação incompleta e não cria movimentação.
- Salvar, confirmar transferência e concluir vínculo retornam à fila, com mensagem discreta e contagens atualizadas. Filtros são mantidos e a projeção existente ajusta a página quando o último item sai dela.
- Durante atualização de filtros ou dados, a abertura dos itens aguarda a listagem atualizada.

## Decisões técnicas e revisão

A limpeza transitória usa o encerramento de Activity documentado na versão instalada do Next.js, além dos eventos explícitos de sucesso e descarte. Não houve alteração do cache global nem recarga completa da página.

O resultado da conferência informa qual ação foi concluída; rascunho permanece na edição, enquanto lançamento, vínculo e reconhecimento de duplicidade retornam à fila. Ignorar e restaurar mantêm o fluxo anterior.

O botão de rascunho chama a rotina do formulário por uma referência restrita. Um primeiro teste demonstrou que associar um botão externo de envio ao formulário fazia Enter salvar rascunho em vez do lançamento; a referência mantém o envio padrão em **Salvar**, sem duplicar estado ou regras de validação.

Revisão feita pelo próprio implementador, respeitando a proibição de subagentes. As rotinas autenticadas de servidor, escopos, RLS, revisão, auditoria e chaves de idempotência permanecem inalteradas. A retentativa após resposta perdida continua bloqueando uma nova operação até conferir o resultado da tentativa original.

## Evidências

| Verificação | Resultado |
| --- | --- |
| Lint com zero warnings | Aprovado |
| TypeScript | Aprovado, também confirmado pelo build final |
| Vitest | 585 testes em 111 arquivos aprovados |
| Build com configuração exclusivamente local | Aprovado |
| Playwright: navegação do importador | 5 cenários aprovados na rodada final, em 32,1 s |
| Playwright: importador e formulários compartilhados | Outros 15 cenários aprovados na versão compilada |
| Revisão visual | Upload vazio e preenchido, desktop e 1.024 px; prévia de saída com somente Salvar |
| Diff e branch | Sem erros de whitespace, alterações de banco, credenciais ou arquivos gerados |

Os cinco cenários novos verificam: falha/sucesso do upload e limpeza ao sair; descarte, Continuar e histórico do navegador; rascunho incompleto, persistência e lançamento de entrada/saída; Enter com Mais opções aberto; último item da segunda página com filtro de saída. Incluem altura/alinhamento do upload, teclado/Escape do menu, proteção contra excluir importação lançada e ausência de rolagem horizontal em 1.024 px.

Os outros cenários abrangem rascunho antigo com rateio, ignorar/restaurar, resposta perdida, vínculo com lançamento manual, transferência, duplicidade, exclusão/restauração, totais, atendimento, lançamentos, descrição coletiva e proteções do formulário compartilhado.

As falhas iniciais reproduziram os resíduos e ações antigas. Rodadas intermediárias em desenvolvimento também tiveram timeouts de carregamento e um `UNAVAILABLE` local no histórico com dados de teste acumulados. A verificação conclusiva utilizou servidor compilado, dados fictícios novos e execução sequencial. Uma falha remanescente do teste de upload foi isolada: `setInputFiles` selecionava o campo ainda oculto no DOM, durante o retorno à página; o teste agora aguarda a tela visível. A rodada anterior da versão compilada aprovou 19/20 casos; após corrigir essa sincronização, os cinco casos de navegação passaram sem alteração adicional no código da aplicação.

SQL, Advisors e regeneração de tipos não se aplicam: nenhuma estrutura ou rotina de banco foi modificada. A análise de pacotes/rotas não se aplica a estes ajustes de interface e estado transitório. Não foi realizada validação online, conforme a restrição do usuário.

Logs e capturas fictícias permanecem em `tmp/import-navigation-*`, ignorado pelo Git. Todos os servidores temporários foram encerrados; as portas 3217 e 3000 estavam livres na entrega. A `main` permaneceu em `b83b43c5ad59176a814b4b2d92f0f062edbdfa35`.
