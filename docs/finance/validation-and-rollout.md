# Financeiro — validação e implantação

## Escopo implementado

Área `/financeiro` com tema verde próprio, seleção de congregação/período, resumo, gráficos, lançamentos paginados, atendimento, comprovantes, caixas, demonstrativos e configurações. Categorias, departamentos com vigência de base, classificações de dízimo, métodos, caixas e regras por congregação são administráveis. Operadores regionais/de ministério podem receber uma congregação operacional compatível com seu acesso.

Entradas vinculam membro por busca restrita (nome, CPF, matrícula ou credencial), pessoa não cadastrada ou contribuição coletiva. Atendimento agrupa contribuições e gera um comprovante. Correções e cancelamentos preservam o histórico; transferências têm duas pontas atômicas. Arquivos são privados, verificados e disponibilizados por link temporário. Respostas perdidas reutilizam a tentativa original.

O demonstrativo é descritivo: gerar ou imprimir não cria despesas nem marca pagamentos. Regras e snapshots são versionados; alterações posteriores sinalizam versões desatualizadas.

## Evidências locais

- 399 testes Vitest em 77 arquivos: aprovados.
- Lint sem avisos e verificação de tipos: aprovados.
- Oito verificações SQL financeiras com rollback: acesso, atribuições, cadastros, comandos, identidade/anexos, consultas, impressão e demonstrativos.
- Concorrência real: repetição da mesma chave, correção com revisão desatualizada, contribuições distintas e geração simultânea com lançamento: aprovadas.
- Jornada integrada: caixa, ação administrativa negada a operador, saída com anexo e resposta perdida, transferência, câmera negada com alternativa manual, regra retroativa e versões preservadas: aprovada.
- Responsividade: 320, 375, 640 e 1024 pixels; 640 CSS px corresponde ao espaço de uma tela de 1280 px com zoom 200%. Foco em modal, preferência de movimento reduzido e guarda de alterações não salvas: aprovados. Capturas de visão geral e atendimento inspecionadas.
- Advisors locais: 16 avisos preexistentes em outras estruturas; nenhum erro nem alerta nas estruturas financeiras acrescentadas. Referências: [inicialização de RLS](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [políticas permissivas sobrepostas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).

- Compilação de produção: aprovada, com todas as rotas financeiras usando o streaming estabelecido.
- Navegador contra produção local: 24 aprovados e 4 não executados. Todos os 9 cenários financeiros foram aprovados. Após a inspeção visual, a classificação do dízimo foi limitada ao item correspondente; o cenário de atendimento/impressão foi novamente aprovado.
- Impressão: PDFs e capturas em 58 e 80 mm gerados e inspecionados, sem cortes. Não houve teste de impressão física porque nenhuma impressora foi disponibilizada.
- Cenários fora do financeiro não executados: gerenciador de documentos administrativos (a sessão não expõe a permissão/ação Categorias e tags); credencial física (falta E2E_CREDENTIAL_MEMBER_CODE); dois cenários da ficha PDF (falta E2E_SHEET_MEMBER_CODE e seus dados específicos).
- Dois testes antigos de navegação foram sincronizados com a navegação assíncrona e a cópia oculta do streaming; passaram sem alteração no comportamento das telas antigas.
- Análise de rotas: resumo 42,4 KB gzip; atendimento 171,4 KB; lançamentos 177,1 KB; demonstrativos 43,0 KB, conforme contagem dos manifests. O leitor QR é carregado quando solicitado.

## Validação online — 4 de outubro de 2026

As 14 migrações foram aplicadas com sucesso no projeto autorizado `dhgrfvakdbtedqfgecys`. O histórico online confirma as 14 versões. Não foram enviados seeds nem dados de teste; caixas e lançamentos continuaram vazios após a aplicação. Os tipos TypeScript foram regenerados do banco online e a verificação de tipos passou novamente.

Verificações de leitura confirmaram: todas as tabelas financeiras com RLS, bucket privado, ausência de UPDATE direto em lançamentos para usuários autenticados e nenhuma função financeira executável por acesso anônimo. As 14 funções financeiras `SECURITY DEFINER` têm `search_path` vazio e verificam acesso, permissão e escopo através das rotinas autorizadas. Os testes locais exercitaram tentativas sem permissão e entre igrejas/congregações.

Os Advisors online não reportaram nível ERROR. A triagem foi:

- **Segurança:** 56 avisos sobre funções `SECURITY DEFINER` executáveis por usuários autenticados, dos quais 14 são os comandos/consultas financeiros revisados. Essa execução é intencional: permite operações atômicas com validação interna sem conceder escrita direta nas tabelas. [Orientação do Advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- **Segurança:** um aviso de proteção contra senhas vazadas desativada, relativo à configuração geral do Auth, que não foi alterada neste módulo.
- **RLS sem política:** duas informações, incluindo `financial_operational_assignments`. A tabela financeira não concede acesso direto aos papéis público, anônimo ou autenticado; as atribuições passam exclusivamente pelas funções administrativas validadas. A ausência de política mantém a negação por padrão.
- **Desempenho:** 16 avisos em estruturas/políticas preexistentes, incluindo `accounts_payable`, fora dos fluxos implementados. Também há 141 informações de FKs sem índice composto cobrindo exatamente suas colunas e 343 de índices ainda sem uso. Entre as FKs informativas, 51 envolvem estruturas financeiras. Foram mantidos os índices de consulta por unidade/data, caixa, lançamento e transferência; referências de auditoria e FKs com índices existentes por identificador serão acompanhadas conforme volume e planos reais de consulta. Não se removeram índices recém-criados por ainda não haver uso em produção.

Portanto, a triagem não equivale a declarar todos os Advisors sem avisos. Os alertas intencionais e os pontos gerais de manutenção estão registrados acima.

## Reconciliação e cálculo

O saldo atual de cada caixa é a soma assinada do ledger: abertura + entradas − saídas + ajustes + transferências recebidas − transferências enviadas + reversões. Correção reverte o efeito anterior e acrescenta o novo. Nenhum registro do ledger é reescrito. A posição histórica filtra a data financeira; abertura dentro do mês aparece separadamente da arrecadação.

Exemplo verificado: R$ 15.000,00 na base + R$ 3.000,00 em Missões = R$ 18.000,00 recebidos. Repasse 30% = R$ 4.500,00; prebenda 35% = R$ 5.250,00; desconto de 10% da prebenda = R$ 525,00; sistema R$ 25,00, seguro R$ 86,00 e contador R$ 150,00. Catedral R$ 5.286,00; pastor líquido R$ 4.725,00; restante da distribuição R$ 4.989,00. O restante não é denominado saldo de caixa.

## Decisões de execução

- Execução direta e autorrevisão, sem subagentes, conforme solicitação. Não houve revisão independente por outro agente.
- Escritas financeiras serializadas por campo para preservar saldo e snapshots consistentes. Se houver contenção mensurável, reduzir a granularidade dos bloqueios preservando os testes de concorrência.
- Correção de um item de atendimento mantém pessoa, data, caixa e método comuns. Para mudar esses dados do conjunto, cancelar o atendimento e registrar novamente; os comprovantes anteriores permanecem.
- Código recuperado em uma área permanente após desaparecimento da área temporária durante a pausa. O histórico de commits preservou o backend; a interface foi reconstruída e testada novamente.
- Testes de navegador usam controles acessíveis visíveis: o streaming pode manter uma cópia oculta transitória. Áreas de rolagem das tabelas possuem posicionamento próprio para conter seus rótulos acessíveis.
- O Storage local 1.77.5 exigia índice com collation C para sua consulta de upload. Um índice de compatibilidade foi criado somente no banco local descartável, pela conta administrativa local. Essa correção não integra as migrações da aplicação nem será aplicada ao serviço online.

## Implantação e operação inicial

1. Projeto e histórico remoto confirmados, preservando as migrações existentes.
2. As 14 novas migrações foram aplicadas em ordem, de `20261003210334` a `20261004215459`. A primeira é um placeholder histórico vazio e permanece assim.
3. Tipos regenerados e RLS, privilégios, funções e bucket privado conferidos. Nenhum dado fictício ou seed foi enviado ao projeto online.
4. O código integra o projeto local; publicação da aplicação e envio ao repositório remoto não foram realizados nesta entrega. O ambiente de produção da aplicação usa suas credenciais habituais; o script local substitui o destino por localhost e nunca testa o financeiro com dados remotos.
5. O administrador cadastra departamentos, categorias, classificações, formas de pagamento, caixas/saldos de abertura e regras reais por congregação. Os percentuais de exemplo não são impostos como configuração de produção.
6. Conferir a primeira competência com a tesouraria e testar a impressão na impressora térmica disponível. O sistema registra solicitação ao navegador; não pode comprovar que o papel foi impresso.

Para alterações posteriores de esquema, criar migrações novas. Não reverter o ledger nem apagar histórico para corrigir lançamentos; usar as operações financeiras autorizadas.
