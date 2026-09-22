import { describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { getMemberCapabilities } from "./member.service";

vi.mock("server-only", () => ({}));

const baseContext = {
  church: { id: "church-1", name: "Igreja", logoUrl: null },
  profile: {
    id: "profile-1",
    fullName: "Usuário",
    displayName: "Usuário",
    email: "user@example.com",
    avatarUrl: null,
    status: "ACTIVE",
  },
  access: {
    id: "access-1",
    churchId: "church-1",
    role: "ADMIN",
    scope: "CHURCH",
    status: "ACTIVE",
    regionId: null,
    congregationId: null,
    ministryId: null,
  },
  accesses: [],
  availableChurches: [],
  permissions: [],
} satisfies AuthContext;

describe("getMemberCapabilities", () => {
  it("expõe emissão somente com members.credentials.issue", () => {
    expect(getMemberCapabilities(baseContext).issueCredential).toBe(false);
    expect(
      getMemberCapabilities({
        ...baseContext,
        permissions: [PERMISSIONS.membersCredentialIssue],
      }).issueCredential,
    ).toBe(true);
  });
});
