import { initialFiles } from "./lab-project.js";

// Export and runtime use the same runnable project; no generated package secrets.
export const teamInitialFiles = {
  ...initialFiles,
  "package.json":
    JSON.stringify(
      {
        name: "wilderness-team-project",
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "vite --host 0.0.0.0",
          test: "node --import ./tests/register.mjs --test tests/ledger.test.js",
        },
        dependencies: { react: "19.2.0", "react-dom": "19.2.0", vite: "6.4.6" },
      },
      null,
      2,
    ) + "\n",
  "index.html":
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n',
  "src/main.jsx":
    "import React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport App from './App.jsx';\nimport './styles.css';\nglobalThis.React = React;\ncreateRoot(document.getElementById('root')).render(<App />);\n",
  "tests/register.mjs":
    "import {createServer} from 'vite';\nimport React from 'react';\nimport assert from 'node:assert/strict';\nimport {test} from 'node:test';\n// Load the same app and imports used in the preview.\nglobalThis.React = React;\nconst server = await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});\ntry {\n  const app = await server.ssrLoadModule('/src/App.jsx');\n  Object.assign(globalThis, {test, assert, ...app});\n} finally { await server.close(); }\n",
  "README.md":
    "# Wilderness team project\n\nInstall Node.js 22.15 or later. Run `npm install`, then `npm run dev` for the preview or `npm test` for ledger tests.\n\nThe browser studio shares saved source with your team. Terminal sessions and previews run independently. Downloaded files are a snapshot; local edits are not automatically uploaded.\n",
};

// React is available in the original sandbox as a global. A normal module needs
// the import before App.jsx evaluates (main.jsx assignments run too late).
teamInitialFiles["src/App.jsx"] =
  "import React from 'react';\n" + initialFiles["src/App.jsx"];

export const requiredTeamPaths = [
  "src/App.jsx",
  "src/styles.css",
  "tests/ledger.test.js",
  "package.json",
  "index.html",
  "src/main.jsx",
  "tests/register.mjs",
];
export function validateTeamFiles(files) {
  if (!files || typeof files !== "object" || Array.isArray(files)) return false;
  const entries = Object.entries(files);
  return (
    entries.length > 0 &&
    entries.length <= 32 &&
    !entries.some(([p]) =>
      entries.some(([other]) => other.startsWith(p + "/")),
    ) &&
    requiredTeamPaths.every((p) => typeof files[p] === "string") &&
    entries.every(
      ([p, s]) =>
        p.length <= 120 &&
        /^[a-zA-Z0-9_.\-/]+$/.test(p) &&
        !p
          .split("/")
          .some(
            (segment) =>
              !segment ||
              segment === "." ||
              segment === ".." ||
              [
                "node_modules",
                ".git",
                "__proto__",
                "constructor",
                "prototype",
                ".env",
                ".env.local",
              ].includes(segment),
          ) &&
        typeof s === "string" &&
        s.length <= 50000,
    ) &&
    entries.reduce((n, [p, s]) => n + p.length + s.length, 0) <= 200000
  );
}

export function fileTree(files) {
  const root = {};
  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split("/");
    let dir = root;
    for (const name of parts.slice(0, -1))
      dir = (dir[name] ||= { directory: {} }).directory;
    dir[parts.at(-1)] = { file: { contents } };
  }
  return root;
}
