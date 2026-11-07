import type { CongregationReportDocument, CongregationReportFields } from "../types/congregation-report.types";
export function congregationReportFixture(kind: "simplified" | "individual" = "simplified", fields: CongregationReportFields = { spouse: false, phone: true, address: false }): CongregationReportDocument {
  return { kind, fields, issuedAt: "2026-11-05T12:00:00.000Z", scopeLabel: "", filters: [],
    church: { name: "Igreja Evangélica de Exemplo", logoDataUri: null, pastorNames: ["Paulo", "Ana"], address: "Rua das Flores, 100, São Paulo, SP", phone: "(11) 3333-4444", document: "00.000.000/0001-00" },
    congregations: [{ id: "00000000-0000-4000-8000-000000000001", name: "Congregação Central", regionName: "Regional São José", pastorName: "João de Souza", spouseName: "Maria de Souza", contactPhone: "(11) 99999-8888", whatsapp: "(11) 99999-8888", notes: "Atendimento administrativo às terças e quintas-feiras.",
      address: { street: "Rua das Flores, 100", complement: "Salão 2", district: "Centro", city: "São Paulo", state: "SP", zipCode: "01001-000", full: "Rua das Flores, 100 · Salão 2 · Centro · São Paulo / SP · CEP 01001-000" } }] };
}
