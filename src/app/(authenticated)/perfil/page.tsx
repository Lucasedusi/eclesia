import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { ProfileForm } from "@/modules/auth/components/profile/profile-form";

export default async function ProfilePage() {
  const context = await requireAccessContext();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name, display_name, email, phone, whatsapp, locale, timezone").eq("id", context.profile.id).single();
  return <>
    <PageHeader title="Meu perfil" subtitle="Atualize seus dados de exibição e preferências de acesso." badge="Conta pessoal" />
    <ProfileForm profile={{
      fullName: data?.full_name ?? context.profile.fullName,
      displayName: data?.display_name ?? context.profile.displayName,
      email: data?.email ?? context.profile.email,
      phone: data?.phone ?? "", whatsapp: data?.whatsapp ?? "", locale: data?.locale ?? "pt-BR", timezone: data?.timezone ?? "America/Sao_Paulo",
    }}/>
  </>;
}
