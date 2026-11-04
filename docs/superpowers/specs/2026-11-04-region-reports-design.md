# Relatórios de regionais

## Escopo autorizado

Implementação direta, sem subagentes, na branch `codex/relatorios-regionais`.
O usuário autorizou alterações no banco online vinculado. Preservar dados reais e
executar testes com dados sintéticos somente no ambiente local.

- Lista simplificada: nome da regional, coordenador e telefone do coordenador; PDF e XLSX.
- Ficha individual: nome, coordenador, telefone, descrição preenchida e congregações com nome, dirigente e contato; PDF.
- Contato da congregação: WhatsApp, depois Telefone, depois `Não informado`.
- Botão de relatórios somente com ícone ao lado do cadastro, com nome acessível.
- Modal geral: Lista simplificada ou Ficha da regional (seleção de uma regional).
- Detalhes: `Imprimir / PDF` abre a mesma ficha, preservando retorno aos detalhes e fechamento por X/Esc.
- Lista simplificada oferece todas as regionais ou filtros atuais; todos os resultados, não só a página da tela.
- Status todas/ativas/inativas. Arquivadas nunca entram. Congregações inativas são identificadas.
- Padrão visual da ficha do membro: identidade da igreja, Rubik, azul/dourado, A4, rodapé e páginas.

## Abordagem

Reutilizar as bibliotecas instaladas pdf-lib/fontkit/sharp e ExcelJS. Extrair somente
fontes, quebra de texto, identidade visual e rodapé compartilhados com a ficha de membro;
manter conteúdo e consulta dos relatórios no domínio de organização. A alternativa de
copiar integralmente o gerador duplicaria a manutenção; impressão do HTML não preservaria
o modelo documental de forma previsível.

## Segurança e integridade

Nova permissão `regions.reports.export`, combinada com `organization.view`, concedida
por padrão a ADMIN e SECRETARY, como a exportação de membros. Não exige edição.
Cliente autenticado, RLS, igreja do contexto, escopos existentes e exclusão lógica.
Exportações com escopo restrito trazem indicação de que incluem somente registros
autorizados. Serviço confere a regional e acesso também ao entrar pela URL.
Consultas explícitas e paginadas com contagem consistente, IDs únicos e limite de
10.000 registros por coleção; sem truncamento silencioso. Dados atuais sem cache de
download. Auditoria obrigatória sem conteúdo pessoal. Falha de consulta/auditoria
impede download. Sem persistência de arquivos no Storage.

## Verificação

Testes de permissões, escopo, contatos, filtros, paginação, ausência de dados, erro de
auditoria e endpoint. PDFs sintéticos com conteúdo longo, logo e várias páginas;
XLSX reaberto para conferir dados, contatos como texto e formatação. Fluxo E2E com
sessão sintética local. Lint, typecheck, suíte completa, build, SQL e advisors.
