import { Suspense } from "react";
import { AuthShell } from "@/modules/auth/components/auth-shell/auth-shell";
import { LoginForm } from "@/modules/auth/components/login-form";
import { LoginFormSkeleton } from "@/modules/auth/components/login-form-skeleton";
import { getCachedInitialRegistrationAvailability } from "@/modules/auth/services/initial-registration.service";

async function LoginContent({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string; cadastro?: string }> }) {
  const params = await searchParams;
  let canCreateInitialAccount = false;

  try {
    canCreateInitialAccount = (
      await getCachedInitialRegistrationAvailability()
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

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string; cadastro?: string }> }) {
  return (
    <Suspense fallback={<AuthShell><LoginFormSkeleton /></AuthShell>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
