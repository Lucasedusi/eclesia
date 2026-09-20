const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE_NAME_PATTERN = /^[A-Za-z0-9._-]{1,180}$/;

export function safeStaticPixReceiptName(fileName: string) {
  const normalized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
  return !normalized || normalized === "." || normalized === ".." ? "comprovante" : normalized;
}

export function isStaticPixReceiptPath(path: string, expectedPrefix: string) {
  if (!path.startsWith(expectedPrefix)) return false;
  const suffix = path.slice(expectedPrefix.length);
  const separator = suffix.indexOf("/");
  if (separator <= 0 || suffix.indexOf("/", separator + 1) !== -1) return false;
  const uploadId = suffix.slice(0, separator);
  const fileName = suffix.slice(separator + 1);
  return UPLOAD_ID_PATTERN.test(uploadId)
    && FILE_NAME_PATTERN.test(fileName)
    && fileName !== "."
    && fileName !== "..";
}
