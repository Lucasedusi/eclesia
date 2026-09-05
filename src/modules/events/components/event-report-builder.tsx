"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Columns3,
  Download,
  Eye,
  FileBarChart2,
  FileText,
  Info,
  ListTree,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  SlidersHorizontal,
  UsersRound,
  WalletCards,
  Bus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  PAYMENT_STATUSES,
  REGISTRATION_STATUSES,
  eventLabel,
} from "../constants/events";
import type {
  EventFinancialReportColumns,
  EventFinancialReportConfig,
  EventFinancialReportPreview,
  EventFinancialReportSections,
  EventCaravanReportColumns,
  EventCaravanReportConfig,
  EventCaravanReportPreview,
  EventGeneralReportColumns,
  EventGeneralReportConfig,
  EventGeneralReportFilters,
  EventGeneralReportPreview,
  EventGeneralReportSections,
  EventParticipantReportColumns,
  EventParticipantReportConfig,
  EventParticipantReportPreview,
  EventWorkspaceData,
} from "../types/event.types";
import * as R from "./event-report-builder.styles";

type Notice = { message: string; danger?: boolean };
type BusyKind = "preview" | "inline" | "download" | null;
type ReportKind = "general" | "participants" | "financial" | "caravans";

const paymentMethods = [
  ["PIX", "PIX"],
  ["CASH", "Dinheiro"],
  ["CREDIT_CARD", "Cartão de crédito"],
  ["DEBIT_CARD", "Cartão de débito"],
  ["NOT_APPLICABLE", "Não aplicável"],
] as const;

const steps = [
  "Tipo de relatório",
  "Filtros",
  "Conteúdo e colunas",
  "Organização",
  "Revisão e geração",
];

function defaultGeneralConfig(): EventGeneralReportConfig {
  return {
    filters: {
      regionId: "",
      congregationId: "",
      roleId: "",
      gender: "",
      registrationStatus: "",
      paymentMethod: "",
      paymentStatus: "",
      itemId: "",
      registeredFrom: "",
      registeredTo: "",
    },
    sections: {
      showSummary: true,
      showRegions: true,
      showCongregations: true,
      showRoles: false,
      showGenders: false,
      includeZeroCongregations: true,
      showAppliedFilters: true,
      showIssuedAt: true,
    },
    columns: {
      regionalCoordinator: true,
      regionalQuota: true,
      regionalPercentage: false,
      congregationPastor: true,
      congregationQuota: true,
      congregationPercentage: false,
    },
    organization: "BY_REGION",
  };
}

function defaultParticipantConfig(): EventParticipantReportConfig {
  return {
    filters: defaultGeneralConfig().filters,
    columns: {
      index: true,
      registrationNumber: false,
      role: true,
      gender: true,
      phone: false,
      registrationStatus: false,
      paymentMethod: false,
      paymentStatus: false,
      registeredAt: true,
      items: false,
    },
    organization: "BY_REGION",
    showAppliedFilters: true,
    showIssuedAt: true,
  };
}

function defaultFinancialConfig(): EventFinancialReportConfig {
  return {
    scope: "GENERAL",
    filters: defaultGeneralConfig().filters,
    expenseFilters: { name: "", from: "", to: "" },
    sections: {
      showSummary: true,
      showPaymentMethods: true,
      showItems: true,
      showExpenses: true,
      showAppliedFilters: true,
      showIssuedAt: true,
    },
    columns: {
      summaryExpectedAmount: false,
      summaryPendingAmount: false,
      summaryPaidRegistrationCount: true,
      paymentConfirmedCount: true,
      paymentPercentage: false,
      itemParticipantCount: true,
      itemExpectedAmount: true,
      expenseIndex: true,
      expenseReceipt: true,
    },
    organization: "HIGHEST_VALUE",
    expenseOrganization: "DATE_DESC",
  };
}

function defaultCaravanConfig():EventCaravanReportConfig{return{filters:{city:"",state:"",source:"",paymentStatus:"",registeredFrom:"",registeredTo:""},columns:{index:true,originChurch:true,responsible:false},organization:"HIGHEST_REGISTRATIONS",showAppliedFilters:true,showIssuedAt:true};}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}

function listEnabledSections(config: EventGeneralReportConfig) {
  return [
    config.sections.showSummary && "Resumo geral",
    config.sections.showRegions && "Inscrições por regionais",
    config.sections.showCongregations && "Inscrições por congregações",
    config.sections.showRoles && "Inscrições por cargos",
    config.sections.showGenders && "Inscrições por sexo",
  ].filter(Boolean).join(", ");
}

function listEnabledGeneralColumns(config: EventGeneralReportConfig) {
  return [
    "Nomes e inscrições",
    config.columns.regionalCoordinator && "Coordenador",
    config.columns.congregationPastor && "Pastor dirigente",
    (config.columns.regionalQuota || config.columns.congregationQuota) && "Meta/cota",
    (config.columns.regionalPercentage || config.columns.congregationPercentage) && "% da meta",
  ].filter(Boolean).join(", ");
}

function listEnabledParticipantColumns(config: EventParticipantReportConfig) {
  return [
    "Nome do participante",
    "Congregação + Regional",
    config.columns.index && "Índice (#)",
    config.columns.registrationNumber && "Número da inscrição",
    config.columns.role && "Cargo",
    config.columns.gender && "Sexo",
    config.columns.phone && "Telefone",
    config.columns.registrationStatus && "Situação da inscrição",
    config.columns.paymentMethod && "Forma de pagamento",
    config.columns.paymentStatus && "Situação do pagamento",
    config.columns.registeredAt && "Data da inscrição",
    config.columns.items && "Itens selecionados",
  ].filter(Boolean).join(", ");
}

function listEnabledFinancialSections(config: EventFinancialReportConfig) {
  return [
    config.sections.showSummary && "Resumo financeiro",
    config.sections.showPaymentMethods && "Valores por forma de pagamento",
    config.sections.showItems && "Itens selecionados",
    config.sections.showExpenses && "Despesas do evento",
  ].filter(Boolean).join(", ");
}

function listEnabledFinancialColumns(config: EventFinancialReportConfig) {
  const includesEntries = config.scope !== "EXPENSES_ONLY" || config.sections.showPaymentMethods || config.sections.showItems;
  const includesExpenses = config.scope !== "ENTRIES_ONLY" || config.sections.showExpenses;
  return [
    includesEntries && "Total recebido",
    includesExpenses && "Total de despesas",
    includesEntries && includesExpenses && "Saldo",
    includesEntries && config.columns.summaryExpectedAmount && "Valor previsto",
    includesEntries && config.columns.summaryPendingAmount && "Valor pendente",
    includesEntries && config.columns.summaryPaidRegistrationCount && "Inscrições pagas",
    config.columns.paymentConfirmedCount && "Pagamentos confirmados",
    config.columns.paymentPercentage && "% do total",
    "Unidades dos itens",
    config.columns.itemParticipantCount && "Participantes por item",
    config.columns.itemExpectedAmount && "Valor previsto dos itens",
    config.columns.expenseIndex && "Índice das despesas",
    config.columns.expenseReceipt && "Comprovante das despesas",
  ].filter(Boolean).join(", ");
}

function responseFileName(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

function ToggleOption({
  label,
  description,
  checked,
  locked = false,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <R.ToggleOption $checked={checked} $locked={locked}>
      <input type="checkbox" checked={checked} disabled={locked} onChange={(event) => onChange?.(event.target.checked)} />
      <span>{checked ? <Check /> : null}</span>
      <div><strong>{label}</strong><small>{description}</small></div>
      {locked ? <LockKeyhole aria-label="Coluna obrigatória" /> : <Check aria-hidden="true" />}
    </R.ToggleOption>
  );
}

export function EventReportBuilder({ data, onNotice }: { data: EventWorkspaceData; onNotice: (notice: Notice) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [reportType, setReportType] = useState<ReportKind>("general");
  const [config, setConfig] = useState<EventGeneralReportConfig>(defaultGeneralConfig);
  const [participantConfig, setParticipantConfig] = useState<EventParticipantReportConfig>(defaultParticipantConfig);
  const [financialConfig, setFinancialConfig] = useState<EventFinancialReportConfig>(defaultFinancialConfig);
  const [caravanConfig,setCaravanConfig]=useState<EventCaravanReportConfig>(defaultCaravanConfig);
  const [preview, setPreview] = useState<EventGeneralReportPreview | EventParticipantReportPreview | EventFinancialReportPreview | EventCaravanReportPreview | null>(null);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [error, setError] = useState("");
  const [sectionsError, setSectionsError] = useState(false);

  const currentFilters = reportType === "general" ? config.filters : reportType === "participants" ? participantConfig.filters : financialConfig.filters;
  const currentOrganization = reportType === "general" ? config.organization : reportType === "participants" ? participantConfig.organization : reportType==="financial"?financialConfig.organization:caravanConfig.organization;
  const currentConfig = reportType === "general" ? config : reportType === "participants" ? participantConfig : reportType==="financial"?financialConfig:caravanConfig;

  const filteredCongregations = useMemo(
    () => data.references.congregations.filter((congregation) => !currentFilters.regionId || congregation.regionId === currentFilters.regionId),
    [currentFilters.regionId, data.references.congregations],
  );

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if(reportType==="caravans"){
      const filters=caravanConfig.filters;if(filters.city)labels.push(`Cidade: ${filters.city}`);if(filters.state)labels.push(`UF: ${filters.state}`);if(filters.source)labels.push(`Origem: ${filters.source==="PUBLIC"?"Pública":"Interna"}`);if(filters.paymentStatus)labels.push(`Situação financeira: ${eventLabel(PAYMENT_STATUSES,filters.paymentStatus)}`);if(filters.registeredFrom||filters.registeredTo)labels.push(`Período: ${filters.registeredFrom?formatDate(filters.registeredFrom):"início"} a ${filters.registeredTo?formatDate(filters.registeredTo):"hoje"}`);return labels;
    }
    const filters = currentFilters;
    const region = data.references.regions.find((item) => item.id === filters.regionId);
    const congregation = data.references.congregations.find((item) => item.id === filters.congregationId);
    const role = data.references.roles.find((item) => item.id === filters.roleId);
    const item = data.items.find((entry) => entry.id === filters.itemId);
    if (region) labels.push(`Regional: ${region.name}`);
    if (congregation) labels.push(`Congregação: ${congregation.name}`);
    if (role) labels.push(`Cargo: ${filters.gender === "FEMALE" ? role.femaleName || role.name : role.name}`);
    if (filters.gender) labels.push(`Sexo: ${filters.gender === "FEMALE" ? "Feminino" : "Masculino"}`);
    if (filters.registrationStatus) labels.push(`Inscrição: ${eventLabel(REGISTRATION_STATUSES, filters.registrationStatus)}`);
    if (filters.paymentMethod) labels.push(`Pagamento: ${paymentMethods.find(([value]) => value === filters.paymentMethod)?.[1]}`);
    if (filters.paymentStatus) labels.push(`Situação financeira: ${eventLabel(PAYMENT_STATUSES, filters.paymentStatus)}`);
    if (item) labels.push(`Item: ${item.name}`);
    if (filters.registeredFrom || filters.registeredTo) labels.push(`${reportType === "financial" ? "Período financeiro" : "Período"}: ${filters.registeredFrom ? formatDate(filters.registeredFrom) : "início"} a ${filters.registeredTo ? formatDate(filters.registeredTo) : "hoje"}`);
    if (reportType === "financial") {
      if (financialConfig.expenseFilters.name) labels.push(`Despesa: ${financialConfig.expenseFilters.name}`);
    }
    return labels;
  }, [caravanConfig.filters,currentFilters, data.items, data.references.congregations, data.references.regions, data.references.roles, financialConfig.expenseFilters, reportType]);

  const hasDataSection = config.sections.showSummary || config.sections.showRegions || config.sections.showCongregations || config.sections.showRoles || config.sections.showGenders;
  const hasFinancialSection = financialConfig.sections.showSummary || financialConfig.sections.showPaymentMethods || financialConfig.sections.showItems || financialConfig.sections.showExpenses;
  const financialIncludesEntries = financialConfig.scope !== "EXPENSES_ONLY" || financialConfig.sections.showPaymentMethods || financialConfig.sections.showItems;
  const financialIncludesExpenses = financialConfig.scope !== "ENTRIES_ONLY" || financialConfig.sections.showExpenses;
  const canGenerate = reportType === "participants"
    ? Boolean(preview && "totalParticipants" in preview && preview.totalParticipants > 0)
    : reportType === "financial"
      ? Boolean(preview && "totalReceived" in preview && (
        (financialConfig.sections.showSummary && (preview.filteredRegistrationCount > 0 || preview.totalReceived > 0 || preview.totalExpenses > 0))
        || (financialConfig.sections.showPaymentMethods && preview.paymentMethodCount > 0)
        || (financialConfig.sections.showItems && preview.itemCount > 0)
        || (financialConfig.sections.showExpenses && preview.expenses.length > 0)
      ))
      : reportType==="caravans"
        ?Boolean(preview&&"totalCaravans" in preview&&preview.totalCaravans>0)
        : Boolean(preview && "roleCount" in preview && (
      preview.totalRegistrations > 0
      || (config.sections.includeZeroCongregations && (
        (config.sections.showRegions && preview.regionCount > 0)
        || (config.sections.showCongregations && preview.congregationCount > 0)
      ))
    ));

  function resetConfiguration() {
    setReportType("general");
    setConfig(defaultGeneralConfig());
    setParticipantConfig(defaultParticipantConfig());
    setFinancialConfig(defaultFinancialConfig());
    setCaravanConfig(defaultCaravanConfig());
    setPreview(null);
    setError("");
    setSectionsError(false);
    setStep(0);
  }

  function openBuilder() {
    resetConfiguration();
    setOpen(true);
  }

  function updateFilter<K extends keyof EventGeneralReportFilters>(key: K, value: EventGeneralReportFilters[K]) {
    if (reportType === "general") {
      setConfig((current) => ({ ...current, filters: { ...current.filters, [key]: value } }));
    } else if (reportType === "participants") {
      setParticipantConfig((current) => ({ ...current, filters: { ...current.filters, [key]: value } }));
    } else {
      setFinancialConfig((current) => ({
        ...current,
        filters: { ...current.filters, [key]: value },
        expenseFilters: key === "registeredFrom"
          ? { ...current.expenseFilters, from: value }
          : key === "registeredTo"
            ? { ...current.expenseFilters, to: value }
            : current.expenseFilters,
      }));
    }
    setPreview(null);
    setError("");
  }

  function updateSection<K extends keyof EventGeneralReportSections>(key: K, value: EventGeneralReportSections[K]) {
    setConfig((current) => ({ ...current, sections: { ...current.sections, [key]: value } }));
    setPreview(null);
    setSectionsError(false);
  }

  function updateColumn<K extends keyof EventGeneralReportColumns>(key: K, value: EventGeneralReportColumns[K]) {
    setConfig((current) => ({ ...current, columns: { ...current.columns, [key]: value } }));
    setPreview(null);
  }

  function updateParticipantColumn<K extends keyof EventParticipantReportColumns>(key: K, value: EventParticipantReportColumns[K]) {
    setParticipantConfig((current) => ({ ...current, columns: { ...current.columns, [key]: value } }));
    setPreview(null);
  }

  function updateFinancialSection<K extends keyof EventFinancialReportSections>(key: K, value: EventFinancialReportSections[K]) {
    setFinancialConfig((current) => ({
      ...current,
      scope: value && ((current.scope === "ENTRIES_ONLY" && key === "showExpenses") || (current.scope === "EXPENSES_ONLY" && (key === "showPaymentMethods" || key === "showItems"))) ? "CUSTOM" : current.scope,
      sections: { ...current.sections, [key]: value },
    }));
    setPreview(null);
    setSectionsError(false);
  }

  function updateFinancialColumn<K extends keyof EventFinancialReportColumns>(key: K, value: EventFinancialReportColumns[K]) {
    setFinancialConfig((current) => ({ ...current, columns: { ...current.columns, [key]: value } }));
    setPreview(null);
  }

  function updateCaravanFilter<K extends keyof EventCaravanReportConfig["filters"]>(key:K,value:EventCaravanReportConfig["filters"][K]){setCaravanConfig((current)=>({...current,filters:{...current.filters,[key]:value}}));setPreview(null);setError("");}
  function updateCaravanColumn<K extends keyof EventCaravanReportColumns>(key:K,value:EventCaravanReportColumns[K]){setCaravanConfig((current)=>({...current,columns:{...current.columns,[key]:value}}));setPreview(null);}

  function updateFinancialScope(scope: EventFinancialReportConfig["scope"]) {
    setFinancialConfig((current) => ({
      ...current, scope,
      sections: scope === "GENERAL" ? { ...current.sections, showSummary: true, showPaymentMethods: true, showItems: true, showExpenses: true }
        : scope === "ENTRIES_ONLY" ? { ...current.sections, showSummary: true, showPaymentMethods: true, showItems: true, showExpenses: false }
          : scope === "EXPENSES_ONLY" ? { ...current.sections, showSummary: true, showPaymentMethods: false, showItems: false, showExpenses: true }
            : current.sections,
    }));
    setPreview(null);
  }

  function updateExpenseFilter(key: keyof EventFinancialReportConfig["expenseFilters"], value: string) {
    setFinancialConfig((current) => ({ ...current, expenseFilters: { ...current.expenseFilters, [key]: value } }));
    setPreview(null);
  }

  function updateOrganization(value: EventGeneralReportConfig["organization"] | EventFinancialReportConfig["organization"] | EventCaravanReportConfig["organization"]) {
    if (reportType === "general") setConfig((current) => ({ ...current, organization: value as EventGeneralReportConfig["organization"] }));
    else if (reportType === "participants") setParticipantConfig((current) => ({ ...current, organization: value as EventParticipantReportConfig["organization"] }));
    else if(reportType==="financial") setFinancialConfig((current) => ({ ...current, organization: value as EventFinancialReportConfig["organization"] }));
    else setCaravanConfig((current)=>({...current,organization:value as EventCaravanReportConfig["organization"]}));
    setPreview(null);
  }

  function selectReportType(value: ReportKind) {
    setReportType(value);
    setPreview(null);
    setError("");
    setSectionsError(false);
  }

  function clearFilters() {
    if (reportType === "general") {
      setConfig((current) => ({ ...current, filters: defaultGeneralConfig().filters }));
    } else if (reportType === "participants") {
      setParticipantConfig((current) => ({ ...current, filters: defaultParticipantConfig().filters }));
    } else if(reportType==="financial") {
      setFinancialConfig((current) => ({ ...current, filters: defaultFinancialConfig().filters, expenseFilters: defaultFinancialConfig().expenseFilters }));
    } else setCaravanConfig((current)=>({...current,filters:defaultCaravanConfig().filters}));
    setPreview(null);
    setError("");
  }

  async function readError(response: Response) {
    try {
      const payload = await response.json() as { message?: string };
      return payload.message || "Não foi possível processar o relatório.";
    } catch {
      return "Não foi possível processar o relatório.";
    }
  }

  async function loadPreview() {
    setBusy("preview");
    setError("");
    try {
      const response = await fetch(`/api/events/${data.event.id}/reports/${reportType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", config: currentConfig }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const payload = await response.json() as { data: EventGeneralReportPreview | EventParticipantReportPreview | EventFinancialReportPreview | EventCaravanReportPreview };
      setPreview(payload.data);
    } catch (requestError) {
      setPreview(null);
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar a prévia.");
    } finally {
      setBusy(null);
    }
  }

  async function generatePdf(disposition: "inline" | "attachment") {
    let previewWindow: Window | null = null;
    if (disposition === "inline") {
      previewWindow = window.open("about:blank", "_blank");
      if (!previewWindow) {
        onNotice({ message: "O navegador bloqueou a visualização. Permita pop-ups para abrir o PDF.", danger: true });
        return;
      }
      previewWindow.opener = null;
      previewWindow.document.title = "Preparando relatório";
      previewWindow.document.documentElement.innerHTML = `
        <head><title>Preparando relatório</title><style>
          *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f6fa;font-family:Inter,Arial,sans-serif;color:#344054}
          main{display:grid;place-items:center;gap:14px;border:1px solid #e1e6ef;border-radius:14px;background:#fff;padding:34px 42px;box-shadow:0 14px 38px -28px rgba(16,24,40,.45)}
          i{width:34px;height:34px;border:3px solid #dbe3f3;border-top-color:#0b51b7;border-radius:50%;animation:spin .75s linear infinite}
          strong{font-size:14px}span{color:#7c8798;font-size:11px}@keyframes spin{to{transform:rotate(360deg)}}
        </style></head><body><main><i></i><strong>Preparando o relatório</strong><span>A visualização será aberta nesta aba.</span></main></body>`;
      previewWindow.document.close();
    }
    setBusy(disposition === "inline" ? "inline" : "download");
    try {
      const response = await fetch(`/api/events/${data.event.id}/reports/${reportType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "pdf", disposition, config: currentConfig }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (disposition === "inline" && previewWindow) {
        previewWindow.location.replace(url);
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        onNotice({ message: "A visualização do relatório foi aberta em uma nova aba." });
      } else {
        const link = document.createElement("a");
        link.href = url;
        const fallback = reportType === "general" ? "relatorio-geral-inscricoes.pdf" : reportType === "participants" ? "relatorio-participantes.pdf" : reportType==="financial"?"relatorio-financeiro.pdf":"relatorio-caravanas.pdf";
        link.download = responseFileName(response, fallback);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        onNotice({ message: "Relatório em PDF gerado com sucesso." });
      }
    } catch (requestError) {
      previewWindow?.close();
      onNotice({ message: requestError instanceof Error ? requestError.message : "Não foi possível gerar o relatório.", danger: true });
    } finally {
      setBusy(null);
    }
  }

  async function nextStep() {
    setError("");
    const period=reportType==="caravans"?caravanConfig.filters:currentFilters;
    if (step === 1 && period.registeredFrom && period.registeredTo && period.registeredFrom > period.registeredTo) {
      setError("A data final não pode anteceder a data inicial.");
      return;
    }
    if (step === 2 && reportType === "general" && !hasDataSection) {
      setSectionsError(true);
      setError("Selecione ao menos uma seção de dados.");
      return;
    }
    if (step === 2 && reportType === "financial" && !hasFinancialSection) {
      setSectionsError(true);
      setError("Selecione ao menos uma seção de dados.");
      return;
    }
    if (step === 3) {
      setStep(4);
      await loadPreview();
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  }

  return (
    <>
      <R.Landing>
        <R.LandingHeader>
          <div><span><FileBarChart2 /></span><div><h2>Relatórios do evento</h2><p>Monte relatórios gerenciais flexíveis, escolha os filtros, as informações visíveis e a organização antes de gerar o PDF.</p></div></div>
          <Button onClick={openBuilder}><FileText />Gerar novo relatório</Button>
        </R.LandingHeader>
        <R.TypeGrid>
          <R.TypeCard><span><FileBarChart2 /></span><div><h3>Relatório geral de inscrições</h3><p>Totais por regional e congregação, metas, percentuais e congregações sem inscrições.</p></div><R.Badge>Disponível</R.Badge></R.TypeCard>
          <R.TypeCard><span><UsersRound /></span><div><h3>Relatório de participantes</h3><p>Relação nominal com filtros, colunas personalizadas e ordenação flexível.</p></div><R.Badge>Disponível</R.Badge></R.TypeCard>
          <R.TypeCard><span><WalletCards /></span><div><h3>Relatório financeiro</h3><p>Entradas, despesas, saldo, formas de pagamento e itens selecionados.</p></div><R.Badge>Novo</R.Badge></R.TypeCard>
          {data.event.registrationMode==="MIXED"?<R.TypeCard><span><Bus /></span><div><h3>Relatório de caravanas</h3><p>Cidade, pastor e quantidade de inscrições, com classificação flexível.</p></div><R.Badge>Novo</R.Badge></R.TypeCard>:null}
        </R.TypeGrid>
      </R.Landing>

      {open ? <Modal open size="xl" title="Gerar relatório do evento" description={reportType === "general" ? "Configure o relatório geral de inscrições antes de visualizar ou baixar o PDF." : reportType === "participants" ? "Configure a relação de participantes, as colunas e a ordem antes de gerar o PDF." : reportType==="financial"?"Configure entradas, despesas, saldo e as seções antes de gerar o PDF.":"Configure a listagem simplificada das caravanas antes de gerar o PDF."} icon={reportType === "general" ? <FileBarChart2 /> : reportType === "participants" ? <UsersRound /> : reportType==="financial"?<WalletCards />:<Bus/>} busy={Boolean(busy)} onClose={() => setOpen(false)} footer={
        <R.Footer>
          <Button variant="ghost" onClick={resetConfiguration} disabled={Boolean(busy)}><RotateCcw />Limpar configuração</Button>
          <div>
            {step > 0 ? <Button variant="outline" onClick={() => { setStep((current) => current - 1); setError(""); }} disabled={Boolean(busy)}>{step === 4 ? "Voltar e editar" : "Voltar"}</Button> : <Button variant="outline" onClick={() => setOpen(false)} disabled={Boolean(busy)}>Cancelar</Button>}
            {step < 4 ? <Button onClick={nextStep} loading={busy === "preview"}>{step === 3 ? "Revisar relatório" : "Continuar"}</Button> : <>
              <Button variant="outline" onClick={() => generatePdf("inline")} loading={busy === "inline"} disabled={Boolean(busy) || !canGenerate}><Eye />Visualizar relatório</Button>
              <Button onClick={() => generatePdf("attachment")} loading={busy === "download"} disabled={Boolean(busy) || !canGenerate}><Download />Gerar PDF</Button>
            </>}
          </div>
        </R.Footer>
      }>
        <R.Wizard>
          <R.Stepper aria-label="Etapas do relatório">
            {steps.map((label, index) => <button key={label} type="button" aria-current={step === index ? "step" : undefined} data-completed={index < step} disabled={index > step || Boolean(busy)} onClick={() => { setStep(index); setError(""); }}><span>{index < step ? <Check size={14} /> : index + 1}</span>{label}</button>)}
          </R.Stepper>
          <R.StepContent>
            {step === 0 ? <>
              <R.StepHeader><small>Etapa 1 de 5</small><h3>Tipo de relatório</h3><p>Escolha o relatório gerencial que deseja configurar e gerar em PDF.</p></R.StepHeader>
              <R.ReportTypeChoice $selected={reportType === "general"} onClick={() => selectReportType("general")}><input type="radio" name="reportType" checked={reportType === "general"} onChange={() => selectReportType("general")} /><span><FileBarChart2 /></span><div><strong>Relatório geral de inscrições</strong><small>Consolidado por regionais e congregações, com filtros e metas opcionais.</small></div>{reportType === "general" ? <Check /> : null}</R.ReportTypeChoice>
              <R.ReportTypeChoice $selected={reportType === "participants"} onClick={() => selectReportType("participants")}><input type="radio" name="reportType" checked={reportType === "participants"} onChange={() => selectReportType("participants")} /><span><UsersRound /></span><div><strong>Relatório de participantes</strong><small>Relação nominal com colunas personalizáveis, filtros e ordenação.</small></div>{reportType === "participants" ? <Check /> : null}</R.ReportTypeChoice>
              <R.ReportTypeChoice $selected={reportType === "financial"} onClick={() => selectReportType("financial")}><input type="radio" name="reportType" checked={reportType === "financial"} onChange={() => selectReportType("financial")} /><span><WalletCards /></span><div><strong>Relatório financeiro</strong><small>Entradas, despesas, saldo, formas de pagamento e itens escolhidos.</small></div>{reportType === "financial" ? <Check /> : null}</R.ReportTypeChoice>
              {data.event.registrationMode==="MIXED"?<R.ReportTypeChoice $selected={reportType === "caravans"} onClick={() => selectReportType("caravans")}><input type="radio" name="reportType" checked={reportType === "caravans"} onChange={() => selectReportType("caravans")} /><span><Bus /></span><div><strong>Relatório de caravanas</strong><small>Listagem simplificada por cidade, pastor e quantidade de inscrições.</small></div>{reportType === "caravans" ? <Check /> : null}</R.ReportTypeChoice>:null}
            </> : null}

            {step === 1 ? <>
              <R.StepHeader><small>Etapa 2 de 5</small><h3>Filtros</h3><p>Os filtros são combinados entre si. {reportType === "financial" ? "Os valores recebidos usam a forma efetivamente registrada nos pagamentos confirmados." : "Sem seleção, o relatório considera todas as inscrições válidas do evento."}</p></R.StepHeader>
              {reportType === "financial" ? <R.OptionSection><header><h4>Escopo financeiro</h4><small>Escolha um atalho e personalize as seções na próxima etapa</small></header><R.RadioGrid>
                <R.RadioCard $checked={financialConfig.scope === "GENERAL"}><input type="radio" checked={financialConfig.scope === "GENERAL"} onChange={() => updateFinancialScope("GENERAL")} /><span><WalletCards /></span><div><strong>Geral</strong><small>Entradas, despesas e saldo.</small></div>{financialConfig.scope === "GENERAL" ? <Check /> : null}</R.RadioCard>
                <R.RadioCard $checked={financialConfig.scope === "ENTRIES_ONLY"}><input type="radio" checked={financialConfig.scope === "ENTRIES_ONLY"} onChange={() => updateFinancialScope("ENTRIES_ONLY")} /><span><WalletCards /></span><div><strong>Apenas entradas</strong><small>Recebimentos e itens, sem despesas.</small></div>{financialConfig.scope === "ENTRIES_ONLY" ? <Check /> : null}</R.RadioCard>
                <R.RadioCard $checked={financialConfig.scope === "EXPENSES_ONLY"}><input type="radio" checked={financialConfig.scope === "EXPENSES_ONLY"} onChange={() => updateFinancialScope("EXPENSES_ONLY")} /><span><FileText /></span><div><strong>Apenas despesas</strong><small>Resumo e listagem de despesas.</small></div>{financialConfig.scope === "EXPENSES_ONLY" ? <Check /> : null}</R.RadioCard>
                <R.RadioCard $checked={financialConfig.scope === "CUSTOM"}><input type="radio" checked={financialConfig.scope === "CUSTOM"} onChange={() => updateFinancialScope("CUSTOM")} /><span><SlidersHorizontal /></span><div><strong>Personalizado</strong><small>Combine livremente todas as seções.</small></div>{financialConfig.scope === "CUSTOM" ? <Check /> : null}</R.RadioCard>
              </R.RadioGrid></R.OptionSection> : null}
              {reportType==="caravans"?<><R.FilterToolbar><span>{activeFilterLabels.length?`${activeFilterLabels.length} filtro(s) ativo(s)`:"Todas as caravanas confirmadas"}</span><button type="button" onClick={clearFilters} disabled={!activeFilterLabels.length}><RotateCcw/>Limpar filtros</button></R.FilterToolbar><R.FilterGrid>
                <R.Field><span>Cidade</span><select value={caravanConfig.filters.city} onChange={(event)=>updateCaravanFilter("city",event.target.value)}><option value="">Todas as cidades</option>{[...new Set(data.groups.filter((group)=>group.status==="CONFIRMED").map((group)=>group.originCity))].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((city)=><option key={city}>{city}</option>)}</select></R.Field>
                <R.Field><span>UF</span><select value={caravanConfig.filters.state} onChange={(event)=>updateCaravanFilter("state",event.target.value)}><option value="">Todas as UFs</option>{[...new Set(data.groups.filter((group)=>group.status==="CONFIRMED").map((group)=>group.originState))].sort().map((state)=><option key={state}>{state}</option>)}</select></R.Field>
                <R.Field><span>Origem do cadastro</span><select value={caravanConfig.filters.source} onChange={(event)=>updateCaravanFilter("source",event.target.value as EventCaravanReportConfig["filters"]["source"])}><option value="">Interna e pública</option><option value="INTERNAL">Interna</option><option value="PUBLIC">Pública</option></select></R.Field>
                <R.Field><span>Situação financeira</span><select value={caravanConfig.filters.paymentStatus} onChange={(event)=>updateCaravanFilter("paymentStatus",event.target.value)}><option value="">Todas</option>{PAYMENT_STATUSES.filter(([value])=>["NOT_REQUIRED","PENDING","PARTIAL","PAID","REFUNDED"].includes(value)).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></R.Field>
                <R.Field><span>Cadastros a partir de</span><input type="date" value={caravanConfig.filters.registeredFrom} onChange={(event)=>updateCaravanFilter("registeredFrom",event.target.value)}/></R.Field>
                <R.Field><span>Cadastros até</span><input type="date" min={caravanConfig.filters.registeredFrom||undefined} value={caravanConfig.filters.registeredTo} onChange={(event)=>updateCaravanFilter("registeredTo",event.target.value)}/></R.Field>
              </R.FilterGrid><R.Chips>{activeFilterLabels.length?activeFilterLabels.map((label)=><span key={label}>{label}</span>):<p>Nenhum filtro selecionado. Serão consideradas todas as caravanas confirmadas.</p>}</R.Chips></>:<>
              <R.FilterToolbar><span>{activeFilterLabels.length ? `${activeFilterLabels.length} filtro(s) ativo(s)` : "Abrangência completa do evento"}</span><button type="button" onClick={clearFilters} disabled={!activeFilterLabels.length}><RotateCcw />Limpar filtros</button></R.FilterToolbar>
              <R.FilterGrid>
                <R.Field><span>Regional</span><select value={currentFilters.regionId} onChange={(event) => { updateFilter("regionId", event.target.value); updateFilter("congregationId", ""); }}><option value="">Todas as regionais</option>{data.references.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></R.Field>
                <R.Field><span>Congregação</span><select value={currentFilters.congregationId} onChange={(event) => updateFilter("congregationId", event.target.value)}><option value="">Todas as congregações</option>{filteredCongregations.map((congregation) => <option key={congregation.id} value={congregation.id}>{congregation.name}</option>)}</select></R.Field>
                <R.Field><span>Cargo</span><select value={currentFilters.roleId} onChange={(event) => updateFilter("roleId", event.target.value)}><option value="">Todos os cargos</option>{data.references.roles.map((role) => <option key={role.id} value={role.id}>{currentFilters.gender === "FEMALE" ? role.femaleName || role.name : role.name}</option>)}</select></R.Field>
                <R.Field><span>Sexo</span><select value={currentFilters.gender} onChange={(event) => updateFilter("gender", event.target.value as EventGeneralReportFilters["gender"])}><option value="">Todos</option><option value="MALE">Masculino</option><option value="FEMALE">Feminino</option></select></R.Field>
                <R.Field><span>Situação da inscrição</span><select value={currentFilters.registrationStatus} onChange={(event) => updateFilter("registrationStatus", event.target.value)}><option value="">Todas as situações válidas</option>{REGISTRATION_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></R.Field>
                <R.Field><span>{reportType === "financial" ? "Forma de pagamento efetivada" : "Forma de pagamento"}</span><select value={currentFilters.paymentMethod} onChange={(event) => updateFilter("paymentMethod", event.target.value)}><option value="">Todas as formas</option>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></R.Field>
                <R.Field><span>Situação do pagamento</span><select value={currentFilters.paymentStatus} onChange={(event) => updateFilter("paymentStatus", event.target.value)}><option value="">Todas as situações</option>{PAYMENT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></R.Field>
                <R.Field><span>Item adquirido ou selecionado</span><select value={currentFilters.itemId} onChange={(event) => updateFilter("itemId", event.target.value)}><option value="">Todos os itens</option>{data.items.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></R.Field>
                <R.Field><span>{reportType === "financial" ? "Período financeiro a partir de" : "Inscrições a partir de"}</span><input type="date" value={currentFilters.registeredFrom} onChange={(event) => updateFilter("registeredFrom", event.target.value)} /></R.Field>
                <R.Field><span>{reportType === "financial" ? "Período financeiro até" : "Inscrições até"}</span><input type="date" min={currentFilters.registeredFrom || undefined} value={currentFilters.registeredTo} onChange={(event) => updateFilter("registeredTo", event.target.value)} /></R.Field>
                {reportType === "financial" ? <R.Field><span>Nome da despesa</span><input value={financialConfig.expenseFilters.name} onChange={(event) => updateExpenseFilter("name", event.target.value)} placeholder="Todas as despesas" /></R.Field> : null}
              </R.FilterGrid>
              {reportType === "financial" ? <R.StateBox><Info /><strong>Como os filtros financeiros funcionam</strong><p>O período usa a data do pagamento nas entradas e a data da despesa nas despesas. Regional, congregação, cargo, sexo, inscrição, pagamento e item não filtram despesas; o nome da despesa não filtra entradas.</p></R.StateBox> : null}
              <R.Chips>{activeFilterLabels.length ? activeFilterLabels.map((label) => <span key={label}>{label}</span>) : <p>Nenhum filtro selecionado. Serão consideradas todas as inscrições ativas e válidas.</p>}</R.Chips>
              </>}
            </> : null}

            {step === 2 && reportType === "general" ? <>
              <R.StepHeader><small>Etapa 3 de 5</small><h3>Conteúdo e colunas</h3><p>Escolha as seções do documento e quais informações opcionais deverão aparecer nas tabelas.</p></R.StepHeader>
              <R.OptionSection $error={sectionsError}><header><h4>Seções do PDF</h4><small>Selecione ao menos uma seção de dados</small></header><R.OptionGrid>
                <ToggleOption label="Resumo geral" description="Totais e abrangência do relatório." checked={config.sections.showSummary} onChange={(value) => updateSection("showSummary", value)} />
                <ToggleOption label="Inscrições por regionais" description="Pode ser emitida isoladamente." checked={config.sections.showRegions} onChange={(value) => updateSection("showRegions", value)} />
                <ToggleOption label="Inscrições por congregações" description="Pode ser emitida isoladamente." checked={config.sections.showCongregations} onChange={(value) => updateSection("showCongregations", value)} />
                <ToggleOption label="Inscrições por cargos" description="Quantidade consolidada por cargo." checked={config.sections.showRoles} onChange={(value) => updateSection("showRoles", value)} />
                <ToggleOption label="Inscrições por sexo" description="Quantidade consolidada por sexo." checked={config.sections.showGenders} onChange={(value) => updateSection("showGenders", value)} />
                <ToggleOption label="Congregações sem inscrições" description="Mantém congregações com resultado zero." checked={config.sections.includeZeroCongregations} onChange={(value) => updateSection("includeZeroCongregations", value)} />
                <ToggleOption label="Filtros no cabeçalho" description="Identifica a abrangência utilizada." checked={config.sections.showAppliedFilters} onChange={(value) => updateSection("showAppliedFilters", value)} />
                <ToggleOption label="Data e horário da emissão" description="Registra o momento da geração." checked={config.sections.showIssuedAt} onChange={(value) => updateSection("showIssuedAt", value)} />
              </R.OptionGrid></R.OptionSection>
              <R.OptionSection><header><h4>Colunas das regionais</h4><small>Nome e inscrições são obrigatórios</small></header><R.OptionGrid>
                <ToggleOption label="Nome da regional" description="Coluna obrigatória." checked locked />
                <ToggleOption label="Número de inscrições" description="Coluna obrigatória." checked locked />
                <ToggleOption label="Nome do coordenador" description="Responsável pela regional." checked={config.columns.regionalCoordinator} onChange={(value) => updateColumn("regionalCoordinator", value)} />
                <ToggleOption label="Meta/cota" description="Soma das metas das congregações." checked={config.columns.regionalQuota} onChange={(value) => updateColumn("regionalQuota", value)} />
                <ToggleOption label="Percentual da meta" description="Progresso percentual da regional." checked={config.columns.regionalPercentage} onChange={(value) => updateColumn("regionalPercentage", value)} />
              </R.OptionGrid></R.OptionSection>
              <R.OptionSection><header><h4>Colunas das congregações</h4><small>Nome e inscrições são obrigatórios</small></header><R.OptionGrid>
                <ToggleOption label="Nome da congregação" description="Coluna obrigatória." checked locked />
                <ToggleOption label="Número de inscrições" description="Coluna obrigatória." checked locked />
                <ToggleOption label="Pastor dirigente" description="Responsável pela congregação." checked={config.columns.congregationPastor} onChange={(value) => updateColumn("congregationPastor", value)} />
                <ToggleOption label="Meta/cota" description="Meta geral da congregação." checked={config.columns.congregationQuota} onChange={(value) => updateColumn("congregationQuota", value)} />
                <ToggleOption label="Percentual da meta" description="Progresso percentual da congregação." checked={config.columns.congregationPercentage} onChange={(value) => updateColumn("congregationPercentage", value)} />
              </R.OptionGrid></R.OptionSection>
            </> : null}

            {step === 2 && reportType === "participants" ? <>
              <R.StepHeader><small>Etapa 3 de 5</small><h3>Conteúdo e colunas</h3><p>Nome do participante e Congregação + Regional são obrigatórios. Selecione as demais informações que deseja imprimir.</p></R.StepHeader>
              <R.OptionSection><header><h4>Colunas do relatório de participantes</h4><small>2 colunas obrigatórias</small></header><R.OptionGrid>
                <ToggleOption label="Nome do participante" description="Coluna obrigatória." checked locked />
                <ToggleOption label="Congregação + Regional" description="Exibidas juntas na mesma coluna." checked locked />
                <ToggleOption label="Índice (#)" description="Contador sequencial da listagem." checked={participantConfig.columns.index} onChange={(value) => updateParticipantColumn("index", value)} />
                <ToggleOption label="Número da inscrição" description="Código identificador da inscrição." checked={participantConfig.columns.registrationNumber} onChange={(value) => updateParticipantColumn("registrationNumber", value)} />
                <ToggleOption label="Cargo" description="Cargo informado no momento da inscrição." checked={participantConfig.columns.role} onChange={(value) => updateParticipantColumn("role", value)} />
                <ToggleOption label="Sexo" description="Informação declarada pelo participante." checked={participantConfig.columns.gender} onChange={(value) => updateParticipantColumn("gender", value)} />
                <ToggleOption label="Telefone" description="Contato informado na inscrição." checked={participantConfig.columns.phone} onChange={(value) => updateParticipantColumn("phone", value)} />
                <ToggleOption label="Situação da inscrição" description="Pendente, confirmada ou check-in realizado." checked={participantConfig.columns.registrationStatus} onChange={(value) => updateParticipantColumn("registrationStatus", value)} />
                <ToggleOption label="Forma de pagamento" description="Forma escolhida pelo participante." checked={participantConfig.columns.paymentMethod} onChange={(value) => updateParticipantColumn("paymentMethod", value)} />
                <ToggleOption label="Situação do pagamento" description="Situação financeira atual da inscrição." checked={participantConfig.columns.paymentStatus} onChange={(value) => updateParticipantColumn("paymentStatus", value)} />
                <ToggleOption label="Data da inscrição" description="Data e horário em que foi realizada." checked={participantConfig.columns.registeredAt} onChange={(value) => updateParticipantColumn("registeredAt", value)} />
                <ToggleOption label="Itens selecionados" description="Itens vinculados à inscrição." checked={participantConfig.columns.items} onChange={(value) => updateParticipantColumn("items", value)} />
                <ToggleOption label="Filtros no cabeçalho" description="Identifica a abrangência utilizada." checked={participantConfig.showAppliedFilters} onChange={(value) => { setParticipantConfig((current) => ({ ...current, showAppliedFilters: value })); setPreview(null); }} />
                <ToggleOption label="Data e horário da emissão" description="Registra o momento da geração." checked={participantConfig.showIssuedAt} onChange={(value) => { setParticipantConfig((current) => ({ ...current, showIssuedAt: value })); setPreview(null); }} />
              </R.OptionGrid></R.OptionSection>
            </> : null}

            {step === 2 && reportType === "financial" ? <>
              <R.StepHeader><small>Etapa 3 de 5</small><h3>Conteúdo e colunas</h3><p>Escolha os blocos e os indicadores opcionais. O total recebido sempre considera somente pagamentos confirmados.</p></R.StepHeader>
              <R.OptionSection $error={sectionsError}><header><h4>Seções do PDF</h4><small>Selecione ao menos uma seção de dados</small></header><R.OptionGrid>
                <ToggleOption label="Resumo financeiro" description="Destaque do total recebido e indicadores opcionais." checked={financialConfig.sections.showSummary} onChange={(value) => updateFinancialSection("showSummary", value)} />
                <ToggleOption label="Valores por forma de pagamento" description="Consolida somente pagamentos confirmados." checked={financialConfig.sections.showPaymentMethods} onChange={(value) => updateFinancialSection("showPaymentMethods", value)} />
                <ToggleOption label="Itens selecionados" description="Participantes, unidades e valor previsto por item." checked={financialConfig.sections.showItems} onChange={(value) => updateFinancialSection("showItems", value)} />
                <ToggleOption label="Despesas do evento" description="Nome, data, valor e indicação de comprovante." checked={financialConfig.sections.showExpenses} onChange={(value) => updateFinancialSection("showExpenses", value)} />
                <ToggleOption label="Filtros no cabeçalho" description="Identifica a abrangência utilizada." checked={financialConfig.sections.showAppliedFilters} onChange={(value) => updateFinancialSection("showAppliedFilters", value)} />
                <ToggleOption label="Data e horário da emissão" description="Registra o momento da geração." checked={financialConfig.sections.showIssuedAt} onChange={(value) => updateFinancialSection("showIssuedAt", value)} />
              </R.OptionGrid></R.OptionSection>
              <R.OptionSection><header><h4>Indicadores do resumo financeiro</h4><small>Adaptados à abrangência selecionada</small></header><R.OptionGrid>
                {financialIncludesEntries ? <ToggleOption label="Total recebido" description="Soma dos pagamentos confirmados." checked locked /> : null}
                {financialIncludesExpenses ? <ToggleOption label="Total de despesas" description="Soma das despesas reconhecidas no evento." checked locked /> : null}
                {financialIncludesEntries && financialIncludesExpenses ? <ToggleOption label="Saldo" description="Total recebido menos total de despesas." checked locked /> : null}
                {financialIncludesEntries ? <ToggleOption label="Valor previsto" description="Soma dos valores das inscrições filtradas." checked={financialConfig.columns.summaryExpectedAmount} onChange={(value) => updateFinancialColumn("summaryExpectedAmount", value)} /> : null}
                {financialIncludesEntries ? <ToggleOption label="Valor pendente" description="Saldo ainda não recebido das inscrições." checked={financialConfig.columns.summaryPendingAmount} onChange={(value) => updateFinancialColumn("summaryPendingAmount", value)} /> : null}
                {financialIncludesEntries ? <ToggleOption label="Inscrições pagas" description="Quantidade de inscrições integralmente pagas." checked={financialConfig.columns.summaryPaidRegistrationCount} onChange={(value) => updateFinancialColumn("summaryPaidRegistrationCount", value)} /> : null}
              </R.OptionGrid></R.OptionSection>
              <R.OptionSection><header><h4>Colunas por forma de pagamento</h4><small>Forma e valor recebido são obrigatórios</small></header><R.OptionGrid>
                <ToggleOption label="Forma de pagamento" description="Coluna obrigatória." checked locked />
                <ToggleOption label="Valor recebido" description="Coluna obrigatória." checked locked />
                <ToggleOption label="Pagamentos confirmados" description="Quantidade de lançamentos confirmados." checked={financialConfig.columns.paymentConfirmedCount} onChange={(value) => updateFinancialColumn("paymentConfirmedCount", value)} />
                <ToggleOption label="Percentual do total" description="Participação da forma no total recebido." checked={financialConfig.columns.paymentPercentage} onChange={(value) => updateFinancialColumn("paymentPercentage", value)} />
              </R.OptionGrid></R.OptionSection>
              <R.OptionSection><header><h4>Colunas dos itens selecionados</h4><small>Item e unidades são obrigatórios</small></header><R.OptionGrid>
                <ToggleOption label="Nome do item" description="Coluna obrigatória." checked locked />
                <ToggleOption label="Unidades" description="Soma das quantidades escolhidas." checked locked />
                <ToggleOption label="Participantes" description="Pessoas distintas que escolheram o item." checked={financialConfig.columns.itemParticipantCount} onChange={(value) => updateFinancialColumn("itemParticipantCount", value)} />
                <ToggleOption label="Valor previsto" description="Quantidade multiplicada pelo preço da inscrição." checked={financialConfig.columns.itemExpectedAmount} onChange={(value) => updateFinancialColumn("itemExpectedAmount", value)} />
              </R.OptionGrid></R.OptionSection>
              <R.OptionSection><header><h4>Colunas das despesas</h4><small>Nome, data e valor são obrigatórios</small></header><R.OptionGrid>
                <ToggleOption label="Nome da despesa" description="Coluna obrigatória." checked locked />
                <ToggleOption label="Data" description="Data reconhecida da despesa." checked locked />
                <ToggleOption label="Valor" description="Valor da despesa." checked locked />
                <ToggleOption label="Índice (#)" description="Contador sequencial da listagem." checked={financialConfig.columns.expenseIndex} onChange={(value) => updateFinancialColumn("expenseIndex", value)} />
                <ToggleOption label="Possui comprovante" description="Exibe Sim ou Não; o arquivo não é incorporado ao PDF." checked={financialConfig.columns.expenseReceipt} onChange={(value) => updateFinancialColumn("expenseReceipt", value)} />
              </R.OptionGrid></R.OptionSection>
            </> : null}

            {step===2&&reportType==="caravans"?<><R.StepHeader><small>Etapa 3 de 5</small><h3>Conteúdo e colunas</h3><p>Cidade/UF, pastor(a) e quantidade de inscrições são obrigatórios. Escolha apenas os complementos necessários.</p></R.StepHeader><R.OptionSection><header><h4>Colunas do relatório de caravanas</h4><small>3 colunas obrigatórias</small></header><R.OptionGrid>
              <ToggleOption label="Cidade + UF" description="Coluna obrigatória." checked locked/><ToggleOption label="Nome do pastor(a)" description="Coluna obrigatória." checked locked/><ToggleOption label="Quantidade de inscrições" description="Coluna obrigatória." checked locked/>
              <ToggleOption label="Índice (#)" description="Contador sequencial da listagem." checked={caravanConfig.columns.index} onChange={(value)=>updateCaravanColumn("index",value)}/><ToggleOption label="Igreja/origem" description="Igreja responsável pela caravana." checked={caravanConfig.columns.originChurch} onChange={(value)=>updateCaravanColumn("originChurch",value)}/><ToggleOption label="Responsável" description="Nome do líder responsável pela caravana." checked={caravanConfig.columns.responsible} onChange={(value)=>updateCaravanColumn("responsible",value)}/><ToggleOption label="Filtros no cabeçalho" description="Identifica a abrangência utilizada." checked={caravanConfig.showAppliedFilters} onChange={(value)=>{setCaravanConfig((current)=>({...current,showAppliedFilters:value}));setPreview(null);}}/><ToggleOption label="Data e horário da emissão" description="Registra o momento da geração." checked={caravanConfig.showIssuedAt} onChange={(value)=>{setCaravanConfig((current)=>({...current,showIssuedAt:value}));setPreview(null);}}/>
            </R.OptionGrid></R.OptionSection></>:null}

            {step === 3 && (reportType === "general" || reportType === "participants") ? <>
              <R.StepHeader><small>Etapa 4 de 5</small><h3>{reportType === "general" ? "Organização das congregações" : "Organização dos participantes"}</h3><p>{reportType === "general" ? "Defina a sequência utilizada na tabela de congregações." : "Defina a ordem da listagem nominal. Em ambos os casos, o relatório será uma tabela contínua, sem subtítulos por regional."}</p></R.StepHeader>
              <R.RadioGrid>
                <R.RadioCard $checked={currentOrganization === "BY_REGION"}><input type="radio" name="organization" checked={currentOrganization === "BY_REGION"} onChange={() => updateOrganization("BY_REGION")} /><span><ListTree /></span><div><strong>Ordem por regional</strong><small>{reportType === "general" ? "Agrupa por regional e ordena as congregações alfabeticamente em cada grupo." : "Ordena por regional, congregação e nome, mantendo uma listagem corrida."}</small></div>{currentOrganization === "BY_REGION" ? <Check /> : null}</R.RadioCard>
                <R.RadioCard $checked={currentOrganization === "ALPHABETICAL"}><input type="radio" name="organization" checked={currentOrganization === "ALPHABETICAL"} onChange={() => updateOrganization("ALPHABETICAL")} /><span><Columns3 /></span><div><strong>Ordem alfabética</strong><small>{reportType === "general" ? "Apresenta todas as congregações em uma única sequência com a regional como apoio." : "Ordena diretamente pelo nome do participante, de A a Z."}</small></div>{currentOrganization === "ALPHABETICAL" ? <Check /> : null}</R.RadioCard>
              </R.RadioGrid>
              <R.StateBox><Info /><strong>Formato retrato</strong><p>O relatório será gerado em modo retrato, com as colunas ajustadas para leitura e impressão.</p></R.StateBox>
            </> : null}

            {step===3&&reportType==="caravans"?<><R.StepHeader><small>Etapa 4 de 5</small><h3>Organização das caravanas</h3><p>Defina a ordem da listagem simplificada.</p></R.StepHeader><R.RadioGrid><R.RadioCard $checked={caravanConfig.organization==="HIGHEST_REGISTRATIONS"}><input type="radio" name="organization" checked={caravanConfig.organization==="HIGHEST_REGISTRATIONS"} onChange={()=>updateOrganization("HIGHEST_REGISTRATIONS")}/><span><ListTree/></span><div><strong>Maiores inscrições primeiro</strong><small>Destaca as caravanas com maior número de participantes.</small></div>{caravanConfig.organization==="HIGHEST_REGISTRATIONS"?<Check/>:null}</R.RadioCard><R.RadioCard $checked={caravanConfig.organization==="ALPHABETICAL"}><input type="radio" name="organization" checked={caravanConfig.organization==="ALPHABETICAL"} onChange={()=>updateOrganization("ALPHABETICAL")}/><span><Columns3/></span><div><strong>Ordem alfabética</strong><small>Ordena pela cidade, UF e igreja de origem.</small></div>{caravanConfig.organization==="ALPHABETICAL"?<Check/>:null}</R.RadioCard></R.RadioGrid><R.StateBox><Info/><strong>Formato retrato</strong><p>O PDF será gerado em A4 retrato, com cabeçalho repetido nas páginas seguintes.</p></R.StateBox></>:null}

            {step === 3 && reportType === "financial" ? <>
              <R.StepHeader><small>Etapa 4 de 5</small><h3>Organização dos resultados</h3><p>Defina a ordem aplicada às formas de pagamento e aos itens selecionados.</p></R.StepHeader>
              <R.RadioGrid>
                <R.RadioCard $checked={currentOrganization === "HIGHEST_VALUE"}><input type="radio" name="organization" checked={currentOrganization === "HIGHEST_VALUE"} onChange={() => updateOrganization("HIGHEST_VALUE")} /><span><WalletCards /></span><div><strong>Maior valor primeiro</strong><small>Destaca as formas com maior recebimento e os itens com maior valor previsto.</small></div>{currentOrganization === "HIGHEST_VALUE" ? <Check /> : null}</R.RadioCard>
                <R.RadioCard $checked={currentOrganization === "HIGHEST_QUANTITY"}><input type="radio" name="organization" checked={currentOrganization === "HIGHEST_QUANTITY"} onChange={() => updateOrganization("HIGHEST_QUANTITY")} /><span><ListTree /></span><div><strong>Maior quantidade primeiro</strong><small>Prioriza a quantidade de pagamentos confirmados e de unidades escolhidas.</small></div>{currentOrganization === "HIGHEST_QUANTITY" ? <Check /> : null}</R.RadioCard>
                <R.RadioCard $checked={currentOrganization === "ALPHABETICAL"}><input type="radio" name="organization" checked={currentOrganization === "ALPHABETICAL"} onChange={() => updateOrganization("ALPHABETICAL")} /><span><Columns3 /></span><div><strong>Ordem alfabética</strong><small>Ordena as formas de pagamento e os itens pelo nome.</small></div>{currentOrganization === "ALPHABETICAL" ? <Check /> : null}</R.RadioCard>
              </R.RadioGrid>
              {financialConfig.sections.showExpenses ? <><R.StepHeader><h3>Organização das despesas</h3><p>Escolha a ordem específica da tabela de despesas.</p></R.StepHeader><R.RadioGrid>
                <R.RadioCard $checked={financialConfig.expenseOrganization === "DATE_DESC"}><input type="radio" name="expenseOrganization" checked={financialConfig.expenseOrganization === "DATE_DESC"} onChange={() => { setFinancialConfig((current) => ({ ...current, expenseOrganization: "DATE_DESC" })); setPreview(null); }} /><span><ListTree /></span><div><strong>Data mais recente</strong><small>Ordena da despesa mais recente para a mais antiga.</small></div>{financialConfig.expenseOrganization === "DATE_DESC" ? <Check /> : null}</R.RadioCard>
                <R.RadioCard $checked={financialConfig.expenseOrganization === "HIGHEST_VALUE"}><input type="radio" name="expenseOrganization" checked={financialConfig.expenseOrganization === "HIGHEST_VALUE"} onChange={() => { setFinancialConfig((current) => ({ ...current, expenseOrganization: "HIGHEST_VALUE" })); setPreview(null); }} /><span><WalletCards /></span><div><strong>Maior valor</strong><small>Destaca primeiro as maiores despesas.</small></div>{financialConfig.expenseOrganization === "HIGHEST_VALUE" ? <Check /> : null}</R.RadioCard>
                <R.RadioCard $checked={financialConfig.expenseOrganization === "ALPHABETICAL"}><input type="radio" name="expenseOrganization" checked={financialConfig.expenseOrganization === "ALPHABETICAL"} onChange={() => { setFinancialConfig((current) => ({ ...current, expenseOrganization: "ALPHABETICAL" })); setPreview(null); }} /><span><Columns3 /></span><div><strong>Ordem alfabética</strong><small>Ordena pelo nome da despesa.</small></div>{financialConfig.expenseOrganization === "ALPHABETICAL" ? <Check /> : null}</R.RadioCard>
              </R.RadioGrid></> : null}
              <R.StateBox><Info /><strong>Formato retrato</strong><p>O total recebido terá maior destaque e os blocos serão organizados para leitura e impressão em página A4.</p></R.StateBox>
            </> : null}

            {step === 4 ? <>
              <R.StepHeader><small>Etapa 5 de 5</small><h3>Revisão e geração</h3><p>Confira a abrangência e a quantidade de resultados antes de visualizar ou baixar o documento.</p></R.StepHeader>
              {busy === "preview" ? <R.StateBox $loading><LoaderCircle /><strong>Calculando o relatório</strong><p>Os resultados estão sendo processados no servidor.</p></R.StateBox> : error ? <R.StateBox $danger><Info /><strong>Não foi possível preparar a prévia</strong><p>{error}</p><Button size="sm" variant="outline" onClick={loadPreview}>Tentar novamente</Button></R.StateBox> : null}
              {preview && reportType === "general" && "roleCount" in preview ? <>
                <R.ReviewStats><div><small>Inscrições encontradas</small><strong>{preview.totalRegistrations}</strong></div><div><small>Regionais incluídas</small><strong>{preview.regionCount}</strong></div><div><small>Congregações incluídas</small><strong>{preview.congregationCount}</strong></div>{config.sections.showRoles ? <div><small>Cargos incluídos</small><strong>{preview.roleCount}</strong></div> : null}{config.sections.showGenders ? <div><small>Sexos incluídos</small><strong>{preview.genderCount}</strong></div> : null}</R.ReviewStats>
                <R.ReviewList>
                  <div><dt>Tipo</dt><dd>Relatório geral de inscrições</dd></div>
                  <div><dt>Organização</dt><dd>{config.organization === "BY_REGION" ? "Por regional" : "Ordem alfabética"}</dd></div>
                  <div><dt>Seções</dt><dd>{listEnabledSections(config)}</dd></div>
                  <div><dt>Colunas</dt><dd>{listEnabledGeneralColumns(config)}</dd></div>
                  <div><dt>Orientação do PDF</dt><dd>Retrato</dd></div>
                  <div><dt>Congregações sem inscrições</dt><dd>{config.sections.includeZeroCongregations ? "Incluídas" : "Ocultas"}</dd></div>
                </R.ReviewList>
                <R.OptionSection><header><h4>Filtros aplicados</h4><small>{preview.activeFilterCount} filtro(s)</small></header><R.Chips>{preview.appliedFilters.length ? preview.appliedFilters.map((filter) => <span key={`${filter.label}-${filter.value}`}>{filter.label}: {filter.value}</span>) : <p>Nenhum filtro aplicado.</p>}</R.Chips></R.OptionSection>
                {!canGenerate ? <R.StateBox $danger><SlidersHorizontal /><strong>Nenhuma inscrição encontrada</strong><p>Ajuste os filtros ou marque “Congregações sem inscrições” para gerar um relatório com quantitativos zerados.</p></R.StateBox> : null}
              </> : null}
              {preview && reportType === "participants" && "totalParticipants" in preview ? <>
                <R.ReviewStats><div><small>Participantes encontrados</small><strong>{preview.totalParticipants}</strong></div><div><small>Regionais incluídas</small><strong>{preview.regionCount}</strong></div><div><small>Congregações incluídas</small><strong>{preview.congregationCount}</strong></div><div><small>Colunas selecionadas</small><strong>{preview.selectedColumnCount}</strong></div></R.ReviewStats>
                <R.ReviewList>
                  <div><dt>Tipo</dt><dd>Relatório de participantes</dd></div>
                  <div><dt>Organização</dt><dd>{participantConfig.organization === "BY_REGION" ? "Por regional, sem subtítulos" : "Ordem alfabética"}</dd></div>
                  <div><dt>Colunas</dt><dd>{listEnabledParticipantColumns(participantConfig)}</dd></div>
                  <div><dt>Orientação do PDF</dt><dd>Retrato</dd></div>
                  <div><dt>Filtros no cabeçalho</dt><dd>{participantConfig.showAppliedFilters ? "Exibidos" : "Ocultos"}</dd></div>
                  <div><dt>Data de emissão</dt><dd>{participantConfig.showIssuedAt ? "Exibida" : "Ocultada"}</dd></div>
                </R.ReviewList>
                <R.OptionSection><header><h4>Filtros aplicados</h4><small>{preview.activeFilterCount} filtro(s)</small></header><R.Chips>{preview.appliedFilters.length ? preview.appliedFilters.map((filter) => <span key={`${filter.label}-${filter.value}`}>{filter.label}: {filter.value}</span>) : <p>Nenhum filtro aplicado.</p>}</R.Chips></R.OptionSection>
                {!canGenerate ? <R.StateBox $danger><SlidersHorizontal /><strong>Nenhum participante encontrado</strong><p>Ajuste os filtros para localizar participantes válidos para o relatório.</p></R.StateBox> : null}
              </> : null}
              {preview&&reportType==="caravans"&&"totalCaravans" in preview?<><R.ReviewStats><div><small>Caravanas encontradas</small><strong>{preview.totalCaravans}</strong></div><div><small>Total de inscrições</small><strong>{preview.totalRegistrations}</strong></div><div><small>Cidades incluídas</small><strong>{preview.cityCount}</strong></div><div><small>Colunas selecionadas</small><strong>{preview.selectedColumnCount}</strong></div></R.ReviewStats><R.ReviewList><div><dt>Tipo</dt><dd>Relatório de caravanas</dd></div><div><dt>Organização</dt><dd>{caravanConfig.organization==="HIGHEST_REGISTRATIONS"?"Maiores inscrições primeiro":"Ordem alfabética"}</dd></div><div><dt>Colunas obrigatórias</dt><dd>Cidade/UF, Pastor(a) e Quantidade</dd></div><div><dt>Orientação do PDF</dt><dd>Retrato</dd></div><div><dt>Filtros no cabeçalho</dt><dd>{caravanConfig.showAppliedFilters?"Exibidos":"Ocultos"}</dd></div></R.ReviewList><R.OptionSection><header><h4>Filtros aplicados</h4><small>{preview.activeFilterCount} filtro(s)</small></header><R.Chips>{preview.appliedFilters.length?preview.appliedFilters.map((filter)=><span key={`${filter.label}-${filter.value}`}>{filter.label}: {filter.value}</span>):<p>Nenhum filtro aplicado.</p>}</R.Chips></R.OptionSection>{!canGenerate?<R.StateBox $danger><SlidersHorizontal/><strong>Nenhuma caravana encontrada</strong><p>Ajuste os filtros para localizar caravanas confirmadas.</p></R.StateBox>:null}</>:null}
              {preview && reportType === "financial" && "totalReceived" in preview ? <>
                <R.ReviewStats>{financialIncludesEntries ? <div><small>Total recebido</small><strong>{new Intl.NumberFormat("pt-BR", { style:"currency",currency:"BRL" }).format(preview.totalReceived)}</strong></div> : null}{financialIncludesExpenses ? <div><small>Total de despesas</small><strong>{new Intl.NumberFormat("pt-BR", { style:"currency",currency:"BRL" }).format(preview.totalExpenses)}</strong></div> : null}{financialIncludesEntries && financialIncludesExpenses ? <div><small>Saldo</small><strong>{new Intl.NumberFormat("pt-BR", { style:"currency",currency:"BRL" }).format(preview.balance)}</strong></div> : null}{financialConfig.sections.showExpenses ? <div><small>Despesas listadas</small><strong>{preview.expenses.length}</strong></div> : null}</R.ReviewStats>
                <R.ReviewList>
                  <div><dt>Tipo</dt><dd>Relatório financeiro</dd></div>
                  <div><dt>Escopo</dt><dd>{financialConfig.scope === "GENERAL" ? "Geral" : financialConfig.scope === "ENTRIES_ONLY" ? "Apenas entradas" : financialConfig.scope === "EXPENSES_ONLY" ? "Apenas despesas" : "Personalizado"}</dd></div>
                  <div><dt>Organização</dt><dd>{financialConfig.organization === "HIGHEST_VALUE" ? "Maior valor primeiro" : financialConfig.organization === "HIGHEST_QUANTITY" ? "Maior quantidade primeiro" : "Ordem alfabética"}</dd></div>
                  <div><dt>Seções</dt><dd>{listEnabledFinancialSections(financialConfig)}</dd></div>
                  <div><dt>Indicadores e colunas</dt><dd>{listEnabledFinancialColumns(financialConfig)}</dd></div>
                  <div><dt>Orientação do PDF</dt><dd>Retrato</dd></div>
                  <div><dt>Base do total recebido</dt><dd>Somente pagamentos confirmados</dd></div>
                </R.ReviewList>
                <R.OptionSection><header><h4>Filtros aplicados</h4><small>{preview.activeFilterCount} filtro(s)</small></header><R.Chips>{preview.appliedFilters.length ? preview.appliedFilters.map((filter) => <span key={`${filter.label}-${filter.value}`}>{filter.label}: {filter.value}</span>) : <p>Nenhum filtro aplicado.</p>}</R.Chips></R.OptionSection>
                {!canGenerate ? <R.StateBox $danger><SlidersHorizontal /><strong>Nenhum dado financeiro encontrado</strong><p>Ajuste os filtros para localizar inscrições, pagamentos confirmados, itens ou despesas do evento.</p></R.StateBox> : null}
              </> : null}
            </> : null}
            {error && step !== 4 ? <R.ErrorText role="alert">{error}</R.ErrorText> : null}
          </R.StepContent>
        </R.Wizard>
      </Modal> : null}
    </>
  );
}
