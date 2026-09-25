import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("../../actions/church-logo.actions", () => ({ uploadChurchCredentialLogoAction: vi.fn() }));

import { ChurchCredentialLogoForm } from "./church-credential-logo-form";

describe("ChurchCredentialLogoForm", () => {
  it("mostra a logo oficial e permite substituí-la somente para quem tem permissão", () => {
    const editable = renderToStaticMarkup(createElement(ChurchCredentialLogoForm, { logoDataUri: "data:image/png;base64,iVBORw0KGgo=", canUpdate: true }));
    expect(editable).toContain('alt="Logo atual da carteirinha"');
    expect(editable).toContain('name="logo"');
    expect(editable).toContain('type="submit"');
    const readonly = renderToStaticMarkup(createElement(ChurchCredentialLogoForm, { logoDataUri: null, canUpdate: false }));
    expect(readonly).not.toContain('name="logo"');
  });
});
