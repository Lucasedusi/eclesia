const OFFLINE_CACHE = "eclesias-finance-offline-v1";
const OFFLINE_PAGE = "/financeiro-offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_PAGE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      await Promise.all(
        names
          .filter((name) => name.startsWith("eclesias-finance-offline-") && name !== OFFLINE_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!(url.pathname === "/login" || url.pathname === "/financeiro" || url.pathname.startsWith("/financeiro/"))) return;

  event.respondWith(
    fetch(request, { cache: "no-store" }).catch(async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      return (await cache.match(OFFLINE_PAGE)) || Response.error();
    }),
  );
});
