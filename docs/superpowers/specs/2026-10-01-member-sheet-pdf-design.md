# Ficha de membro para impressão

## Escopo aprovado

Gerar um PDF A4 a partir do botão **Baixar ficha em PDF** no modal do membro. A ficha básica segue o modelo fornecido pelo usuário: cabeçalho da igreja, nome/matrícula/cargo/congregação, identificação e vínculo, contato/endereço/família e histórico de fé. O documento usa os valores atuais do cadastro.

Antes do download, duas opções desmarcadas permitem incluir **Linha do tempo** e **Eventos**. Eventos seguem exatamente a consulta do modal (inscrições individuais vinculadas ao membro, pagas ou sem pagamento necessário). Histórico usa os registros não sensíveis e a mesma tradução de valores da tela. Todas as páginas das consultas são carregadas.

Contribuições está fora desta entrega. Notas pastorais, registros sensíveis, documentos anexados e observações internas não entram no PDF. Não criar novas opções para esses conteúdos.

## Fluxo e autorização

- Exigir as permissões existentes `members.view_basic`, `members.view_full` e `members.export` para a ficha.
- Verificar separadamente `member_history.view` e as permissões de eventos quando essas seções forem pedidas; CPF/RG somente com `members.view_sensitive_identity`, cargo somente com `member_roles.view`.
- Usar cliente autenticado, RLS, igreja ativa, identificador do membro e exclusão lógica em todas as consultas. Membro arquivado não pode gerar ficha.
- Gerar no servidor por POST autenticado, com validação estrita, proteção de origem e limite real do corpo. Nunca aceitar campos cadastrais ou igreja do navegador.
- Registrar a emissão na auditoria existente sem conteúdo pessoal, devolver PDF privado sem cache e não persistir o arquivo no banco/Storage.

## Apresentação

Usar `pdf-lib`, fontes Rubik locais e o carregador de logotipo existente. Manter azul-marinho, faixa dourada e cartões claros do modelo, com texto selecionável. Conteúdo longo quebra linha e pode continuar em outra página; não cortar dados nem reduzir a fonte indiscriminadamente. Seções opcionais começam após a ficha básica, com identificação do membro, data de emissão e paginação. Seção selecionada sem dados informa a ausência de registros.

## Execução e entrega

Execução integral nativa nesta conversa, sem subagentes, autorizada pelo usuário. A autorização para migrações online existe, mas a solução reutiliza esquema/permissões/auditoria e não prevê migração. Trabalhar na branch `codex/member-sheet-pdf` do checkout local. Validar regras, PDF e fluxo no navegador e entregar ZIP do código-fonte com `.env.example`, sem credenciais, dependências, cache, dados de teste ou artefatos de desenvolvimento.
