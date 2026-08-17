import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const nextDir = ".next";
if (!existsSync(nextDir)) {
  throw new Error("Execute `npm run build` antes de medir os bundles.");
}

const routes = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["membros", "documentos", "estrutura-eclesiastica", "usuarios"];

function findManifests(directory, route, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) findManifests(path, route, found);
    else if (entry.name === "page_client-reference-manifest.js" && path.includes(`/${route}/`)) found.push(path);
  }
  return found;
}

for (const route of routes) {
  const manifestPath = findManifests(join(nextDir, "server", "app"), route)
    .sort((left, right) => left.length - right.length)[0];
  if (!manifestPath) {
    console.warn(`${route}: manifesto não encontrado`);
    continue;
  }

  const source = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(source.slice(source.indexOf("= {") + 2).trim().replace(/;$/, ""));
  const chunks = new Set();
  for (const clientModule of Object.values(manifest.clientModules ?? {})) {
    for (const chunk of clientModule.chunks ?? []) chunks.add(chunk.replace(/^\/_next\//, ""));
  }

  let rawBytes = 0;
  let gzipBytes = 0;
  for (const chunk of chunks) {
    const content = readFileSync(join(nextDir, chunk));
    rawBytes += content.length;
    gzipBytes += gzipSync(content).length;
  }
  console.log(JSON.stringify({
    route: `/${route}`,
    chunks: chunks.size,
    rawKb: Number((rawBytes / 1024).toFixed(1)),
    gzipKb: Number((gzipBytes / 1024).toFixed(1)),
  }));
}
