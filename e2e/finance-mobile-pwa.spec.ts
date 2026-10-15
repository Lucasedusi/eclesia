import { expect, test } from "@playwright/test";

test("public finance PWA assets are installable and do not reveal data", async ({ request }) => {
  const manifestResponse = await request.get("/financeiro.webmanifest");
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest.start_url).toBe("/financeiro");
  expect(manifest.display).toBe("standalone");
  for (const path of ["/financeiro-icon-192.png", "/financeiro-icon-512.png", "/financeiro-apple-icon.png", "/financeiro-sw.js", "/financeiro-offline.html"]) {
    expect((await request.get(path)).status()).toBe(200);
  }
  const worker = await request.get("/financeiro-sw.js");
  expect(worker.headers()["cache-control"]).toContain("no-cache");
  expect(worker.headers()["service-worker-allowed"]).toBe("/");
  const offline = await (await request.get("/financeiro-offline.html")).text();
  expect(offline).toContain("Sem conexão");
  expect(offline).not.toContain("congregação");
});

test.describe("authenticated finance PWA", () => {
  test.beforeEach(() => {
    test.skip(!process.env.E2E_STORAGE_STATE || !process.env.E2E_FINANCE_FIXTURE, "Requires authenticated local financial fixture");
  });

  test("starts in finance, keeps private responses out of HTTP cache, and falls back offline", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto("/financeiro");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(page.getByRole("button", { name: "Instalar aplicativo" })).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
    });
    const cacheEntries = await page.evaluate(async () => {
      const names = await caches.keys();
      const entries = await Promise.all(names.filter((name) => name.startsWith("eclesias-finance-offline-")).map(async (name) => (await caches.open(name)).keys()));
      return entries.flat().map((entry) => new URL(entry.url).pathname);
    });
    expect(cacheEntries).toEqual(["/financeiro-offline.html"]);
    await page.context().setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Sem conexão" })).toBeVisible();
    await page.context().setOffline(false);
  });

  test("expired finance access returns to finance after login", async ({ browser, page }) => {
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const response = await anonymous.request.get("/financeiro", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/login?next=%2Ffinanceiro");
    await anonymous.close();
    await page.goto("/login?next=%2Ffinanceiro");
    await expect(page).toHaveURL(/\/financeiro/);
  });
});
