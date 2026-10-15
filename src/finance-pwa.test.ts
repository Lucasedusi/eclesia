import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ authenticated: false, calls: 0 }));
vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: async (request: NextRequest) => {
    session.calls++;
    return {
      response: NextResponse.next({ request }),
      authenticated: session.authenticated,
    };
  },
}));

import { proxy } from "./proxy";

describe("finance PWA access and cache boundaries", () => {
  it("publishes an installable manifest starting at finance", () => {
    const manifest = JSON.parse(readFileSync(resolve("public/financeiro.webmanifest"), "utf8"));
    expect(manifest.id).toBe("/financeiro");
    expect(manifest.start_url).toBe("/financeiro");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === "192x192")).toBe(true);
    expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === "512x512")).toBe(true);
  });

  it("serves public PWA resources but retains finance authentication", async () => {
    session.authenticated = false;
    session.calls = 0;
    for (const path of ["/financeiro.webmanifest", "/financeiro-sw.js", "/financeiro-offline.html"]) {
      const response = await proxy(new NextRequest(`https://example.test${path}`));
      expect(response.status).toBe(200);
    }
    expect(session.calls).toBe(0);
    const response = await proxy(new NextRequest("https://example.test/financeiro?mes=2026-10"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Ffinanceiro%3Fmes%3D2026-10");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("keeps a safe finance return path for an existing login session", async () => {
    session.authenticated = true;
    const response = await proxy(new NextRequest("https://example.test/login?next=%2Ffinanceiro"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/financeiro");
  });
});
