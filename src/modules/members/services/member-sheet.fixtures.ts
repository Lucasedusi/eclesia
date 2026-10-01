import type { MemberSheetDocument } from "../types/member-sheet.types";

/** Synthetic data only; shared by PDF layout tests and the optional local QA output. */
export function memberSheetFixture(): MemberSheetDocument {
  const fields = (items: [string, string][]) => items.map(([label, value]) => ({ label, value }));
  return {
    issuedAt: "2026-10-01T17:30:00.000Z", fileName: "ficha-membro-MEMTESTE.pdf",
    church: { name: "Igreja Evangélica Assembleia de Deus", logoDataUri: null, address: "Rua de Exemplo, 100, Centro, Goiânia, GO", phone: "(62) 3333-0000", document: "00.000.000/0001-00" },
    member: { fullName: "Ana Maria de Oliveira — Exemplo", memberCode: "MEMTESTE", role: "Diaconisa", congregationName: "Congregação Central" },
    groups: [
      { title: "Identificação e vínculo", fields: fields([
        ["Situação", "Ativo"], ["Nascimento", "10/02/1990"], ["Sexo", "Feminino"],
        ["Estado civil", "Casada"], ["CPF", "Não informado"], ["RG / órgão", "Não informado"],
      ]) },
      { title: "Contato, endereço e família", fields: fields([
        ["WhatsApp", "(62) 99999-0000"], ["E-mail", "ana@example.invalid"], ["Endereço", "Rua de Exemplo, 50, Setor Central, Goiânia, GO, 74000-000"],
        ["Pai", "Antônio de Oliveira"], ["Mãe", "Maria de Oliveira"], ["Cônjuge", "João de Exemplo"],
      ]) },
      { title: "Histórico de fé", fields: fields([
        ["Conversão", "10/01/2010"], ["Batismo nas águas", "20/02/2011"], ["Igreja do batismo", "Assembleia de Deus"],
        ["Batismo com Espírito Santo", "Sim · Data não informada"], ["Recebido por", "Carta de transferência"], ["Data de recebimento", "15/03/2015"],
      ]) },
    ],
    history: null, events: null,
  };
}

export function completeMemberSheetFixture(): MemberSheetDocument {
  return {
    ...memberSheetFixture(),
    history: Array.from({ length: 26 }, (_, index) => ({ date: "01/10/2026", title: `Registro de teste ${index + 1}`, change: "Inativo → Ativo", description: "Registro eclesiástico de exemplo, com acentuação e informações de participação na congregação. ".repeat(index === 5 ? 30 : 2) })),
    events: Array.from({ length: 28 }, (_, index) => ({ name: `Evento de exemplo ${index + 1}`, date: "01/10/2026, 19:00", location: "Templo Central · Goiânia / GO" })),
  };
}
