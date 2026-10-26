import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
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
