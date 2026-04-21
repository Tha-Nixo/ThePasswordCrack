import { build } from "esbuild";

const common = {
  bundle: true,
  format: "iife",
  target: "chrome120",
  sourcemap: true,
  minify: false,
};

await Promise.all([
  build({ ...common, entryPoints: ["src/content/index.ts"], outfile: "dist/content.js" }),
  build({ ...common, entryPoints: ["src/popup/popup.ts"], outfile: "dist/popup.js" }),
  build({ ...common, entryPoints: ["src/background/service-worker.ts"], outfile: "dist/service-worker.js" }),
]);
