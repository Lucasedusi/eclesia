import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { ChurchSettingsForm } from "@/modules/auth/components/church-settings/church-settings-form";

export default async function SettingsPage() {
  const context = await requireAccessContext(PERMISSIONS.settingsView);
  const supabase = await createClient();
  const [church, settings] = await Promise.all([
    supabase.from("churches").select("name, legal_name, document, email, phone, whatsapp, senior_pastor_name, senior_pastor_spouse_name").eq("id",context.church.id).single(),
    supabase.from("app_settings").select("display_church_name, member_code_prefix, member_code_padding").eq("church_id",context.church.id).is("deleted_at",null).single(),
  ]);
  return <>
    <PageHeader title="Configurações da igreja" subtitle="Revise a identidade institucional e as preferências iniciais definidas no onboarding." badge="Administração" />
    <ChurchSettingsForm canUpdate={hasPermission(context.permissions,PERMISSIONS.churchUpdate)} values={{
      name:church.data?.name,legalName:church.data?.legal_name,document:church.data?.document,email:church.data?.email,
      phone:church.data?.phone,whatsapp:church.data?.whatsapp,seniorPastorName:church.data?.senior_pastor_name,
      seniorPastorSpouseName:church.data?.senior_pastor_spouse_name,displayName:settings.data?.display_church_name ?? church.data?.name,
      memberCodePrefix:settings.data?.member_code_prefix ?? "MEM",memberCodePadding:settings.data?.member_code_padding ?? 4,
    }}/>
  </>;
}
