import { build } from "esbuild";
import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await build({
  entryPoints: ["server/worker.ts"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
});
await cp("out", "dist/client", { recursive: true });
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
await writeFile(
  "dist/server/wrangler.json",
  JSON.stringify({
    name: "shelf-sense",
    main: "index.js",
    compatibility_date: "2026-05-15",
    compatibility_flags: ["nodejs_compat"],
    assets: {
      directory: "../client",
      binding: "ASSETS",
      run_worker_first: ["/api/*"],
    },
  }),
);
console.log("Next export + protected AI Worker ready.");
