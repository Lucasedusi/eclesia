export type StatusBase = "ATIVO" | "INATIVO";

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};