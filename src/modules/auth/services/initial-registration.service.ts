import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { createAdminClient } from "@/lib/supabase/admin";

export type InitialRegistrationAvailability = {
  available: boolean;
  hasChurch: boolean;
};

async function queryInitialRegistrationAvailability(): Promise<InitialRegistrationAvailability> {
  const admin = createAdminClient();
  const [usersResult, profilesResult, churchesResult] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("churches").select("id", { count: "exact", head: true }),
  ]);

  const error =
    usersResult.error ?? profilesResult.error ?? churchesResult.error;

  if (error) {
    console.error("[initial-registration] Availability check failed", error);
    throw new Error("INITIAL_REGISTRATION_CHECK_FAILED");
  }

  const hasAccount =
    usersResult.data.users.length > 0 || (profilesResult.count ?? 0) > 0;
  const hasChurch = (churchesResult.count ?? 0) > 0;

  return { available: !hasAccount && !hasChurch, hasChurch };
}

export async function getInitialRegistrationAvailability(): Promise<InitialRegistrationAvailability> {
  return queryInitialRegistrationAvailability();
}

export async function getCachedInitialRegistrationAvailability(): Promise<InitialRegistrationAvailability> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.initialRegistration);
  return queryInitialRegistrationAvailability();
}
