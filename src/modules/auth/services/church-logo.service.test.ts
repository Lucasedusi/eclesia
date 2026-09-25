import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadChurchLogoDataUri, validateChurchLogoFile } from "./church-logo.service";

const churchId = "11111111-1111-4111-8111-111111111111";
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

describe("church logo", () => {
  it("aceita somente imagem pequena com assinatura compatível", async () => {
    expect(await validateChurchLogoFile(new File([png], "logo.png", { type: "image/png" })))
      .toMatchObject({ mimeType: "image/png", extension: "png" });
    expect(await validateChurchLogoFile(new File(["not an image"], "logo.png", { type: "image/png" }))).toBeNull();
    expect(await validateChurchLogoFile(new File([png], "logo.svg", { type: "image/svg+xml" }))).toBeNull();
    expect(await validateChurchLogoFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }))).toBeNull();
  });

  it("baixa apenas a logo privada do tenant autenticado", async () => {
    const download = vi.fn().mockResolvedValue({ data: new Blob([png], { type: "image/png" }), error: null });
    const client = { storage: { from: vi.fn(() => ({ download })) } };
    const path = `church-logos/${churchId}/22222222-2222-4222-8222-222222222222.png`;
    const result = await loadChurchLogoDataUri(path, churchId, client as never);
    expect(result).toBe(`data:image/png;base64,${Buffer.from(png).toString("base64")}`);
    expect(download).toHaveBeenCalledWith(`${churchId}/22222222-2222-4222-8222-222222222222.png`);
    expect(await loadChurchLogoDataUri(path, "33333333-3333-4333-8333-333333333333", client as never)).toBeNull();
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("mantém a carteirinha disponível quando a imagem privada falha", async () => {
    const client = { storage: { from: vi.fn(() => ({ download: vi.fn().mockRejectedValue(new Error("storage offline")) })) } };
    const path = `church-logos/${churchId}/22222222-2222-4222-8222-222222222222.png`;
    await expect(loadChurchLogoDataUri(path, churchId, client as never)).resolves.toBeNull();
  });
});
