"use server";

import type {
  CongregationDetails,
  OrganizationDetailsState,
  RegionDetails,
} from "../types/organization.types";
import {
  getCongregationDetails,
  getRegionDetails,
} from "../services/organization.service";
import { entityIdSchema } from "../validations/organization.schemas";

export async function getRegionDetailsAction(
  idValue: string,
): Promise<OrganizationDetailsState<RegionDetails>> {
  const id = entityIdSchema.safeParse(idValue);
  if (!id.success) {
    return { status: "error", message: "Regional inválida." };
  }

  const region = await getRegionDetails(id.data);
  if (!region) {
    return { status: "error", message: "Regional não encontrada." };
  }

  return { status: "success", data: region };
}

export async function getCongregationDetailsAction(
  idValue: string,
): Promise<OrganizationDetailsState<CongregationDetails>> {
  const id = entityIdSchema.safeParse(idValue);
  if (!id.success) {
    return { status: "error", message: "Congregação inválida." };
  }

  const congregation = await getCongregationDetails(id.data);
  if (!congregation) {
    return { status: "error", message: "Congregação não encontrada." };
  }

  return { status: "success", data: congregation };
}
