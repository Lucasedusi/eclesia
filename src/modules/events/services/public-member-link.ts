export type PublicMemberClaim = {
  participantKind: "MEMBER" | "VISITOR";
  memberCpf: string;
  memberBirthDate: string;
};

export type PublicMemberLookup = (
  cpf: string,
  birthDate: string,
) => Promise<string | null>;

export function createPublicMemberAttemptHash(secret: string, eventId: string, cpf: string) {
  return createHmac("sha256", secret)
    .update(`event-member-link:${eventId}:${cpf.replace(/\D/g, "")}`)
    .digest("hex");
}

export async function resolvePublicMemberId(
  claim: PublicMemberClaim,
  lookup: PublicMemberLookup,
): Promise<string | null> {
  if (claim.participantKind !== "MEMBER") return null;
  const cpf = claim.memberCpf.replace(/\D/g, "");
  if (cpf.length !== 11 || !/^\d{4}-\d{2}-\d{2}$/.test(claim.memberBirthDate)) {
    return null;
  }
  return lookup(cpf, claim.memberBirthDate);
}

export function buildPublicRegistrationPayload(
  input: Record<string, unknown>,
  memberId: string | null,
): Record<string, unknown> {
  const {
    memberCpf: _memberCpf,
    memberBirthDate: _memberBirthDate,
    memberId: _clientMemberId,
    participantKind: _participantKind,
    ...registration
  } = input;
  void _memberCpf;
  void _memberBirthDate;
  void _clientMemberId;
  void _participantKind;
  const participantType = memberId ? "MEMBER" : "VISITOR";
  return {
    ...registration,
    participantKind: participantType,
    memberId: memberId ?? "",
    participantType,
    registrationSource: "PUBLIC",
    consentAccepted: true,
  };
}
import "server-only";

import { createHmac } from "node:crypto";
