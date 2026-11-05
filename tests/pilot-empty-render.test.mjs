import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import manifests from "../lib/pilot-manifests.json" with { type: "json" };

test("programme workspace renders a successful no-sprint response for Gamer, MC and CC", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url)),
    out = fileURLToPath(
      new URL("../.data/pilot-render-test/component.cjs", import.meta.url),
    );
  await mkdir(new URL("../.data/pilot-render-test/", import.meta.url), {
    recursive: true,
  });
  await build({
    entryPoints: [root + "components/PilotWorkspace.js"],
    outfile: out,
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    jsx: "automatic",
    loader: { ".js": "jsx" },
    alias: { "@": root },
    logLevel: "silent",
    plugins: [
      {
        name: "loaded-response-fixture",
        setup(builder) {
          builder.onLoad(
            { filter: /PilotWorkspace\.js$/ },
            async ({ path }) => {
              const source = await readFile(path, "utf8"),
                needle = "const [data, setData] = useState(null)";
              assert.ok(source.includes(needle));
              return {
                contents: source.replace(
                  needle,
                  "const [data, setData] = useState(globalThis.__pilotRenderResponse)",
                ),
                loader: "jsx",
              };
            },
          );
        },
      },
    ],
  });
  const Component = createRequire(import.meta.url)(out).default;
  try {
    for (const role of ["GAMER", "MISSION_COMMANDER", "CENTRE_COMMAND"]) {
      // Exercise the exact minimal response that caused the reported crash.
      globalThis.__pilotRenderResponse = {
        setup:
          role === "CENTRE_COMMAND"
            ? { manifests, roster: [], source: [] }
            : null,
        sprint: null,
      };
      const html = renderToStaticMarkup(
        createElement(Component, {
          user: { _id: "render-user", role },
          mode: role === "CENTRE_COMMAND" ? "setup" : "board",
        }),
      );
      assert.match(html, /Weekly sprint work opens after CC publishes/);
      if (role === "CENTRE_COMMAND") {
        assert.match(html, /NOT CONFIGURED/);
        assert.match(html, /Stage approved sprint configuration/);
      }
    }
  } finally {
    delete globalThis.__pilotRenderResponse;
  }
});
