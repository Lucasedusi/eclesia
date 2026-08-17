import { Suspense } from "react";
import { InvitationAccept } from "@/modules/users/components/invitation-accept";
import {
  getInvitationByToken,
  resolveInvitationAccount,
} from "@/modules/users/services/invitation.service";

async function InvitationContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);
  const account = invitation
    ? await resolveInvitationAccount(invitation)
    : null;
  const preview = invitation
    ? {
        invitedName: invitation.invitedName,
        email: invitation.email,
        churchName: invitation.churchName,
        role: invitation.role,
        scope: invitation.scope,
        expiresAt: invitation.expiresAt,
        accountMode:
          account?.mode === "SIGN_IN"
            ? ("SIGN_IN" as const)
            : ("SET_PASSWORD" as const),
      }
    : null;

  return <InvitationAccept token={token} preview={preview} />;
}

export default function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<main aria-busy="true">Validando convite...</main>}>
      <InvitationContent params={params} />
    </Suspense>
  );
}
