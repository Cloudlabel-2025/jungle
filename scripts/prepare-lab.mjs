import { build } from "esbuild";
import { mkdir, cp } from "node:fs/promises";
await mkdir("public/vendor/face", { recursive: true });
await cp("node_modules/@mediapipe/tasks-vision/wasm", "public/vendor/face/wasm", { recursive: true });
await mkdir("public/vendor", { recursive: true });
await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; window.React=React; window.createRoot=createRoot;`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: "public/vendor/lab-runtime.js",
  format: "iife",
  platform: "browser",
  legalComments: "eof",
});
console.log("Isolated React runtime bundled locally.");
await build({
  entryPoints: ["scripts/local-code-sync.mjs"],
  outfile: "public/vendor/local-code-sync.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  legalComments: "eof",
});
console.log("Project-only local sync runner bundled.");
