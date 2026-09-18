import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PublicRequestBodyError, readBoundedJsonBody } from "./public-request";

describe("readBoundedJsonBody", () => {
  it("rejeita imediatamente um Content-Length acima do limite", async () => {
    const request = new Request("http://localhost/api/public/events/event", {
      method: "POST",
      headers: { "content-length": "4096" },
      body: "{}",
    });

    await expect(readBoundedJsonBody(request, 1024)).rejects.toMatchObject({ status: 413 });
  });

  it("mede o corpo em bytes e rejeita um payload acima do limite", async () => {
    const request = new Request("http://localhost/api/public/events/event", {
      method: "POST",
      body: '"áá"',
    });

    await expect(readBoundedJsonBody(request, 5)).rejects.toMatchObject({
      name: "PublicRequestBodyError",
      status: 413,
      message: "Solicitação muito grande.",
    });
  });

  it("cancela a leitura assim que o stream ultrapassa o limite", async () => {
    const read = vi.fn().mockResolvedValueOnce({
      done: false,
      value: new TextEncoder().encode("payload acima do limite"),
    });
    const cancel = vi.fn().mockResolvedValue(undefined);
    const arrayBuffer = vi.fn();
    const request = {
      headers: new Headers(),
      body: { getReader: () => ({ read, cancel }) },
      arrayBuffer,
    } as unknown as Request;

    await expect(readBoundedJsonBody(request, 5)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("distingue JSON inválido de payload excessivo", async () => {
    const request = new Request("http://localhost/api/public/events/event", {
      method: "POST",
      body: "{invalid",
    });

    await expect(readBoundedJsonBody(request, 1024)).rejects.toBeInstanceOf(PublicRequestBodyError);
    await expect(readBoundedJsonBody(new Request("http://localhost", { method: "POST", body: "{invalid" }), 1024))
      .rejects.toMatchObject({ status: 400, message: "Solicitação inválida." });
  });

  it("retorna o JSON válido sem modificar o conteúdo", async () => {
    const request = new Request("http://localhost/api/public/events/event", {
      method: "POST",
      body: JSON.stringify({ checkoutToken: "token" }),
    });

    await expect(readBoundedJsonBody(request, 1024)).resolves.toEqual({ checkoutToken: "token" });
  });
});
