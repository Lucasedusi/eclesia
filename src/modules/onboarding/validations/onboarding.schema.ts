import { z } from "zod";

const optionalEmail = z
  .string()
  .trim()
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    message: "Informe um e-mail válido.",
  });

const optionalCnpj = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || value.replace(/\D/g, "").length === 14,
    { message: "Informe um CNPJ com 14 dígitos." },
  );

const optionalPhone = z
  .string()
  .trim()
  .refine(
    (value) => {
      const length = value.replace(/\D/g, "").length;
      return value === "" || length === 10 || length === 11;
    },
    { message: "Informe o telefone com DDD." },
  );

export const onboardingSchema = z.object({
  church_name: z.string().trim().min(3, "Informe o nome da igreja ou campo."),
  legal_name: z.string().trim().max(180).optional().default(""),
  document: optionalCnpj.optional().default(""),
  church_email: optionalEmail.optional().default(""),
  phone: optionalPhone.optional().default(""),
  whatsapp: optionalPhone.optional().default(""),
  zip_code: z.string().trim().max(10).optional().default(""),
  address: z.string().trim().min(3, "Informe o endereço principal."),
  number: z.string().trim().max(20).optional().default(""),
  complement: z.string().trim().max(100).optional().default(""),
  district: z.string().trim().min(2, "Informe o bairro."),
  city: z.string().trim().min(2, "Informe a cidade."),
  state: z.string().trim().length(2, "Use a sigla do estado com 2 letras."),
  country: z.string().trim().min(2).default("Brasil"),
  senior_pastor_name: z.string().trim().min(3, "Informe o Pastor Presidente."),
  senior_pastor_spouse_name: z.string().trim().max(160).optional().default(""),
  headquarters_name: z.string().trim().min(3, "Informe o nome da Congregação Sede."),
  headquarters_code: z.string().trim().min(2).max(20).default("SEDE"),
  headquarters_pastor_name: z.string().trim().max(160).optional().default(""),
  headquarters_pastor_spouse_name: z.string().trim().max(160).optional().default(""),
  app_name: z.string().trim().min(2).max(60).default("Eclesias"),
  display_church_name: z.string().trim().min(2, "Informe o nome de exibição."),
  member_code_prefix: z
    .string()
    .trim()
    .min(1, "Informe o prefixo.")
    .max(8)
    .regex(/^[A-Za-z0-9]+$/, "Use somente letras e números."),
  member_code_next_number: z.coerce.number().int().min(1).max(99999999),
  member_code_padding: z.coerce.number().int().min(1).max(10),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
