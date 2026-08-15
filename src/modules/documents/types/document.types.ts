export type DocumentContainerStatus = "ACTIVE" | "ARCHIVED";
export type DocumentEffectiveStatus = "ACTIVE" | "ARCHIVED" | "DELETED";
export type DocumentSort =
  | "RECENT"
  | "OLDEST"
  | "TITLE_ASC"
  | "SIZE_DESC"
  | "SIZE_ASC";

export type DocumentCategoryItem = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  status: DocumentContainerStatus;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentFolderItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  physicalLocation: string | null;
  status: DocumentContainerStatus;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentTagItem = {
  id: string;
  name: string;
};

export type DocumentUploaderItem = {
  id: string;
  name: string;
};

export type AdministrativeDocumentItem = {
  id: string;
  folderId: string;
  folderName: string;
  categoryId: string;
  categoryName: string;
  title: string;
  description: string | null;
  documentDate: string | null;
  referenceNumber: string | null;
  physicalLocation: string | null;
  notes: string | null;
  originalFileName: string;
  mimeType: string;
  fileExtension: string;
  fileSize: number;
  status: DocumentContainerStatus;
  effectiveStatus: DocumentEffectiveStatus;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  updatedAt: string;
  tags: DocumentTagItem[];
};

export type DocumentListParams = {
  search: string;
  categoryId: string;
  folderId: string;
  tagId: string;
  format: string;
  state: DocumentEffectiveStatus;
  dateFrom: string;
  dateTo: string;
  uploadedBy: string;
  sort: DocumentSort;
  page: number;
  pageSize: number;
};

export type DocumentStats = {
  active: number;
  archived: number;
  deleted: number;
  categories: number;
  folders: number;
};

export type DocumentListResult = {
  items: AdministrativeDocumentItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type DocumentWorkspaceData = {
  categories: DocumentCategoryItem[];
  folders: DocumentFolderItem[];
  tags: DocumentTagItem[];
  uploaders: DocumentUploaderItem[];
  stats: DocumentStats;
  documents: DocumentListResult;
  params: DocumentListParams;
};

export type DocumentActionState = {
  status: "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type PreparedDocumentUpload = {
  clientId: string;
  documentId?: string;
  path?: string;
  token?: string;
  contentType?: string;
  status: "success" | "error";
  message: string;
};

export type PreparedReplacement = DocumentActionState & {
  documentId?: string;
  path?: string;
  token?: string;
  contentType?: string;
};

export type UploadFinalizationResult = {
  documentId: string;
  status: "success" | "error";
  message: string;
};

export const DEFAULT_DOCUMENT_LIST_PARAMS: DocumentListParams = {
  search: "",
  categoryId: "",
  folderId: "",
  tagId: "",
  format: "",
  state: "ACTIVE",
  dateFrom: "",
  dateTo: "",
  uploadedBy: "",
  sort: "RECENT",
  page: 1,
  pageSize: 20,
};
