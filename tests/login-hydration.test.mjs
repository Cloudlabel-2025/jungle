import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
async function ssr(file, props = {}) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [file],
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    jsx: "automatic",
    loader: { ".js": "jsx" },
    alias: { "@": root },
    write: false,
    logLevel: "silent",
  });
  const module = { exports: {} };
  runInNewContext(result.outputFiles[0].text, {
    module,
    exports: module.exports,
    require,
    console,
  });
  return renderToStaticMarkup(
    React.createElement(module.exports.default, props),
  );
}
for (const [label, file, props] of [
  ["player and staff login", "components/ExpeditionLogin.js", {}],
  ["platform login", "components/PlatformDashboard.js", {}],
  [
    "first password setup",
    "components/InitialPasswordChange.js",
    { user: { name: "Fictional QA", role: "GAMER" } },
  ],
])
  test(`${label}: native fallback never sends credentials in a URL before hydration`, async () => {
    const html = await ssr(file, props);
    const forms = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)];
    assert.equal(forms.length, 1);
    assert.match(forms[0][0], /^<form\b[^>]*method="post"/);
    const submit = [...forms[0][1].matchAll(/<button\b([^>]*)>/g)].filter(
      ([, attributes]) => !attributes.includes('type="button"'),
    );
    assert.equal(submit.length, 1);
    assert.match(
      submit[0][1],
      /\bdisabled=""/,
      "submission must wait for the client handler",
    );
  });
