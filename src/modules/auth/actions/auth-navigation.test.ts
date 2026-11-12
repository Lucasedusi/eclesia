import { beforeEach, expect, it, vi } from "vitest";
import { INITIAL_ACTION_STATE } from "../types/auth.types";
import { loginAction, logoutAction, signUpAction, updatePasswordAction } from "./auth.actions";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  deleteCookie: vi.fn(),
  createUser: vi.fn(),
  registration: vi.fn(),
  destination: vi.fn(),
  redirect: vi.fn(() => { throw new Error("navigation"); }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword: mocks.signIn, updateUser: mocks.updateUser, signOut: mocks.signOut } }),
}));
vi.mock("../services/access-context.service", () => ({
  getAuthenticatedDestination: mocks.destination,
  CHURCH_CONTEXT_COOKIE: "church-context",
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { createUser: mocks.createUser } } }),
}));
vi.mock("../services/initial-registration.service", () => ({
  getInitialRegistrationAvailability: mocks.registration,
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: mocks.deleteCookie }) }));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, RedirectType: { replace: "replace" } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
});

function loginFields(next: string) {
  const form = new FormData();
  form.set("email", "teste@example.invalid");
  form.set("password", "Exemplo123");
  form.set("next", next);
  return form;
}

it.each([
  ["/", "/membros?status=ACTIVE", "/membros?status=ACTIVE"],
  ["/onboarding", "/membros", "/onboarding"],
  ["/", "//example.invalid", "/"],
  ["/onboarding", "/redefinir-senha", "/redefinir-senha"],
])("conclui o login com redirecionamento único (%s, %s)", async (destination, next, expected) => {
  mocks.destination.mockResolvedValue(destination);
  await expect(loginAction(INITIAL_ACTION_STATE, loginFields(next))).rejects.toThrow("navigation");
  expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith(expected, "replace");
});

it("mantém o formulário disponível se a autenticação falhar", async () => {
  mocks.signIn.mockResolvedValue({ error: { message: "invalid credentials" } });
  await expect(loginAction(INITIAL_ACTION_STATE, loginFields("/"))).resolves.toMatchObject({ status: "error" });
  expect(mocks.redirect).not.toHaveBeenCalled();
});

it("encerra a redefinição bem-sucedida no servidor", async () => {
  const form = new FormData();
  form.set("password", "Exemplo123");
  form.set("passwordConfirmation", "Exemplo123");
  await expect(updatePasswordAction(INITIAL_ACTION_STATE, form)).rejects.toThrow("navigation");
  expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/", "replace");
});

it("leva a primeira conta criada para o onboarding", async () => {
  mocks.registration.mockResolvedValue({ available: true });
  mocks.createUser.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
  const form = loginFields("/");
  form.set("fullName", "Nome de teste");
  form.set("passwordConfirmation", "Exemplo123");
  form.set("acceptedTerms", "on");
  await expect(signUpAction(INITIAL_ACTION_STATE, form)).rejects.toThrow("navigation");
  expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/onboarding", "replace");
});

it("encerra a sessão, limpa a igreja ativa e substitui a página pelo login", async () => {
  await expect(logoutAction()).rejects.toThrow("navigation");
  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(mocks.deleteCookie).toHaveBeenCalledExactlyOnceWith("church-context");
  expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/login", "replace");
});
