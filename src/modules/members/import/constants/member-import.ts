export const MEMBER_IMPORT_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MEMBER_IMPORT_MAX_ROWS = 500;
export const MEMBER_IMPORT_NORMALIZATION_VERSION = 3;

export const MEMBER_IMPORT_COLUMNS = [
  "nome",
  "fone",
  "dtnascimento",
  "cargo",
  "cpf",
  "estadocivil",
  "dtcadastro",
  "sexo",
  "cep",
  "cidade",
  "estado",
  "naturalidade_cidade",
  "naturalidade_uf",
  "nome_pai",
  "nome_mae",
  "data_batismo_agua",
  "data_batismo_espirito",
  "data_conversao",
] as const;

export const MEMBER_IMPORT_HEADER_ALIASES: Readonly<Record<string, (typeof MEMBER_IMPORT_COLUMNS)[number]>> = {
  data_batismo: "data_batismo_agua",
};

export const MEMBER_IMPORT_REQUIRED_COLUMNS = ["nome", "cargo"] as const;

export const MEMBER_IMPORT_STEPS = [
  { id: 1, title: "Destino e arquivo", description: "Selecione a Congregação e a planilha." },
  { id: 2, title: "Validação", description: "Confira colunas, Cargos e inconsistências." },
  { id: 3, title: "Revisão", description: "Decida o que importar ou pular." },
  { id: 4, title: "Confirmação", description: "Revise o resumo e execute o lote." },
] as const;

export const MEMBER_IMPORT_PAGE_SIZES = [20, 50, 100] as const;

export const MEMBER_IMPORT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  REVIEW: "Em revisão",
  READY: "Pronto",
  PROCESSING: "Processando",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  ROLLED_BACK: "Desfeito",
};

export const MEMBER_IMPORT_CLASSIFICATION_LABELS: Record<string, string> = {
  VALID: "Pronto",
  WARNING: "Alerta",
  ERROR: "Erro",
  SKIPPED: "Pulado",
  IMPORTED: "Importado",
};

export const MARITAL_STATUS_IMPORT_OPTIONS = [
  { value: "SINGLE", label: "Solteiro(a)" },
  { value: "MARRIED", label: "Casado(a)" },
  { value: "DIVORCED", label: "Divorciado(a)" },
  { value: "SEPARATED", label: "Separado(a)" },
  { value: "WIDOWED", label: "Viúvo(a)" },
  { value: "STABLE_UNION", label: "União estável" },
  { value: "OTHER", label: "Outro" },
] as const;

export const BRAZILIAN_STATE_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;
