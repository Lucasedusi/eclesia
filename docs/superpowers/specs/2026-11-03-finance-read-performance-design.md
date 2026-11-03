# Otimização das leituras financeiras

Implementar localmente o plano aprovado na conversa em 3 de novembro de 2026 e repetir a medição documentada em `docs/finance/2026-11-03-performance-baseline.md`. O volume esperado é até 1.000 lançamentos por congregação/mês, incluindo crescimento do histórico.

## Solução

Adicionar um helper privado, estável, sem argumentos controlados pelo cliente, que enumera pares de igreja e congregação legíveis pelo usuário autenticado. Ele reutiliza `private.can_access_finance_unit(..., 'finance.view')`, preservando a regra canônica, seus escopos, permissões e exclusões. Alterar somente as políticas SELECT de `financial_transactions` e `financial_ledger_entries` para verificar pertinência ao conjunto não correlacionado, calculado uma vez por consulta. Nenhum resultado é armazenado entre requisições ou usuários.

O helper precisa de SECURITY DEFINER para enumerar candidatos sem recursão das políticas; ficará no schema privado, com search_path vazio, nomes qualificados, identidade derivada de auth.uid(), execução restrita e nenhum acesso a valores financeiros. As consultas públicas continuam SECURITY INVOKER e autenticadas. Manter o par church_id/congregation_id e deleted_at is null na política.

## Alternativas e limites

- Escolhida: reutilizar a regra atual uma vez por unidade. Reduz o custo por lançamento sem duplicar regras de autorização.
- Reescrever toda a autorização em joins: possível, porém aumenta o risco de divergência da regra canônica; fora desta entrega.
- Resumos mensais de saldo: avaliar somente se o histórico continuar lento após a autorização; exigem cuidado adicional com retroatividade, correção, cancelamento e transferência.

Não alterar a semântica de ALLOW/DENY, status de congregação, mutações, permissões do Data API, limite de tempo, limite de relatório ou integrações externas. Criar nova migração, aplicar apenas localmente e regenerar os tipos. Os testes de dados retroativos recebem justificativas explícitas, sem mudar datas e expectativas históricas.

## Evidência de conclusão

Testes de acesso CHURCH, REGION, CONGREGATION e MINISTRY; múltiplos acessos e igrejas; overrides; bloqueio/exclusão e revogação entre consultas; anon e sem sessão; SELECT direto e RPCs. Teste de performance verifica que o número de avaliações de escopo não cresce com os lançamentos. Comparar saldos, totais e linhas; repetir 100/1.000/9.900 lançamentos, histórico anual e concorrência. Executar validações do projeto, SQL relevante, Advisors locais e revisão independente antes de concluir. A hospedagem remota não está autorizada nesta etapa.
