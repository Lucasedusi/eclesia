# Ficha do membro em PDF

## Como usar

1. Abra **Membros** e selecione **Ver ficha**.
2. Clique em **Baixar ficha em PDF**.
3. Mantenha as opções desmarcadas para imprimir apenas o cadastro, ou marque **Linha do tempo** e/ou **Eventos**.
4. Clique em **Baixar PDF**. O arquivo está preparado para impressão A4.

A ficha segue o modelo fornecido: cabeçalho da igreja, identificação do membro, vínculo, contato, família e histórico de fé. As seções adicionais começam em novas páginas. Conteúdos longos continuam em outras páginas, com identificação e numeração.

A identificação inclui nacionalidade, naturalidade com UF de nascimento, profissão e escolaridade. Esses são os únicos novos dados pessoais incluídos na revisão de novembro de 2026. Naturalidade exibe `Cidade / UF`; quando apenas uma parte existe, exibe somente essa parte. Dados pessoais não preenchidos mostram “Não informado”.

Contato e família ficam juntos; endereço tem seção própria, com logradouro/número, complemento quando preenchido, bairro, cidade, estado e CEP formatado. Os campos são distribuídos em três colunas, com rótulos cinza e valores escuros, sem os antigos cartões. A ficha pode ocupar mais de uma página conforme os textos, sem reduzir a fonte para forçar uma única folha. O título da seção acompanha o primeiro campo na quebra de página.

A logo cadastrada aparece como marca d'água centralizada, proporcional e com 5% de opacidade em todas as páginas. O cabeçalho mostra os nomes existentes de Pastor Presidente e Cônjuge do Pastor Presidente abaixo do nome da igreja, inclusive nas páginas seguintes. Nomes vazios são omitidos; logo ausente ou inválida não impede o download. Os fundos das linhas de eventos permitem visualizar discretamente a marca d'água.

Eventos usam a mesma consulta da aba do membro: inscrições individuais pagas ou que não exigem pagamento, sem exigir check-in. Todas as páginas são incluídas. Uma seção sem registros exibe essa informação.

Contribuições permanece para uma próxima entrega. Notas pastorais, histórico marcado como sensível, documentos anexados e observações internas não são exportados.

## Acesso e funcionamento

- A emissão exige `members.view_basic`, `members.view_full` e `members.export`.
- Histórico e eventos dependem das permissões das respectivas abas; CPF/RG e cargo respeitam suas permissões específicas.
- Membros arquivados ou fora da igreja/escopo autorizado não podem ser exportados.
- O servidor consulta os dados atuais, gera o PDF e registra a emissão na auditoria existente. O arquivo não é armazenado no banco nem no Storage.
- A auditoria registra identificação do recurso, opções e quantidades, sem copiar o conteúdo pessoal da ficha.
- Se a consulta ou auditoria falhar, o download não é liberado. Alterações detectadas na paginação interrompem a geração para permitir uma nova tentativa.
- O limite é de 10.000 registros por seção. Acima disso, a interface informa que a seção precisa ser desmarcada; não há truncamento silencioso.
- Não há novas dependências ou migrações.

## Verificação da entrega — 01/10/2026

- `npm run lint -- --max-warnings=0`: aprovado.
- `npm run typecheck`: aprovado.
- `npm test`: 371 testes aprovados em 64 arquivos.
- `npm run build -- --webpack`: compilação de produção aprovada; rota e fontes locais incluídas no pacote do servidor.
- PDFs sintéticos: ficha básica, seções completas, textos extensos e logotipos PNG/WebP. Verificados formato A4, conteúdo, limites de página e apresentação visual.
- Revisão realizada pelo próprio implementador, sem subagentes, por solicitação do usuário.

### Limitações da verificação

O build padrão com Turbopack foi bloqueado pelo ambiente ao tentar abrir uma porta para o processo do compilador. A compilação foi validada com Webpack, sem alterar o comando padrão do projeto.

Os dois testes em `e2e/member-sheet.spec.ts` foram coletados e ignorados por ausência de `E2E_STORAGE_STATE` e `E2E_SHEET_MEMBER_CODE`. A inicialização do banco local e da prévia da interface foi recusada, portanto o fluxo autenticado e a inspeção visual da nova janela no navegador permanecem pendentes. Não foram usados dados reais para suprir essa ausência.

Para executar em um ambiente de teste autorizado, disponibilize uma sessão com as permissões acima, um membro identificado por `E2E_SHEET_MEMBER_CODE` e uma aplicação em execução:

```sh
E2E_BASE_URL=http://127.0.0.1:3000 \
E2E_STORAGE_STATE=/caminho/seguro/sessao-teste.json \
E2E_SHEET_MEMBER_CODE=MEM0001 \
npm run test:e2e -- e2e/member-sheet.spec.ts
```

Não inclua o arquivo de sessão no repositório ou no ZIP. Os testes de emissão geram registros de auditoria no ambiente escolhido.

## Revisão de dados pessoais — 06/11/2026

- Novas colunas consultadas em `members`: `nationality`, `natural_city`, `natural_state`, `profession` e `education_level`. Nenhum campo adicional de membro foi acrescentado. Não houve migração nem alteração de tipos gerados.
- Consultas continuam autenticadas e restritas à igreja, ao membro e à exclusão lógica. Identidade sensível, cargo, histórico e eventos preservam suas permissões. Observações gerais/pastorais, país, tipo de cadastro e igrejas de origem continuam fora do PDF.
- Execução e revisão pelo próprio agente, sem subagentes, por solicitação do usuário. Nenhum acesso ao banco online foi necessário.
- 804 testes automatizados passaram, incluindo novos campos, naturalidade parcial/vazia, dados ausentes, nomes pastorais, logo inválida, marca d'água, paginação e título acompanhado do primeiro campo. Lint sem avisos, tipagem e build de produção passaram.
- PDFs fictícios sem logo, com logo PNG/WebP, múltiplas páginas e textos extensos foram renderizados e inspecionados.
- Os 2 cenários Playwright passaram em ambiente local: download básico/com histórico e eventos, erro recuperável e retorno em tela móvel. Os PDFs baixados foram reabertos para confirmar os novos valores, os nomes pastorais, o CEP formatado e a ausência das observações internas. O teste de erro passou a localizar a mensagem dentro do modal, sem confundi-la com o anunciador de rotas do Next.js.
- Testes de navegador devem usar `localhost` neste endpoint: o Next.js normaliza endereços de loopback em `request.url`, e a proteção de origem existente compara essa URL com `Origin`. A revisão não modifica essa proteção.
- Análise de desempenho de rotas e checks de alteração de banco não se aplicam: não houve mudança de rotas, cache, schema ou políticas.
