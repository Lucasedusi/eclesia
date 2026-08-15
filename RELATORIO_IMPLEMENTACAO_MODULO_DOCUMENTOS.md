# Implementação — Módulo de documentos administrativos

Data: 14/08/2026

## Resultado

O módulo solicitado foi implementado integralmente na rota `/documentos`, com a
hierarquia `Categoria → Pasta/Dossiê → Documento`, acesso exclusivo ao
Administrador da Igreja e arquivos armazenados em bucket privado do Supabase.

## Componentes entregues

- central responsiva com indicadores, categorias, pastas e breadcrumb;
- cadastro, edição, arquivamento, restauração e lixeira de categorias e pastas;
- bloqueio da exclusão lógica de contêineres que ainda possuem conteúdo;
- movimentação confirmada de pasta entre categorias da mesma igreja;
- envio unitário ou múltiplo com resultado independente por arquivo;
- upload direto por URL temporária e ativação somente após validação no servidor;
- limite de 10 MB e validação de extensão, MIME e assinatura real do arquivo;
- suporte a PDF, JPEG/JPG, PNG, WEBP, DOC/DOCX e XLS/XLSX;
- limpeza de uploads e substituições pendentes abandonados;
- pré-visualização sob demanda de PDFs e imagens;
- download temporário com preservação do nome original;
- edição transacional de metadados e tags;
- substituição segura, preservando o arquivo atual em caso de falha;
- pesquisa por todos os metadados previstos e filtros combináveis;
- ordenação e paginação no servidor;
- visões separadas de ativos, arquivados e lixeira;
- exclusão física definitiva separada, confirmada e auditada;
- estados vazios, confirmações, loading e feedback por toast.

## Banco de dados e segurança

As migrations criam as permissões sensíveis `documents.view` e
`documents.manage`, as cinco tabelas do módulo, funções transacionais, índices,
triggers de integridade e auditoria, além do bucket privado
`administrative-documents` e suas políticas de Storage.

O isolamento por igreja e a exigência simultânea de acesso ativo, papel `ADMIN`
e escopo `CHURCH` são aplicados na navegação, página, Server Actions, serviços,
RLS e Storage. Um trigger também impede a concessão das permissões do módulo a
papéis não administrativos por sobrescrita individual.

Migrations do módulo:

- `administrative_documents_module`;
- `harden_administrative_documents`.

## Confiabilidade

- documentos começam como `PENDING` e só ficam visíveis após a confirmação;
- falhas parciais do envio múltiplo não revertem arquivos já concluídos;
- a remoção dos metadados pendentes só ocorre depois da remoção do objeto;
- substituições usam caminho pendente e troca atômica dos metadados;
- o arquivo anterior só é removido depois que o novo foi validado e ativado;
- associações de tags são idempotentes e protegidas por chave primária;
- nomes técnicos usam somente UUIDs da igreja, categoria, pasta e documento.

## Verificações executadas

- ESLint sem erros ou avisos do módulo;
- TypeScript sem erros;
- 16 testes automatizados existentes aprovados;
- build de produção do Next.js concluído, incluindo a rota `/documentos`;
- advisor do Supabase sem achados de segurança relativos ao módulo;
- todas as chaves estrangeiras do módulo com índices de suporte;
- ensaio transacional real com criação da hierarquia, ativação do documento,
  busca paginada, metadados, tags, arquivamento, lixeira e restauração;
- ensaio de RLS confirmando que um usuário `SECRETARY` não enxerga nem grava os
  registros administrativos;
- ensaio confirmando o bloqueio de sobrescrita de `documents.view` para usuário
  não administrativo;
- todas as massas de validação revertidas e ausência de registros de teste
  confirmada após os ensaios.
