import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type InitialRegistrationAvailability = {
  available: boolean;
  hasChurch: boolean;
};

export async function getInitialRegistrationAvailability(): Promise<InitialRegistrationAvailability> {
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
