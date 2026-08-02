import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/modules/onboarding/components/onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { count } = await supabase
    .from("user_church_access")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("status", "ACTIVE")
    .is("deleted_at", null);

  if (count && count > 0) redirect("/");

  const administratorName =
    String(user.user_metadata.full_name ?? "").trim() ||
    user.email?.split("@")[0] ||
    "Responsável inicial";

  return <OnboardingWizard administratorName={administratorName} />;
}
