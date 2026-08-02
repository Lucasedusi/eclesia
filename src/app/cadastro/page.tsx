import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/modules/auth/components/auth-shell/auth-shell";
import { SignUpForm } from "@/modules/auth/components/signup-form";
import { getInitialRegistrationAvailability } from "@/modules/auth/services/initial-registration.service";

export default async function SignUpPage() {
  await connection();

  let available = false;
  let checkFailed = false;

  try {
    available = (await getInitialRegistrationAvailability()).available;
  } catch {
    checkFailed = true;
  }

  if (!available) {
    redirect(
      checkFailed
        ? "/login?cadastro=indisponivel"
        : "/login?cadastro=encerrado",
    );
  }

  return (
    <AuthShell>
      <SignUpForm />
    </AuthShell>
  );
}
