# Ajustes finais de usabilidade do financeiro

Escopo aprovado: máscara automática de centavos; sidebar discreta; limpeza dos cabeçalhos; visão geral sem ação de nova entrada; estados vazios com ícone; filtros e tabela mais leves; títulos de identificação em negrito; botões de atendimento alinhados; impressão e relatórios com controles alinhados; congregação de operação no cadastro de usuários.

## Execução direta

1. Máscara compartilhada: distinguir digitação em centavos, colagem decimal e valores carregados. Cobrir edição, limpeza e ajustes negativos.
2. Centralização: carregar atribuições no cadastro de usuários apenas com a autorização financeira atual; reutilizar RPCs autenticadas e validações existentes. Remover a aba Operadores. Manter auditoria, alcance por congregação e definições existentes.
3. Aplicar ajustes visuais e de filtros, preservando carregamento, responsividade e acessibilidade.
4. Validar testes unitários, lint, tipos, build e fluxos locais autenticados. Revisão direta, sem subagentes.

Não é necessária migração: o local da configuração muda, mas a persistência e as regras de acesso continuam as mesmas. Convites passam a ter configuração operacional disponível no acesso criado após o aceite, como no fluxo existente.

## Resultado

- Digitação monetária automática por centavos, inclusive ajustes negativos. Valores carregados mantêm sua magnitude; colagem aceita valores formatados com vírgula ou ponto decimal. Os campos de eventos já utilizavam máscara automática.
- Congregação de operação em **Usuários e permissões → Editar acesso → Operação financeira**, disponível para quem já tem autorização para administrar o financeiro. O tesoureiro por congregação continua usando sua própria unidade automaticamente. Ao editar papel/escopo/situação, salve o acesso antes de definir a operação.
- A aba Operadores foi removida. As atribuições anteriores, auditoria e RPCs de autorização permanecem. Não houve alteração de esquema, migração ou escrita no banco online.
- Sidebar com chevron discreto, marca em peso 600 e retirada dos ícones decorativos dos cabeçalhos.
- Visão geral sem Nova entrada; estados vazios com ícone; tabela de lançamentos branca com marcador lateral por natureza; busca com limpeza e indicadores existentes; limpar filtros apenas na expansão avançada.
- Títulos de identificação em negrito; ações do atendimento com coluna fixa para ícone e separador; impressão alinhada; seletor e botão de relatório ocupando a linha disponível.

## Validação

- 461 testes unitários em 86 arquivos.
- Lint sem avisos e TypeScript sem erros.
- Build de produção com configuração do banco local.
- 21 testes de navegador: digitação, edição e colagem monetária, salvação de regras e teto, filtros, cadastro de usuários, escopo regional, lançamento/edição/cancelamento, atendimento, impressão em 58/80 mm, sidebar, layouts móveis e relatórios.
- Verificação SQL local de atribuições: bloqueio de autoatribuição e ampliação regional, isolamento de ministério, acesso anônimo negado. Dados fictícios revertidos ao final.
- Conferência visual das telas de atendimento, lançamentos, relatórios, visão geral e impressão.

A primeira medição automatizada da sidebar ocorreu antes da renderização completa. O teste passou a aguardar a tela visível, sem alteração das regras do produto.
