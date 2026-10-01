# Ficha do membro em PDF

## Como usar

1. Abra **Membros** e selecione **Ver ficha**.
2. Clique em **Baixar ficha em PDF**.
3. Mantenha as opções desmarcadas para imprimir apenas o cadastro, ou marque **Linha do tempo** e/ou **Eventos**.
4. Clique em **Baixar PDF**. O arquivo está preparado para impressão A4.

A ficha segue o modelo fornecido: cabeçalho da igreja, identificação do membro, vínculo, contato, família e histórico de fé. As seções adicionais começam em novas páginas. Conteúdos longos continuam em outras páginas, com identificação e numeração.

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
