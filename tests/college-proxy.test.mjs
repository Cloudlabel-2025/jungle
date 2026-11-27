import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const output = await build({ entryPoints: ["proxy.js"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external" });
const compiled = { exports: {} };
new Function("require", "module", "exports", output.outputFiles[0].text)(require, compiled, compiled.exports);
const { proxy } = compiled.exports;
const keys = ["TENANCY_ENABLED", "COLLEGE_ROOT_DOMAIN", "ROOT_DOMAIN", "__NEXT_NO_MIDDLEWARE_URL_NORMALIZE"];
const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
before(() => Object.assign(process.env, { TENANCY_ENABLED: "true", COLLEGE_ROOT_DOMAIN: "", ROOT_DOMAIN: "", __NEXT_NO_MIDDLEWARE_URL_NORMALIZE: "1" }));
after(() => { for (const key of keys) saved[key] === undefined ? delete process.env[key] : process.env[key] = saved[key]; });

for (const origin of ["http://127.0.0.1:3000", "http://localhost:3000", "https://app.vercel.app"]) {
  for (const [path, target] of [["/c/college-for-test", "/gamer/dashboard"], ["/c/college-for-test/recover", "/recover"]]) {
    test(`college entry rewrite stays internal: ${origin}${path}`, () => {
      const host = origin.startsWith("http:") ? "college-for-test.localhost:3000" : "app.vercel.app";
      const response = proxy(new NextRequest(`${origin}${path}?next=dashboard`, { headers: { host, "x-vow-college-entry": "spoofed" } }));
      assert.equal(response.headers.get("x-middleware-rewrite"), `${origin}${target}?next=dashboard`);
      assert.equal(response.headers.get("x-middleware-request-host"), host);
      assert.equal(response.headers.get("x-middleware-request-x-vow-college-entry"), "college-for-test");
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.match(response.headers.get("set-cookie"), /vow_college_entry=college-for-test/);
    });
  }
}

test("direct college pages remain internal and mismatched college paths are rejected", () => {
  const request = path => new NextRequest(`http://127.0.0.1:3000${path}`, { headers: { host: "college-for-test.localhost:3000", "x-vow-college-entry": "spoofed" } });
  const page = proxy(request("/gamer/dashboard"));
  assert.equal(page.headers.get("x-middleware-next"), "1");
  assert.equal(page.headers.get("x-middleware-rewrite"), null);
  assert.equal(page.headers.get("x-middleware-request-x-vow-college-entry"), "college-for-test");
  assert.equal(proxy(request("/c/other-college")).status, 404);
  assert.equal(proxy(request("/api/platform/colleges")).status, 403);
  assert.equal(proxy(request("/platform")).headers.get("location"), "http://localhost:3000/platform");
});
