import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type WorkerEvent = { waitUntil?: (promise: Promise<unknown>) => void; respondWith?: (promise: Promise<Response>) => void; request?: { url: string; mode: string; method: string } };

function worker(online: boolean) {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const cached: string[] = [];
  const requests: string[] = [];
  const offline = new Response("Sem conexão", { status: 200 });
  const cache = {
    add: async (url: string) => { cached.push(url); },
    match: async (url: string) => url === "/financeiro-offline.html" ? offline : undefined,
  };
  const code = readFileSync(resolve("public/financeiro-sw.js"), "utf8");
  runInNewContext(code, {
    self: {
      location: { origin: "https://example.test" },
      clients: { claim: async () => {} },
      addEventListener: (name: string, handler: (event: WorkerEvent) => void) => listeners.set(name, handler),
      skipWaiting: () => {},
    },
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: async (request: { url: string }) => {
      requests.push(request.url);
      if (!online) throw new Error("offline");
      return new Response("private finance HTML");
    },
    Response, URL, Promise,
  });
  return { listeners, cached, requests };
}

describe("finance service worker cache", () => {
  it("prepares only the generic offline document", async () => {
    const state = worker(true);
    let done: Promise<unknown> | undefined;
    state.listeners.get("install")?.({ waitUntil: (promise) => { done = promise; } });
    await done;
    expect(state.cached).toEqual(["/financeiro-offline.html"]);
  });

  it("uses the network for finance and returns the neutral page only when offline", async () => {
    const state = worker(false);
    let result: Promise<Response> | undefined;
    state.listeners.get("fetch")?.({
      request: { url: "https://example.test/financeiro/lancamentos", mode: "navigate", method: "GET" },
      respondWith: (promise) => { result = promise; },
    });
    expect(await (await result)!.text()).toBe("Sem conexão");
    expect(state.requests).toEqual(["https://example.test/financeiro/lancamentos"]);
    expect(state.cached).toEqual([]);
  });
});
