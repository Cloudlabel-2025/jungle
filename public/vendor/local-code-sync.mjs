#!/usr/bin/env node

// scripts/local-code-sync.mjs
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  lstat,
  unlink,
  realpath,
  rename
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve, join, dirname, basename, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// node_modules/diff/libesm/diff/base.js
var Diff = class {
  diff(oldStr, newStr, options = {}) {
    let callback;
    if (typeof options === "function") {
      callback = options;
      options = {};
    } else if ("callback" in options) {
      callback = options.callback;
    }
    const oldString = this.castInput(oldStr, options);
    const newString = this.castInput(newStr, options);
    const oldTokens = this.removeEmpty(this.tokenize(oldString, options));
    const newTokens = this.removeEmpty(this.tokenize(newString, options));
    return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
  }
  diffWithOptionsObj(oldTokens, newTokens, options, callback) {
    var _a;
    const done = (value) => {
      value = this.postProcess(value, options);
      if (callback) {
        setTimeout(function() {
          callback(value);
        }, 0);
        return void 0;
      } else {
        return value;
      }
    };
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let editLength = 1;
    let maxEditLength = newLen + oldLen;
    if (options.maxEditLength != null) {
      maxEditLength = Math.min(maxEditLength, options.maxEditLength);
    }
    const maxExecutionTime = (_a = options.timeout) !== null && _a !== void 0 ? _a : Infinity;
    const abortAfterTimestamp = Date.now() + maxExecutionTime;
    const bestPath = [{ oldPos: -1, lastComponent: void 0 }];
    let newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
    if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
      return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
    }
    let minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
    const execEditLength = () => {
      for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
        let basePath;
        const removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
        if (removePath) {
          bestPath[diagonalPath - 1] = void 0;
        }
        let canAdd = false;
        if (addPath) {
          const addPathNewPos = addPath.oldPos - diagonalPath;
          canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
        }
        const canRemove = removePath && removePath.oldPos + 1 < oldLen;
        if (!canAdd && !canRemove) {
          bestPath[diagonalPath] = void 0;
          continue;
        }
        if (!canRemove || canAdd && removePath.oldPos < addPath.oldPos) {
          basePath = this.addToPath(addPath, true, false, 0, options);
        } else {
          basePath = this.addToPath(removePath, false, true, 1, options);
        }
        newPos = this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
        if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
          return done(this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
        } else {
          bestPath[diagonalPath] = basePath;
          if (basePath.oldPos + 1 >= oldLen) {
            maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
          }
          if (newPos + 1 >= newLen) {
            minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
          }
        }
      }
      editLength++;
    };
    if (callback) {
      (function exec() {
        setTimeout(function() {
          if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
            return callback(void 0);
          }
          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
        const ret = execEditLength();
        if (ret) {
          return ret;
        }
      }
    }
  }
  addToPath(path, added, removed, oldPosInc, options) {
    const last = path.lastComponent;
    if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: { count: last.count + 1, added, removed, previousComponent: last.previousComponent }
      };
    } else {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: { count: 1, added, removed, previousComponent: last }
      };
    }
  }
  extractCommon(basePath, newTokens, oldTokens, diagonalPath, options) {
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
      newPos++;
      oldPos++;
      commonCount++;
      if (options.oneChangePerToken) {
        basePath.lastComponent = { count: 1, previousComponent: basePath.lastComponent, added: false, removed: false };
      }
    }
    if (commonCount && !options.oneChangePerToken) {
      basePath.lastComponent = { count: commonCount, previousComponent: basePath.lastComponent, added: false, removed: false };
    }
    basePath.oldPos = oldPos;
    return newPos;
  }
  equals(left, right, options) {
    if (options.comparator) {
      return options.comparator(left, right);
    } else {
      return left === right || !!options.ignoreCase && left.toLowerCase() === right.toLowerCase();
    }
  }
  removeEmpty(array) {
    const ret = [];
    for (let i = 0; i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }
    return ret;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  castInput(value, options) {
    return value;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tokenize(value, options) {
    return Array.from(value);
  }
  join(chars) {
    return chars.join("");
  }
  postProcess(changeObjects, options) {
    return changeObjects;
  }
  get useLongestToken() {
    return false;
  }
  buildValues(lastComponent, newTokens, oldTokens) {
    const components = [];
    let nextComponent;
    while (lastComponent) {
      components.push(lastComponent);
      nextComponent = lastComponent.previousComponent;
      delete lastComponent.previousComponent;
      lastComponent = nextComponent;
    }
    components.reverse();
    const componentLen = components.length;
    let componentPos = 0, newPos = 0, oldPos = 0;
    for (; componentPos < componentLen; componentPos++) {
      const component = components[componentPos];
      if (!component.removed) {
        if (!component.added && this.useLongestToken) {
          let value = newTokens.slice(newPos, newPos + component.count);
          value = value.map(function(value2, i) {
            const oldValue = oldTokens[oldPos + i];
            return oldValue.length > value2.length ? oldValue : value2;
          });
          component.value = this.join(value);
        } else {
          component.value = this.join(newTokens.slice(newPos, newPos + component.count));
        }
        newPos += component.count;
        if (!component.added) {
          oldPos += component.count;
        }
      } else {
        component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
        oldPos += component.count;
      }
    }
    return components;
  }
};

// node_modules/diff/libesm/diff/array.js
var ArrayDiff = class extends Diff {
  tokenize(value) {
    return value.slice();
  }
  join(value) {
    return value;
  }
  removeEmpty(value) {
    return value;
  }
};
var arrayDiff = new ArrayDiff();
function diffArrays(oldArr, newArr, options) {
  return arrayDiff.diff(oldArr, newArr, options);
}

// lib/team-lab-merge.js
var sameTeamFiles = (a, b) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};
function edits(before, after) {
  const a = before.split(/(?<=\n)/), b = after.split(/(?<=\n)/);
  const diff = diffArrays(a, b, { timeout: 40 });
  if (!diff) return [{ start: 0, end: a.length, lines: b }];
  const result = [];
  let offset = 0, pending;
  for (const part of diff) {
    if (!part.added && !part.removed) {
      if (pending) result.push(pending);
      pending = null;
      offset += part.count;
    } else {
      pending ||= { start: offset, end: offset, lines: [] };
      if (part.removed) {
        offset += part.count;
        pending.end = offset;
      } else pending.lines.push(...part.value);
    }
  }
  if (pending) result.push(pending);
  return result;
}
function mergeText(base, local, remote) {
  if (local === base || local === remote) return { value: remote };
  if (remote === base) return { value: local };
  if ([base, local, remote].some((s) => typeof s !== "string"))
    return { conflict: true };
  const left = edits(base, local), right = edits(base, remote);
  const unique = [...left];
  for (const r of right) {
    let duplicate = false;
    for (const l of left) {
      if (JSON.stringify(l) === JSON.stringify(r)) {
        duplicate = true;
        break;
      }
      if (l.start <= r.end && r.start <= l.end && (l.start === l.end || r.start === r.end || l.start < r.end && r.start < l.end))
        return { conflict: true };
    }
    if (!duplicate) unique.push(r);
  }
  const lines = base.split(/(?<=\n)/);
  for (const change of unique.sort((a, b) => b.start - a.start))
    lines.splice(change.start, change.end - change.start, ...change.lines);
  return { value: lines.join("") };
}
function mergeTeamFiles(base, local, remote) {
  const files = {}, conflicts = [];
  for (const path of /* @__PURE__ */ new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(remote)
  ])) {
    const result = mergeText(base[path], local[path], remote[path]);
    if (result.conflict) {
      conflicts.push(path);
      if (local[path] !== void 0) files[path] = local[path];
    } else if (result.value !== void 0) files[path] = result.value;
  }
  return { files, conflicts };
}

// lib/lab-project.js
var initialFiles = {
  "src/App.jsx": `const { useState } = React;

// All balances are integer paise. This prevents float rounding errors.
export function parseAmount(value) {
  if (typeof value !== 'string' || !/^[0-9]+([.][0-9]{1,2})?$/.test(value))
    throw new Error('Use a positive INR amount with at most two decimals.');
  const [whole, fraction = ''] = value.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise <= 0)
    throw new Error('Amount is outside the supported range.');
  return paise;
}

export function transfer(accounts, from, to, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error('Enter a positive amount in paise.');
  if (from === to) throw new Error('Choose different accounts.');
  if (!(from in accounts) || !(to in accounts))
    throw new Error('Account not found.');
  if (![accounts[from], accounts[to]].every(balance => Number.isSafeInteger(balance) && balance >= 0))
    throw new Error('Invalid account balance.');
  if (accounts[from] < amount) throw new Error('Insufficient funds.');
  if (!Number.isSafeInteger(accounts[to] + amount))
    throw new Error('Balance limit exceeded.');
  return { ...accounts, [from]: accounts[from] - amount,
    [to]: accounts[to] + amount };
}

export default function App() {
  const [accounts, setAccounts] = useState({ primary: 1245000, savings: 850000 });
  const [amount, setAmount] = useState('250');
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState([]);
  const money = (paise) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR'
  }).format(paise / 100);
  function send(event) {
    event.preventDefault();
    try {
      const value = parseAmount(amount);
      const next = transfer(accounts, 'primary', 'savings', value);
      setAccounts(next);
      setTransactions([{ id: transactions.length + 1, amount: value }, ...transactions]);
      setError('');
    } catch (e) { setError(e.message); }
  }
  return <main className="bank">
    <header><b className="bank-logo">A<span>PEX</span></b><span>PERSONAL BANKING <i /></span></header>
    <section className="welcome"><small>YOUR MONEY. IN MOTION.</small>
      <h1>Good things ahead.</h1><p>Your financial overview, all in one place.</p></section>
    <div className="accounts">{Object.entries(accounts).map(([key, balance]) =>
      <article className="account" key={key}><span>{key.toUpperCase()} ACCOUNT</span>
        <h2>{money(balance)}</h2><small>AVAILABLE BALANCE</small></article>)}</div>
    <section className="transfer"><h3>Move money, effortlessly.</h3>
      <p>Primary to Savings \xB7 Instant internal transfer</p>
      <label>Amount in INR<input type="number" min="0.01" step="0.01" value={amount}
        onChange={event => setAmount(event.target.value)} required /></label>
      <button type="button" onClick={send}>Transfer funds</button>{error && <p role="alert" className="error">{error}</p>}</section>
    <section className="transactions"><h3>Recent activity</h3>
      {transactions.length ? transactions.map(t => <div key={t.id}>
        <span>Internal transfer \xB7 Savings</span><b>{money(t.amount)}</b></div>) :
        <p>No transfers yet. Your next move starts above.</p>}</section>
    <footer>APEX FINANCIAL \xB7 CODEWILD SANDBOX \xB7 NO REAL MONEY</footer>
  </main>;
}
`,
  "src/styles.css": `* { box-sizing: border-box; }
body { margin: 0; background: #f1f3ef; color: #19382f; font: 14px Arial, sans-serif; }
.bank { max-width: 850px; margin: auto; padding: 28px; }
header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 22px; border-bottom: 1px solid #d5ddd5; }
.bank-logo { font-size: 30px; letter-spacing: -2px; } .bank-logo span { font-weight: 400; }
header > span { font-size: 9px; letter-spacing: 1px; } header i { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #5e9b68; margin-left: 8px; }
.welcome { margin: 30px 0 24px; } .welcome small { letter-spacing: 2px; font-size: 9px; }
h1 { font-size: 34px; letter-spacing: -1.5px; margin: 10px 0; } p { color: #67796f; line-height: 1.6; }
.accounts { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.account { padding: 24px; background: #183e31; color: #e4efce; border-radius: 10px; }
.account:nth-child(2) { background: #dce5d2; color: #19382f; }
.account span, .account small { font-size: 9px; letter-spacing: 1.5px; } .account h2 { font-size: 29px; margin: 22px 0 15px; letter-spacing: -1px; }
.transfer { margin-top: 20px; padding: 24px; background: white; border: 1px solid #dbe0d7; border-radius: 10px; }
h3 { margin: 0 0 8px; font-size: 16px; } .transfer p { font-size: 12px; }
label { display: block; color: #5d7064; font-size: 11px; margin-top: 20px; }
input { display: block; width: 100%; border: 1px solid #d6dfd3; padding: 13px; border-radius: 5px; margin: 8px 0 14px; font-size: 20px; color: #183e31; }
button { border: 0; border-radius: 5px; padding: 13px 22px; background: #c9eb9d; color: #173a2d; font-weight: 700; cursor: pointer; } button:hover { background: #b8df83; }
.error { color: #b22c2c; } .transactions { padding: 24px 0; } .transactions > div { display: flex; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #d6dfd3; font-size: 12px; }
footer { font-size: 8px; letter-spacing: 1px; color: #7f9185; margin-top: 24px; }
@media (max-width: 450px) { .bank { padding: 18px; } .accounts { grid-template-columns: 1fr; } h1 { font-size: 29px; } header > span { font-size: 7px; } }
`,
  "tests/ledger.test.js": `// These tests execute against the edited App.jsx exports in the sandbox.
test('moves funds between two accounts', () => {
  const result = transfer({ primary: 10000, savings: 5000 }, 'primary', 'savings', 2500);
  assert.equal(result.primary, 7500);
  assert.equal(result.savings, 7500);
});

test('rejects overdrafts and preserves non-negative balances', () => {
  assert.throws(() => transfer({ primary: 100, savings: 0 }, 'primary', 'savings', 101));
});

test('conserves total funds without mutating the input', () => {
  const before = { primary: 10000, savings: 5000 };
  const after = transfer(before, 'primary', 'savings', 1);
  assert.equal(after.primary + after.savings, 15000);
  assert.equal(before.primary, 10000);
});

test('rejects zero, negative, fractional and invalid transfers', () => {
  assert.equal(parseAmount('0.29'), 29);
  assert.equal(parseAmount('10.15'), 1015);
  assert.throws(() => parseAmount('1.001'));
  assert.throws(() => parseAmount('-1.00'));
  assert.throws(() => parseAmount(''));
  for (const amount of [0, -1, 0.1, NaN, Infinity])
    assert.throws(() => transfer({ primary: 100, savings: 0 }, 'primary', 'savings', amount));
  assert.throws(() => transfer({ primary: 100 }, 'primary', 'missing', 1));
  assert.throws(() => transfer({ primary: 100 }, 'primary', 'primary', 1));
});
`
};

// lib/team-lab-project.js
var teamInitialFiles = {
  ...initialFiles,
  "package.json": JSON.stringify(
    {
      name: "wilderness-team-project",
      private: true,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite --host 0.0.0.0",
        test: "node --import ./tests/register.mjs --test tests/ledger.test.js"
      },
      dependencies: { react: "19.2.0", "react-dom": "19.2.0", vite: "6.4.6" }
    },
    null,
    2
  ) + "\n",
  "index.html": '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n',
  "src/main.jsx": "import React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport App from './App.jsx';\nimport './styles.css';\nglobalThis.React = React;\ncreateRoot(document.getElementById('root')).render(<App />);\n",
  "tests/register.mjs": "import {createServer} from 'vite';\nimport React from 'react';\nimport assert from 'node:assert/strict';\nimport {test} from 'node:test';\n// Load the same app and imports used in the preview.\nglobalThis.React = React;\nconst server = await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});\ntry {\n  const app = await server.ssrLoadModule('/src/App.jsx');\n  Object.assign(globalThis, {test, assert, ...app});\n} finally { await server.close(); }\n",
  "README.md": "# Wilderness team project\n\nInstall Node.js 22.15 or later. Run `npm install`, then `npm run dev` for the preview or `npm test` for ledger tests.\n\nThe browser studio shares saved source with your team. Terminal sessions and previews run independently. Downloaded files are a snapshot; local edits are not automatically uploaded.\n"
};
teamInitialFiles["src/App.jsx"] = "import React from 'react';\n" + initialFiles["src/App.jsx"];
var requiredTeamPaths = [
  "src/App.jsx",
  "src/styles.css",
  "tests/ledger.test.js",
  "package.json",
  "index.html",
  "src/main.jsx",
  "tests/register.mjs"
];
function validateTeamFiles(files) {
  if (!files || typeof files !== "object" || Array.isArray(files)) return false;
  const entries = Object.entries(files);
  return entries.length > 0 && entries.length <= 32 && !entries.some(
    ([p]) => entries.some(([other]) => other.startsWith(p + "/"))
  ) && requiredTeamPaths.every((p) => typeof files[p] === "string") && entries.every(
    ([p, s]) => p.length <= 120 && /^[a-zA-Z0-9_.\-/]+$/.test(p) && !p.split("/").some(
      (segment) => !segment || segment === "." || segment === ".." || [
        "node_modules",
        ".git",
        "__proto__",
        "constructor",
        "prototype",
        ".env",
        ".env.local"
      ].includes(segment)
    ) && typeof s === "string" && s.length <= 5e4
  ) && entries.reduce((n, [p, s]) => n + p.length + s.length, 0) <= 2e5;
}

// lib/local-lab-sync.js
var metaPath = ".vow-sync.json";
var textExtension = /\.(?:[cm]?jsx?|tsx?|css|scss|json|html|md|txt|svg)$/i;
function localSourcePath(path) {
  return path.length <= 120 && /^[a-zA-Z0-9_.\-/]+$/.test(path) && textExtension.test(path) && !path.split("/").some(
    (s) => !s || s === "." || s === ".." || s.startsWith(".") || [
      "node_modules",
      "dist",
      "build",
      "coverage",
      "__proto__",
      "constructor",
      "prototype"
    ].includes(s)
  ) && path !== "package-lock.json";
}
async function entry(root, path, create = false) {
  const parts = path.split("/");
  let dir = root;
  for (const p of parts.slice(0, -1))
    dir = await dir.getDirectoryHandle(p, { create });
  return { dir, name: parts.at(-1) };
}
async function read(root, path) {
  try {
    const { dir, name } = await entry(root, path);
    const f = await (await dir.getFileHandle(name)).getFile();
    if (f.size > (path === metaPath ? 2e6 : 2e5))
      throw Error(`Local file ${path} exceeds the source limits.`);
    const value = await f.text();
    if (value.includes("\0"))
      throw Error(
        `Local file ${path} is binary and cannot be synced as source.`
      );
    return value;
  } catch (e) {
    if (e.name === "NotFoundError" || e.code === "ENOENT") return void 0;
    throw e;
  }
}
async function write(root, path, value) {
  const { dir, name } = await entry(root, path, true), handle = await dir.getFileHandle(name, { create: true });
  const stream = await handle.createWritable();
  try {
    await stream.write(value);
    await stream.close();
  } catch (e) {
    try {
      await stream.abort();
    } catch {
    }
    throw e;
  }
}
async function readLocalProject(root) {
  const files = {};
  let count = 0, total = 0;
  async function walk(dir, prefix = "") {
    for await (const [name, handle] of dir.entries()) {
      if (name.startsWith(".") || ["node_modules", "dist", "build", "coverage"].includes(name))
        continue;
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === "directory") {
        if (path.split("/").length < 6) await walk(handle, path);
      } else if (localSourcePath(path)) {
        if (++count > 32)
          throw Error(
            "This folder contains more than 32 source files. Choose a dedicated project folder."
          );
        const value = await read(root, path);
        if (value.length > 5e4 || (total += value.length) > 2e5)
          throw Error("Local source exceeds the project limits.");
        files[path] = value;
      }
    }
  }
  await walk(root);
  return files;
}
var LocalLabFolder = class {
  constructor(root, projectId) {
    this.root = root;
    this.projectId = projectId;
    this.base = null;
  }
  async open() {
    const raw = await read(this.root, metaPath);
    if (raw) {
      let saved;
      try {
        saved = JSON.parse(raw);
      } catch {
        throw Error(
          "The folder sync marker is unreadable. Choose another folder or restore its marker."
        );
      }
      if (saved.projectId !== this.projectId)
        throw Error(
          "This folder is connected to another team project. Choose a different folder."
        );
      if (!validateTeamFiles(saved.files))
        throw Error(
          "The folder sync marker is incomplete. Reconnect using a dedicated project folder."
        );
      this.base = saved.files;
      this.recorded = true;
    }
    return readLocalProject(this.root);
  }
  plan(disk, editor, resolutions = {}) {
    const local = {
      ...disk,
      ...Object.fromEntries(
        Object.entries(editor).filter(([p]) => !localSourcePath(p))
      )
    };
    const merged = mergeTeamFiles(this.base || {}, local, editor);
    for (const path of [...merged.conflicts])
      if (resolutions[path] && resolutions[path].disk === disk[path] && resolutions[path].editor === editor[path]) {
        const chosen = resolutions[path].side === "local" ? disk : editor;
        if (chosen[path] === void 0) delete merged.files[path];
        else merged.files[path] = chosen[path];
        merged.conflicts = merged.conflicts.filter((p) => p !== path);
      }
    return merged;
  }
  async commit(disk, files, keepGoing = () => true) {
    if (!validateTeamFiles(files))
      throw Error(
        "Keep the required entry files and project size limits before syncing."
      );
    const changed = [
      .../* @__PURE__ */ new Set([...Object.keys(disk), ...Object.keys(files)])
    ].filter((p) => localSourcePath(p) && disk[p] !== files[p]);
    for (const path of changed)
      if (await read(this.root, path) !== disk[path])
        throw Error(
          `Local ${path} changed during syncing. Retrying without replacing it.`
        );
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    for (const path of changed) {
      if (!keepGoing()) throw Error("Local sync disconnected.");
      const current = await read(this.root, path);
      if (current !== disk[path])
        throw Error(
          `Local ${path} changed during syncing. Retrying without replacing it.`
        );
      if (current !== void 0)
        await write(this.root, `.vow-sync-backups/${stamp}/${path}`, current);
      if (files[path] === void 0) {
        const { dir, name } = await entry(this.root, path);
        await dir.removeEntry(name);
      } else await write(this.root, path, files[path]);
    }
  }
  async acknowledge(files) {
    if (this.recorded && sameTeamFiles(this.base, files)) return;
    await write(
      this.root,
      metaPath,
      JSON.stringify({ format: 1, projectId: this.projectId, files }, null, 2)
    );
    this.base = structuredClone(files);
    this.recorded = true;
  }
};

// scripts/local-code-sync.mjs
function localDirectory(path, root = path) {
  const safe = async (name, create = false, isDir = false) => {
    if (!name || name.includes("/") || name.includes("\\") || name === "." || name === "..")
      throw Error("Invalid local file name.");
    const full = resolve(path, name);
    if (!full.startsWith(root + sep))
      throw Error("Refusing access outside the connected folder.");
    try {
      if ((await lstat(full)).isSymbolicLink())
        throw Error("Symbolic links cannot be synced.");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      if (!create) throw e;
    }
    if (isDir && create) await mkdir(full, { recursive: true });
    return full;
  };
  return {
    name: basename(path),
    kind: "directory",
    async *entries() {
      for (const e of await readdir(path, { withFileTypes: true })) {
        if (e.isSymbolicLink()) continue;
        const p = join(path, e.name);
        yield [
          e.name,
          e.isDirectory() ? localDirectory(p, root) : localFile(p)
        ];
      }
    },
    async getDirectoryHandle(name, { create = false } = {}) {
      return localDirectory(await safe(name, create, true), root);
    },
    async getFileHandle(name, { create = false } = {}) {
      return localFile(await safe(name, create));
    },
    async removeEntry(name) {
      await unlink(await safe(name));
    }
  };
}
function localFile(path) {
  return {
    kind: "file",
    async getFile() {
      const bytes = await readFile(path);
      return { size: bytes.length, text: async () => bytes.toString("utf8") };
    },
    async createWritable() {
      let value = "";
      return {
        async write(text) {
          value = text;
        },
        async close() {
          if ((await lstat(path).catch(() => null))?.isSymbolicLink())
            throw Error("Symbolic links cannot be synced.");
          const temp = `${path}.vow-sync-tmp-${randomUUID()}`;
          try {
            await writeFile(temp, value, { flag: "wx", mode: 384 });
            await rename(temp, path);
          } finally {
            await unlink(temp).catch(() => {
            });
          }
        },
        async abort() {
        }
      };
    }
  };
}
async function runLocalSync({
  config,
  folderPath,
  once = false,
  initialChoice,
  log = console.log,
  signal
}) {
  const origin = new URL(config.origin);
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))
    throw Error("Use HTTPS for local project connections.");
  if (origin.username || origin.password || origin.pathname !== "/" || !config.grantId || !config.token || !config.projectId)
    throw Error("Invalid local connection configuration.");
  await mkdir(folderPath, { recursive: true });
  const root = await realpath(folderPath), handle = localDirectory(root), folder = new LocalLabFolder(handle, config.scopeKey);
  let disk = await folder.open();
  const endpoint = new URL("/api/team-lab/local", origin);
  endpoint.searchParams.set("grantId", config.grantId);
  if (config.collegeId)
    endpoint.searchParams.set("collegeId", config.collegeId);
  let remoteSnapshot;
  const request = async (body) => {
    const target = new URL(endpoint);
    if (!body && remoteSnapshot)
      target.searchParams.set("version", String(remoteSnapshot.version));
    const r = await fetch(target, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...body ? { "Content-Type": "application/json" } : {}
      },
      body: body ? JSON.stringify(body) : void 0,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(1e4)]) : AbortSignal.timeout(1e4)
    });
    const result = await r.json();
    if (!r.ok)
      throw Object.assign(
        Error(result.error || "The team project could not be reached."),
        { status: r.status }
      );
    if (!result.conflict) {
      if (!result.files && remoteSnapshot?.version === result.version)
        result.files = remoteSnapshot.files;
      if (!result.files)
        throw Error("The team project response is incomplete.");
      remoteSnapshot = result;
    }
    return result;
  };
  const ignore = [
    ".vow-sync-config.json",
    ".vow-sync.mjs",
    ".vow-sync.json",
    ".vow-sync-conflicts.json",
    ".vow-sync-backups/",
    "*.vow-sync-tmp-*"
  ];
  const ignorePath = join(root, ".gitignore");
  if ((await lstat(ignorePath).catch(() => null))?.isSymbolicLink())
    throw Error("The local Git ignore file must not be a symbolic link.");
  const oldIgnore = await readFile(ignorePath, "utf8").catch((e) => {
    if (e.code === "ENOENT") return "";
    throw e;
  });
  const additions = ignore.filter(
    (line) => !oldIgnore.split(/\r?\n/).includes(line)
  );
  if (additions.length)
    await writeFile(
      ignorePath,
      oldIgnore + (oldIgnore.endsWith("\n") || !oldIgnore ? "" : "\n") + "# Wilderness local connection\n" + additions.join("\n") + "\n"
    );
  let reported = "", lastVersion = -1;
  while (!signal?.aborted) {
    try {
      const remote = await request();
      if (remote.projectId !== config.projectId)
        throw Object.assign(
          Error("This connection belongs to another team project."),
          { status: 403 }
        );
      disk = await readLocalProject(handle);
      if (!folder.base && Object.keys(disk).length) {
        if (!["local", "team"].includes(initialChoice))
          throw Object.assign(
            Error(
              "Folder already contains source. Run again with --use-local or --use-team after comparing it with the team project. No source was replaced."
            ),
            { status: 409 }
          );
        folder.base = initialChoice === "local" ? remote.files : disk;
      }
      const decisions = JSON.parse(
        await readFile(join(root, ".vow-sync-conflicts.json"), "utf8").catch(
          () => '{"files":{}}'
        )
      );
      const choices = {};
      for (const [path, row] of Object.entries(decisions.files || {}))
        if (["local", "team"].includes(row.choose))
          choices[path] = {
            side: row.choose === "local" ? "local" : "editor",
            disk: row.local === null ? void 0 : row.local,
            editor: row.team === null ? void 0 : row.team
          };
      const plan = folder.plan(disk, remote.files, choices);
      if (plan.conflicts.length) {
        await writeFile(
          join(root, ".vow-sync-conflicts.json"),
          JSON.stringify(
            {
              version: remote.version,
              instructions: "Compare local and team versions. For each file set choose to local or team. The decision is rejected if either version changes.",
              files: Object.fromEntries(
                plan.conflicts.map((p) => [
                  p,
                  {
                    local: disk[p] ?? null,
                    team: remote.files[p] ?? null,
                    choose: null
                  }
                ])
              )
            },
            null,
            2
          )
        );
        if (reported !== "conflict") {
          log(
            "Sync paused: overlapping edits are retained. Resolve .vow-sync-conflicts.json in your editor."
          );
          reported = "conflict";
        }
        if (once) return { conflict: true, paths: plan.conflicts };
      } else {
        const result = sameTeamFiles(plan.files, remote.files) ? remote : await request({
          projectId: config.projectId,
          expectedVersion: remote.version,
          files: plan.files
        });
        if (!result.conflict) {
          await folder.commit(disk, result.files, () => !signal?.aborted);
          await folder.acknowledge(result.files);
          await unlink(join(root, ".vow-sync-conflicts.json")).catch((e) => {
            if (e.code !== "ENOENT") throw e;
          });
          if (lastVersion !== result.version || reported) {
            log(
              `Synced team version ${result.version}. Watching local source changes.`
            );
            lastVersion = result.version;
            reported = "";
          }
          if (once) return { version: result.version, files: result.files };
        }
      }
    } catch (e) {
      if (signal?.aborted) return;
      if (once || [401, 403, 409].includes(e.status)) throw e;
      if (reported !== e.message) {
        log(`Sync paused: ${e.message}`);
        reported = e.message;
      }
    }
    await new Promise((resolve2) => {
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", finish);
        resolve2();
      };
      const timer = setTimeout(finish, 1500);
      signal?.addEventListener("abort", finish, { once: true });
    });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), value = (name) => {
    const i = args.indexOf(name);
    return i < 0 ? void 0 : args[i + 1];
  };
  const control = new AbortController();
  process.once("SIGINT", () => control.abort());
  process.once("SIGTERM", () => control.abort());
  try {
    const config = JSON.parse(
      await readFile(
        resolve(
          value("--config") || join(
            dirname(fileURLToPath(import.meta.url)),
            ".vow-sync-config.json"
          )
        ),
        "utf8"
      )
    );
    await runLocalSync({
      config,
      folderPath: resolve(value("--folder") || process.cwd()),
      once: args.includes("--once"),
      initialChoice: args.includes("--use-local") ? "local" : args.includes("--use-team") ? "team" : void 0,
      signal: control.signal
    });
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
export {
  localDirectory,
  runLocalSync
};
