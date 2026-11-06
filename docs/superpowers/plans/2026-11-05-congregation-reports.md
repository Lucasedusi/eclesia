# Relatórios de congregações

Execução autorizada na branch `codex/relatorios-regionais`, sem subagentes.

## Escopo e decisões

- Listagem PDF/XLSX: Nº, congregação (regional menor abaixo no PDF; coluna própria no Excel), dirigente. Cônjuge, telefone e endereço opcionais e independentes.
- Padrão inicial: telefone selecionado; cônjuge e endereço desmarcados. Todas as combinações permitidas. PDF paisagem com endereço, retrato nas demais.
- Filtros: todas ou filtros atuais de busca, regional (inclusive sem regional), situação, sede/congregação e ordenação. Todas as páginas.
- Ficha PDF nos detalhes: identificação, liderança e contato (dirigente, contato prioritário, e-mail), endereço, observação. Omitir complemento e observação vazios. Nome em destaque; seções leves. WhatsApp → telefone → Não informado.
- Reutilizar identidade da igreja, fontes, rodapé e padrões de UI. Permissão própria `congregations.reports.export`, padrão ADMIN/SECRETARY, sem exigir edição. Preservar tenant, RLS, escopos, exclusão lógica e auditoria sem conteúdo pessoal.
- Migração apenas de catálogo/permissões, sem novas colunas. A autorização anterior de alteração do banco online permanece aplicável à permissão necessária; nenhum dado fictício online.
- Não publicar o aplicativo nem integrar à main nesta execução.

## Etapas

- [x] Contratos, serviço, permissão e testes de acesso/contato/filtros/paginação.
- [x] PDF com colunas adaptáveis e ficha em seções; Excel com colunas opcionais. Testes das 8 combinações e paginação, inspeção visual e regressão dos relatórios existentes.
- [x] Endpoint autenticado e UI; testes de download, campos, filtros, erro, móvel e acessos restritos.
- [x] SQL local, advisors, migração online conferida, lint/tipagem/testes/build/E2E, revisão direta, documentação e commit.

## Resultado

783 testes e 4 cenários E2E passaram, assim como lint, tipagem, build e SQL local. Revisão direta sem subagentes. Migração online aplicada e conferida. Tipos públicos idênticos; 13 avisos de desempenho preexistentes documentados em `docs/congregation-reports.md`. Ficha baixa diretamente dos detalhes, pois não há opções adicionais para essa modalidade.

Revisão solicitada após a entrega: ficha sem título Identificação, com Cônjuge e WhatsApp cadastrado, sem e-mail, dados em três colunas e rótulos cinza/valores escuros. Listagem mantém suas opções e prioridade de contato.
