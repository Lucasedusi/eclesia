import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { CheckCircle2, ShieldCheck, ShieldX } from "lucide-react";
import { loadPublicMemberCredentialValidation } from "@/modules/members/services/member-credential-token.service";
import styles from "./validation.module.css";

export const metadata: Metadata = {
  title: "Validar credencial | Eclésias",
  robots: { index: false, follow: false },
};

async function ValidationResult({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const result = await loadPublicMemberCredentialValidation(token);

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-live="polite">
        <div className={result.valid ? styles.validIcon : styles.invalidIcon}>
          {result.valid ? <ShieldCheck aria-hidden="true" /> : <ShieldX aria-hidden="true" />}
        </div>
        <p className={styles.eyebrow}>VALIDAÇÃO DE CREDENCIAL</p>
        <h1>{result.valid ? "Credencial válida" : "Credencial inválida"}</h1>
        {result.valid ? (
          <>
            <p className={styles.lead}>Os dados essenciais desta credencial foram confirmados.</p>
            <dl className={styles.details}>
              <div><dt>Membro</dt><dd>{result.memberName}</dd></div>
              <div><dt>Igreja</dt><dd>{result.churchName}</dd></div>
              <div><dt>Congregação</dt><dd>{result.congregationName}</dd></div>
              <div><dt>Emitida em</dt><dd>{result.issuedDate}</dd></div>
            </dl>
            <p className={styles.confirmation}><CheckCircle2 aria-hidden="true" /> Validação realizada pelo Eclésias</p>
          </>
        ) : (
          <p className={styles.lead}>Este código não existe, expirou ou a credencial foi revogada.</p>
        )}
      </section>
    </main>
  );
}

function ValidationFallback() {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-busy="true">
        <p className={styles.eyebrow}>VALIDAÇÃO DE CREDENCIAL</p>
        <h1>Verificando...</h1>
        <p className={styles.lead}>Aguarde enquanto confirmamos esta credencial.</p>
      </section>
    </main>
  );
}

export default function MemberCredentialValidationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<ValidationFallback />}>
      <ValidationResult params={params} />
    </Suspense>
  );
}
