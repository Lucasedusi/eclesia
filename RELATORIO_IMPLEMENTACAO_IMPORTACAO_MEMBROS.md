# Implementação — Importação de membros em lote

Data: 11/08/2026

## Resultado

O módulo descrito em `MODELAGEM_TECNICA_IMPORTACAO_MEMBROS_LOTE` foi implementado integralmente no fluxo `/membros/importar`, com preparação em massa, revisão paginada, confirmação transacional, histórico, relatório XLSX e desfazimento protegido.

## Componentes entregues

- página responsiva em quatro etapas e aba de histórico;
- download da planilha-padrão com os 13 campos suportados;
- parser XLSX no servidor, limite de 5 MB e 500 membros;
- normalização de nomes, cabeçalhos, CPF, telefone, datas, Cargos, estado civil, sexo e UF;
- importação de naturalidade, filiação e data de batismo, mantendo compatibilidade com o modelo anterior de sete campos;
- rejeição de fórmulas e descarte explícito de colunas extras;
- equivalências de Cargo e estado civil persistidas por lote;
- detecção de CPF duplicado, nome/data, nome sem data e telefone informativo;
- decisões por linha: pular, restaurar, remover CPF/data opcional e aceitar possível duplicidade;
- confirmação em uma única RPC e um único bloqueio de `app_settings`;
- criação de membro, identidade sensível, Cargo e histórico na mesma transação;
- rastreabilidade por lote e linha, relatório sem exposição de CPF e auditoria resumida;
- desfazimento bloqueado quando existe qualquer alteração posterior no membro;
- filtro da listagem de membros pelo lote de origem;
- endereço opcional no formulário e nas RPCs de cadastro individual;
- suporte a `SEPARATED`, `MEMBER_IMPORTED` e `member_roles.title_variant`;
- permissão administrativa `members.import`.

## Banco de dados e segurança

As migrations criam `member_import_batches` e `member_import_items`, suas restrições, índices e políticas RLS. As funções expostas no schema público são `SECURITY INVOKER`; a lógica privilegiada fica no schema privado e repete autenticação, permissão, tenant e escopo de Congregação.

O projeto Supabase recebeu as migrations:

- `member_batch_import`;
- `member_import_index_hardening`;
- `member_import_duplicate_scope`;
- `member_import_history_stats`;
- `member_import_rollback_lock`;
- `member_import_extended_fields`.

O contrato TypeScript foi regenerado após as alterações.

## Performance

- nenhum RPC é chamado por membro na confirmação;
- o arquivo é lido uma única vez no servidor;
- consultas independentes de opções e duplicidades são paralelizadas;
- itens são inseridos em bloco durante a preparação;
- revisão e busca são paginadas no banco;
- a busca textual só é enviada a partir de três caracteres;
- os códigos automáticos são reservados com um único lock;
- índices cobrem filtros, relações e chaves estrangeiras do módulo;
- a auditoria detalhada por trigger é suprimida durante o lote, mantendo um evento resumido.

## Verificações executadas

- 14 testes unitários do parser, normalizadores e planilha-padrão;
- ESLint sem erros;
- TypeScript estrito sem erros;
- build de produção do Next.js concluído;
- auditoria npm sem vulnerabilidades conhecidas;
- advisor de segurança sem achados relativos ao novo módulo;
- advisor de performance sem novos alertas relativos à migration (somente índices ainda não utilizados, esperado em funcionalidade recém-instalada);
- ensaio transacional real `prepare → execute → rollback` com os 13 campos concluído dentro de uma transação revertida;
- verificação do ensaio confirmou sexo, naturalidade, filiação, batismo, variante feminina do Cargo e histórico de batismo sem deixar lote ou membro de teste.
