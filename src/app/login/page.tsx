import { AuthShell } from "@/modules/auth/components/auth-shell/auth-shell";
import { LoginForm } from "@/modules/auth/components/login-form";
import { getInitialRegistrationAvailability } from "@/modules/auth/services/initial-registration.service";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string; cadastro?: string }> }) {
  const params = await searchParams;
  let canCreateInitialAccount = false;

  try {
    canCreateInitialAccount = (
      await getInitialRegistrationAvailability()
    ).available;
  } catch {
    canCreateInitialAccount = false;
  }

  return <AuthShell><LoginForm
    next={params.next}
    linkError={params.erro === "link-invalido"}
    canCreateInitialAccount={canCreateInitialAccount}
    registrationStatus={
      params.cadastro === "encerrado"
        ? "closed"
        : params.cadastro === "indisponivel"
          ? "unavailable"
          : undefined
    }
  /></AuthShell>;
}
