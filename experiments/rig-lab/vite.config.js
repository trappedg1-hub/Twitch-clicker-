import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  // The lab borrows the game's public folder so the rig document can point at /art/...
  publicDir: resolve(here, "../../public"),
  server: { host: "0.0.0.0", port: 5187, allowedHosts: true, cors: true },
  preview: { host: "0.0.0.0", port: 4187, allowedHosts: true },
  // The lab lives inside the game repo, so bare imports resolve up to the game's node_modules.
  resolve: { alias: { "@openbone/pixi": resolve(here, "../../node_modules/@openbone/pixi/dist/index.js") } },
});
