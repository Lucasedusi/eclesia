import type { RegionReportDocument } from "../types/region-report.types";

export function regionReportFixture(kind: "simplified" | "individual" = "simplified"): RegionReportDocument {
  const regions = [{ id: "00000000-0000-4000-8000-000000000002", name: "Regional São José", coordinatorName: "Maria de Oliveira", coordinatorPhone: "(11) 99999-8888", description: "Congregações da região central e bairros próximos.", status: "ACTIVE" }];
  return {
    kind, issuedAt: "2026-11-04T17:00:00.000Z",
    church: { name: "Igreja Evangélica de Exemplo", logoDataUri: null, address: "Rua das Flores, 100, Centro, São Paulo, SP", phone: "(11) 3333-4444", document: "00.000.000/0001-00" },
    scopeLabel: "", filters: ["Ativas e inativas"], regions,
    region: kind === "individual" ? regions[0] : null,
    congregations: kind === "individual" ? [{ id: "c1", name: "Congregação Central", pastorName: "João de Souza", contactPhone: "(11) 98888-7777", status: "ACTIVE" }, { id: "c2", name: "Congregação Jardim das Flores", pastorName: "Não informado", contactPhone: "Não informado", status: "INACTIVE" }] : [],
  };
}
