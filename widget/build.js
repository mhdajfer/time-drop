import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { build, context } from "esbuild";

const outfile = "extensions/countdown-timer/assets/countdown-timer.js";

const options = {
  entryPoints: ["widget/src/index.jsx"],
  outfile,
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  jsxImportSource: "preact",
  legalComments: "none",
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  await (await context(options)).watch();
} else {
  await build(options);

  const bundle = readFileSync(outfile);
  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
  console.log(`Widget bundle: ${kb(bundle.length)} (${kb(gzipSync(bundle).length)} gzipped)`);
}
