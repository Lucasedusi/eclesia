type OrganizationActionPolicyInput = {
  canManage: boolean;
  canViewDetails: boolean;
  canViewDocuments: boolean;
  protectedItem: boolean;
};

export function getOrganizationActionLayout({
  canManage,
  canViewDetails,
  canViewDocuments,
  protectedItem,
}: OrganizationActionPolicyInput) {
  const showDocuments = canViewDocuments;
  const showStatus = canManage && !protectedItem;
  const showArchive = canManage && !protectedItem;

  return {
    showDetails: canViewDetails,
    showEdit: canManage,
    showDocuments,
    showStatus,
    showArchive,
    showOverflow: showDocuments || showStatus || showArchive,
  };
}
