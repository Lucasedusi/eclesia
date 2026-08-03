import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max, `Use no máximo ${max} caracteres.`).optional().default("");

const optionalPhone = z
  .string()
  .trim()
  .refine(
    (value) => {
      const length = value.replace(/\D/g, "").length;
      return value === "" || length === 10 || length === 11;
    },
    { message: "Informe o telefone com DDD." },
  )
  .optional()
  .default("");

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    message: "Informe um e-mail válido.",
  })
  .optional()
  .default("");

const optionalZipCode = z
  .string()
  .trim()
  .refine((value) => value === "" || value.replace(/\D/g, "").length === 8, {
    message: "Informe um CEP com 8 dígitos.",
  })
  .optional()
  .default("");

const status = z.enum(["ACTIVE", "INACTIVE"]);
const displayOrder = z.coerce
  .number()
  .int("A ordem deve ser um número inteiro.")
  .min(0, "A ordem não pode ser negativa.")
  .max(999999, "Informe uma ordem menor.");

export const regionSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]).optional().default(""),
  name: z.string().trim().min(2, "Informe o nome da Regional.").max(120),
  description: optionalText(500),
  coordinatorName: optionalText(160),
  coordinatorPhone: optionalPhone,
  displayOrder,
  status,
});

export const congregationSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]).optional().default(""),
  name: z.string().trim().min(2, "Informe o nome da Congregação.").max(160),
  code: optionalText(30).transform((value) => value.toUpperCase()),
  regionId: z.union([z.uuid(), z.literal("")]).optional().default(""),
  displayOrder,
  pastorName: optionalText(160),
  pastorSpouseName: optionalText(160),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  email: optionalEmail,
  zipCode: optionalZipCode,
  address: optionalText(180),
  number: optionalText(20),
  complement: optionalText(100),
  district: optionalText(100),
  city: optionalText(100),
  state: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[A-Za-z]{2}$/.test(value), {
      message: "Use a sigla do estado com 2 letras.",
    })
    .transform((value) => value.toUpperCase())
    .optional()
    .default(""),
  country: z.string().trim().min(2, "Informe o país.").max(80).default("Brasil"),
  notes: optionalText(1000),
  status,
});

export const positionSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]).optional().default(""),
  name: z.string().trim().min(2, "Informe o nome do Cargo.").max(120),
  femaleName: optionalText(120),
  abbreviation: optionalText(30),
  femaleAbbreviation: optionalText(30),
  description: optionalText(500),
  displayOrder,
  status,
});

export const entityIdSchema = z.uuid("Registro inválido.");

export type RegionInput = z.infer<typeof regionSchema>;
export type CongregationInput = z.infer<typeof congregationSchema>;
export type PositionInput = z.infer<typeof positionSchema>;

