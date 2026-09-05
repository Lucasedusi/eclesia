import {fileURLToPath,URL} from "node:url";
import {defineConfig} from "vite";
export default defineConfig({resolve:{alias:{"server-only":fileURLToPath(new URL("./server-only-stub.ts",import.meta.url)),"@":fileURLToPath(new URL("../src",import.meta.url))}}});
