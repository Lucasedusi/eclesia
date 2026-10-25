# Importação compacta e encerramento da conferência

Aprovado pelo usuário em 24/10/2026: upload personalizado com a mesma altura do campo de conta; excluir importação no menu de três pontos; limpar seleções transitórias ao navegar; um botão Salvar na prévia; rascunho em Mais opções; voltar à fila após registrar o lançamento.

## Abordagem

Preservar a navegação rápida existente e encerrar explicitamente o estado transitório. Recarregar o documento inteiro funcionaria, mas perderia filtros/posição e prejudicaria a rapidez. Desabilitar o cache global afetaria outros módulos. A abordagem aprovada limita o reset ao arquivo, item aberto, menus e mensagens do importador, usando os ciclos de Activity documentados na versão instalada.

Continuar abre a fila; Conferir abre apenas o item escolhido. Sair ou descartar encerra a seleção, inclusive em voltar/avançar. Upload bem-sucedido limpa o arquivo; falha mantém a seleção para retentativa. Rascunhos persistidos continuam disponíveis ao abrir explicitamente um item. Operações financeiras com resultado incerto mantêm a proteção de retentativa.

Salvar registra o movimento e retorna à fila com mensagem discreta, contadores atualizados e filtros/página válidos preservados. O mesmo retorno se aplica à confirmação de transferência e vínculo, que também concluem a conferência. Rascunho permanece na edição e não movimenta dinheiro. As demais telas financeiras mantêm suas ações atuais.

## Restrições

Branch `codex/finance-bank-statement-import`; sem subagentes, publicação, main ou escrita online. Sem novas dependências ou migrações. Testes somente com o harness local e dados fictícios; encerrar o servidor ao final.
