# Modelo final da carteirinha de membro

## Objetivo

Substituir a credencial física atual por um modelo CR80 fiel às referências aprovadas, com um único template SVG utilizado pela prévia e pelo PDF, QR Code real com validação pública revogável e isolamento integral por igreja.

## Visual e impressão

- Frente e verso em 85,60 x 53,98 mm, orientação horizontal e cantos arredondados.
- Paleta: azul-marinho `#082A5B`, dourado `#D4A72C`, azul-claro `#68C6E8` e marfim `#FBF8F0`.
- O desenho é vetorial e não usa as imagens de referência como fundo.
- O SVG usa `viewBox="0 0 856 539.8"`, margem segura de 30 unidades e fonte incorporada.
- Todo conteúdo textual permanece em uma linha. A fonte diminui progressivamente até o limite seguro; somente depois o valor é abreviado com reticências.
- CSS fica restrito ao modal, escala responsiva, sombra e apresentação na tela.
- O PDF contém duas páginas CR80. Cada página usa o SVG compartilhado rasterizado a 300 DPI e inserido por `pdf-lib`.

## Conteúdo

### Frente

- Logo configurada em `app_settings.logo_url`, com fallback para `churches.logo_url` e monograma seguro.
- Nome da igreja, endereço, telefone e CNPJ no cabeçalho.
- QR Code à esquerda.
- Nome, cargo, matrícula, congregação, CPF e data de nascimento.

### Verso

- Faixa decorativa curta sem o nome da igreja.
- Pai, mãe, naturalidade, batismo nas águas e data de emissão.
- Linha para assinatura.
- Rodapé institucional exatamente como aprovado.

## Dados existentes

Os campos visuais já existem: igreja e logo em `app_settings`/`churches`; dados institucionais em `churches`; nascimento, naturalidade, batismo e filiação em `members`; CPF em `member_sensitive_identity`; cargo em `member_roles`; congregação em `congregations`.

## Token e validação

- O token é aleatório, opaco, codificado em base64url e tem apenas seu SHA-256 persistido.
- Uma prévia cria token `PENDING` de curta duração sem revogar a credencial ativa.
- O PDF recebe somente o token, valida o hash e recarrega todos os dados no servidor.
- Após PDF e auditoria bem-sucedidos, o token passa a `ACTIVE` e o ativo anterior vira `REVOKED`.
- A credencial ativa pode ser revogada manualmente.
- A página `/verificar/membro/[token]` mostra somente validade, nome, igreja, congregação e emissão.
- CPF, nascimento, filiação, matrícula e IDs nunca aparecem na página pública nem no QR Code.
- Respostas privadas e públicas usam `Cache-Control: no-store`.

## Segurança

- `members.credentials.issue` é exigida em todas as operações internas.
- Todas as consultas internas incluem `church_id`, membro e exclusão lógica.
- A política de CPF permite leitura para emissão somente dentro do escopo do membro.
- A tabela de tokens tem RLS, grants mínimos, vínculo composto por igreja e nenhum acesso anônimo.
- O lookup público ocorre no servidor após validação estrita do token e retorna DTO mínimo.
- Emissão e revogação geram auditoria sem token, CPF ou outros dados pessoais.

## Banco remoto

A migration será criada e validada localmente. Ela não será aplicada ao Supabase remoto sem nova autorização explícita.
