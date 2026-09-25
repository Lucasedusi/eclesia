import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAccessContext: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("../services/access-context.service", () => ({ requireAccessContext: mocks.requireAccessContext }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, updateTag: mocks.updateTag }));

import { uploadChurchCredentialLogoAction } from "./church-logo.actions";

const churchId = "11111111-1111-4111-8111-111111111111";
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

function setup() {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const settings = {
    select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { logo_url: null }, error: null }),
    update: vi.fn(), single: vi.fn().mockResolvedValue({ data: { id: "settings-1" }, error: null }),
  };
  settings.select.mockReturnValue(settings);
  settings.eq.mockReturnValue(settings);
  settings.is.mockReturnValue(settings);
  settings.update.mockReturnValue(settings);
  mocks.createClient.mockResolvedValue({
    from: vi.fn(() => settings),
    storage: { from: vi.fn(() => ({ upload, remove })) },
  });
  return { upload, remove, settings };
}

function form(file: File) {
  const data = new FormData();
  data.set("logo", file);
  return data;
}

describe("uploadChurchCredentialLogoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAccessContext.mockResolvedValue({ church: { id: churchId } });
  });

  it("rejeita arquivo inválido antes de gravar no banco ou Storage", async () => {
    const { upload, settings } = setup();
    const result = await uploadChurchCredentialLogoAction({ status: "idle", message: "" }, form(new File(["bad"], "logo.png", { type: "image/png" })));
    expect(result.status).toBe("error");
    expect(upload).not.toHaveBeenCalled();
    expect(settings.update).not.toHaveBeenCalled();
  });

  it("não recebe logo quando o usuário não possui permissão para alterar configurações", async () => {
    const { upload, settings } = setup();
    mocks.requireAccessContext.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(uploadChurchCredentialLogoAction({ status: "idle", message: "" }, form(new File([png], "logo.png", { type: "image/png" })))).rejects.toThrow("FORBIDDEN");
    expect(upload).not.toHaveBeenCalled();
    expect(settings.update).not.toHaveBeenCalled();
  });

  it("salva a logo apenas na configuração da igreja autorizada", async () => {
    const { upload, settings } = setup();
    const result = await uploadChurchCredentialLogoAction({ status: "idle", message: "" }, form(new File([png], "logo.png", { type: "image/png" })));
    expect(result.status).toBe("success");
    expect(mocks.requireAccessContext).toHaveBeenCalledWith("settings.update");
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${churchId}/[0-9a-f-]+\\.png$`)), expect.any(Uint8Array), expect.objectContaining({ contentType: "image/png", upsert: false }));
    expect(settings.update).toHaveBeenCalledWith({ logo_url: expect.stringMatching(new RegExp(`^church-logos/${churchId}/[0-9a-f-]+\\.png$`)) });
    expect(settings.eq.mock.calls).toContainEqual(["church_id", churchId]);
  });

  it("remove o arquivo recém-enviado se a atualização do banco falhar", async () => {
    const { remove, settings } = setup();
    settings.single.mockResolvedValue({ data: null, error: { message: "denied" } });
    const result = await uploadChurchCredentialLogoAction({ status: "idle", message: "" }, form(new File([png], "logo.png", { type: "image/png" })));
    expect(result.status).toBe("error");
    expect(remove).toHaveBeenCalledWith([expect.stringMatching(new RegExp(`^${churchId}/`))]);
  });
});
