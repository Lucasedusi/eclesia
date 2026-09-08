import { describe, expect, it } from "vitest";
import { getOrganizationActionLayout } from "./organization-action-policy";

describe("getOrganizationActionLayout", () => {
  it("keeps view and edit visible and moves secondary actions to overflow", () => {
    expect(getOrganizationActionLayout({
      canManage: true,
      canViewDetails: true,
      canViewDocuments: false,
      protectedItem: false,
    })).toEqual({
      showDetails: true,
      showEdit: true,
      showDocuments: false,
      showStatus: true,
      showArchive: true,
      showOverflow: true,
    });
  });

  it("keeps documents in overflow but protects the headquarters from status changes", () => {
    expect(getOrganizationActionLayout({
      canManage: true,
      canViewDetails: true,
      canViewDocuments: true,
      protectedItem: true,
    })).toEqual({
      showDetails: true,
      showEdit: true,
      showDocuments: true,
      showStatus: false,
      showArchive: false,
      showOverflow: true,
    });
  });

  it("does not render an empty overflow menu for read-only rows", () => {
    expect(getOrganizationActionLayout({
      canManage: false,
      canViewDetails: true,
      canViewDocuments: false,
      protectedItem: false,
    })).toEqual({
      showDetails: true,
      showEdit: false,
      showDocuments: false,
      showStatus: false,
      showArchive: false,
      showOverflow: false,
    });
  });
});
