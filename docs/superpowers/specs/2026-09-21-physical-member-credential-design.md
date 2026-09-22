# Credencial física de membro

## Objetivo

Permitir que um usuário autenticado e autorizado gere, dentro do ambiente administrativo, uma credencial física de membro com frente e verso, pronta para impressão no formato de cartão CR80. A credencial usa os dados atuais do Supabase online, não cria uma identidade digital e não oferece validação pública nesta primeira versão.

## Escopo da primeira versão

- Geração individual a partir dos detalhes de um membro.
- Pré-visualização moderna da frente e do verso antes do download.
- PDF vetorial com duas páginas no tamanho físico de `85,60 × 53,98 mm`.
- Cabeçalho com o nome de exibição da igreja na frente e no verso.
- Frente com QR Code demonstrativo, nome completo, Cargo, número de matrícula e congregação.
- Verso com data do batismo, nome da mãe e nome do pai.
- Paleta baseada na cor primária configurada para a igreja, com fallback para `#415BA5`.
- Autorização por permissão própria, isolamento por igreja e registro de auditoria.
- Download sob demanda; o PDF não será armazenado no Supabase Storage.

## Fora do escopo

- Foto do membro.
- Credencial digital, carteira virtual ou página pública.
- QR Code funcional, token, assinatura ou consulta de autenticidade.
- Emissão em lote.
- Validade, data de cadastro, assinatura manual ou assinatura do pastor.
- Armazenamento, reimpressão por histórico ou revogação da credencial.
- Personalização livre de layout pelo usuário.

## Abordagens consideradas

### PDF vetorial gerado no servidor — escolhida

Usar `pdf-lib`, já presente no projeto, para desenhar frente e verso com dimensões físicas exatas. Essa abordagem oferece impressão previsível, texto nítido, nenhuma dependência nova e mantém dados pessoais fora do cliente até o download autorizado.

### Página HTML/CSS para impressão

Seria mais rápida para prototipar, mas impressão pelo navegador varia entre sistemas, margens, escalas e drivers. Não é adequada como saída principal de um cartão físico.

### Imagem-base com textos sobrepostos

Facilitaria reproduzir um único modelo, mas dificultaria contraste dinâmico, nomes longos, manutenção e adaptação às cores da igreja. Também produziria resultado menos nítido que um PDF vetorial.

## Experiência administrativa

O ponto de entrada será a área de detalhes do membro, junto das ações administrativas existentes. A ação `Gerar credencial` só aparece para usuários com a permissão de emissão.

Ao selecionar a ação, um modal apresenta:

- miniatura da frente;
- miniatura do verso;
- aviso quando algum campo opcional não estiver cadastrado;
- botão primário `Baixar PDF`;
- botão secundário `Cancelar`.

A pré-visualização e o PDF usam o mesmo DTO e as mesmas regras de formatação para evitar diferenças entre o que o usuário vê e o arquivo baixado. O download só é habilitado quando os campos obrigatórios estiverem válidos.

## Direção visual

A referência fornecida orienta a composição horizontal, o cabeçalho forte, as curvas decorativas e a hierarquia de identificação. Marca, textos, amarelo dominante, assinatura e validade da referência não serão copiados.

### Paleta

- Primária: `app_settings.primary_color`, validada como hexadecimal.
- Fallback: `#415BA5`.
- Primária escura: derivada da cor principal, com fallback `#354B8E`.
- Superfície: `#FFFFFF` e `#F2F4F7`.
- Texto: `#101828` e `#344054`.
- Contraste: texto branco ou escuro escolhido de acordo com a luminância da cor primária.

### Frente

- Faixa superior com o nome da igreja em branco.
- Formas curvas discretas em tons da cor primária, sem comprometer a leitura.
- Nome completo como elemento de maior destaque, com até duas linhas.
- Cargo imediatamente abaixo do nome.
- Matrícula e congregação em blocos compactos e bem rotulados.
- QR Code demonstrativo no lado direito.
- Texto pequeno `VALIDAÇÃO EM BREVE` abaixo do QR para não sugerir uma função inexistente.

Sem a foto, o conteúdo ocupa uma grade ampla, equilibrada entre identificação e QR Code. Não haverá espaço vazio reservado para imagem.

### Verso

- Mesmo cabeçalho e linguagem visual da frente.
- Três blocos de informação: data do batismo, nome da mãe e nome do pai.
- Rótulos pequenos em caixa alta e valores com boa legibilidade.
- Rodapé `Documento de identificação eclesiástica`.
- Sem assinatura, validade ou informações sensíveis não solicitadas.

### QR Code demonstrativo

O QR inicial será um padrão vetorial estático e não decodificável. Ele não conterá identificador, URL, token ou dado do membro. O espaço e o contrato visual serão mantidos para uma futura validação real sem exigir redesenho da credencial.

## Dados e regras de apresentação

| Campo | Origem | Regra |
| --- | --- | --- |
| Nome da igreja | `app_settings.display_church_name`, fallback `churches.name` | obrigatório |
| Cor primária | `app_settings.primary_color` | fallback `#415BA5` |
| Nome completo | `members.full_name` | obrigatório; até duas linhas |
| Cargo | Cargo ativo em `member_roles` e `roles` | usar nome feminino quando aplicável; fallback `Sem cargo cadastrado` |
| Matrícula | `members.member_code` | obrigatório |
| Congregação | `congregations.name` | obrigatório |
| Data do batismo | `members.baptism_date` | formatar `dd/MM/yyyy`; fallback `Não informado` |
| Nome da mãe | `members.mother_name` | fallback `Não informado` |
| Nome do pai | `members.father_name` | fallback `Não informado` |

A emissão é permitida somente para membro não arquivado, com `member_status = 'ACTIVE'` e `member_type = 'MEMBER'`. Nome, matrícula e congregação ausentes bloqueiam a emissão com orientação para corrigir o cadastro. Cargo, batismo e filiação ausentes não bloqueiam e são apresentados com fallback explícito.

## Arquitetura

### Contrato de dados

Um serviço `server-only` monta um DTO mínimo de pré-visualização. Ele consulta somente os campos usados na credencial, sempre com `church_id`, `member_id` e `deleted_at is null`, respeitando o escopo do usuário autenticado.

O DTO contém:

- identificação da igreja e cor primária;
- identificação e elegibilidade do membro;
- Cargo ativo já formatado;
- campos da frente e do verso;
- lista de avisos não bloqueantes;
- instante de emissão usado apenas nos metadados do PDF e na auditoria.

Nenhum CPF, RG, telefone, endereço, observação pastoral ou documento será carregado.

### Componentes

- Ação visual na área de detalhes do membro.
- Modal cliente para estado de carregamento, pré-visualização, avisos e download.
- Server Action para obter o DTO de pré-visualização autorizado.
- Serviço de domínio para consulta, elegibilidade e formatação.
- Serviço de PDF isolado, responsável apenas pelo desenho vetorial.
- Route Handler autenticado para responder o PDF como `attachment`.
- Testes focados no serviço de domínio, PDF, autorização e fluxo administrativo.

### Fluxo

1. O usuário abre os detalhes de um membro acessível no seu escopo.
2. A interface exibe `Gerar credencial` somente com a permissão necessária.
3. A Server Action repete autenticação, permissão, igreja e escopo do recurso.
4. O serviço busca os dados atuais e devolve o DTO mínimo.
5. O modal renderiza frente e verso com os mesmos valores do DTO.
6. Ao baixar, o Route Handler repete todas as verificações e busca novamente os dados atuais.
7. O servidor gera o PDF de duas páginas, registra a auditoria e responde com `Cache-Control: no-store`.

O cliente nunca fornece `church_id`, Cargo, matrícula, nomes ou cor confiáveis ao gerador. O único identificador recebido é o `memberId`, validado novamente no servidor.

## Autorização e banco

Será criada a permissão sensível `members.credentials.issue`, concedida por padrão a `ADMIN` e `SECRETARY`. A permissão continuará configurável pelas regras existentes de acesso e sobrescritas.

Tanto a pré-visualização quanto o download exigem:

- sessão autenticada;
- `members.credentials.issue`;
- acesso à igreja ativa;
- acesso ao membro dentro do escopo `CHURCH`, `REGION`, `CONGREGATION` ou `MINISTRY` aplicável;
- membro pertencente à mesma igreja.

Uma nova migração adicionará apenas o catálogo e as concessões padrão dessa permissão. Não será criada tabela de credenciais. O registro de emissão usará a auditoria existente com ação `ISSUE_MEMBER_PHYSICAL_CREDENTIAL`, entidade `MEMBER`, identificador do membro e metadados não sensíveis sobre o resultado.

## Segurança e privacidade

- Não haverá endpoint público.
- O PDF terá `Cache-Control: private, no-store` e não será persistido.
- A resposta não será armazenada em cache compartilhado.
- O serviço usará o cliente Supabase autenticado; cliente administrativo não é necessário para a leitura.
- Toda consulta incluirá igreja e membro, preservando RLS e escopo organizacional.
- Dados pessoais não serão registrados em logs ou metadados de auditoria.
- O nome do arquivo será derivado de matrícula sanitizada, sem nome completo.
- Erros internos serão convertidos em mensagens administrativas seguras.

## Tratamento de erros

- Sem sessão: redirecionamento ou resposta `401` conforme a entrada.
- Sem permissão ou fora do escopo: mensagem genérica e resposta `403`.
- Membro inexistente, arquivado ou de outra igreja: resposta genérica `404`.
- Membro inelegível: mensagem explicando que apenas membros ativos podem receber a credencial.
- Nome, matrícula ou congregação ausentes: bloqueio com lista dos campos a corrigir.
- Falha de geração: resposta `500` genérica, sem detalhes do banco ou do PDF.
- Falha de auditoria: a emissão falha; não será entregue um PDF sem rastreabilidade.

## Testes e validação

### Unidade

- Mapeamento correto dos campos do banco para o DTO.
- Cargo com nome masculino ou feminino conforme o cadastro.
- Elegibilidade por status, tipo e arquivamento.
- Bloqueio de campos obrigatórios.
- Fallbacks de Cargo, batismo e filiação.
- Sanitização do nome do arquivo e formatação de datas.
- Contraste e derivação de cor para valores claros e escuros.

### PDF

- Exatamente duas páginas.
- Cada página com `85,60 × 53,98 mm`.
- Metadados sem dados pessoais desnecessários.
- Textos longos ajustados sem ultrapassar a área segura.
- QR demonstrativo sem conteúdo decodificável.
- Renderização da frente e do verso verificada visualmente em PNG.

### Autorização

- Permissão ausente.
- Membro de outra igreja.
- Membro fora do escopo de congregação/região/ministério.
- Membro arquivado ou inelegível.
- Usuário autorizado dentro do escopo.

### Interface e integração

- A ação aparece apenas para usuários autorizados.
- Modal representa carregamento, avisos, bloqueios e sucesso.
- Download usa o Route Handler autenticado.
- Cabeçalhos impedem cache compartilhado.
- Fluxo E2E de pré-visualização e download.

### Banco online

- Migração aplicada somente após revisão explícita do dry-run.
- Histórico local de migrações e remoto alinhado.
- Permissão e concessões padrão confirmadas por consulta.
- Advisors de segurança e desempenho executados após a migração.

## Critérios de aceite

- Um usuário autorizado consegue gerar uma credencial moderna, legível e pronta para impressão a partir dos detalhes de um membro elegível.
- Frente e verso usam o nome e a cor primária da igreja e exibem exatamente os campos definidos no escopo.
- Não há foto, QR funcional, validação pública, armazenamento do PDF ou tabela de credenciais.
- Usuários sem permissão e acessos entre igrejas ou fora de escopo são bloqueados no servidor.
- O PDF possui duas páginas CR80 e corresponde à pré-visualização.
- Cada emissão bem-sucedida gera auditoria sem registrar dados pessoais.
- Testes automatizados, lint, typecheck, build e fluxo E2E afetado passam antes da entrega.
