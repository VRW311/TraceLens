import { defineConfig } from "vite";
import { readFileSync, existsSync } from "node:fs";
export default defineConfig({
  root: "web",
  base: "/TraceLens/",
  build: { outDir: "../dist", emptyOutDir: true },
  plugins: [
    {
      name: "tracelens-assets",
      buildStart() {
        if (!existsSync("web/public/wasm/tracelens.wasm"))
          throw new Error(
            "Build the real C++ WebAssembly engine first: npm run build:wasm",
          );
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "samples/checkout-outage.tsv",
          source: readFileSync("samples/checkout-outage.tsv"),
        });
      },
      configureServer(server) {
        server.middlewares.use(
          "/TraceLens/samples/checkout-outage.tsv",
          (_req, res) => {
            res.setHeader("Content-Type", "text/tab-separated-values");
            res.end(readFileSync("samples/checkout-outage.tsv"));
          },
        );
      },
    },
  ],
});
