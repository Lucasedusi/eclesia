import "server-only";

export class PublicRequestBodyError extends Error {
  constructor(message: string, readonly status: 400 | 413) {
    super(message);
    this.name = "PublicRequestBodyError";
  }
}

export async function readBoundedJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PublicRequestBodyError("Solicitação muito grande.", 413);
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new PublicRequestBodyError("Solicitação inválida.", 400);
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PublicRequestBodyError("Solicitação muito grande.", 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof PublicRequestBodyError) throw error;
    throw new PublicRequestBodyError("Solicitação inválida.", 400);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw new PublicRequestBodyError("Solicitação inválida.", 400);
  }
}
