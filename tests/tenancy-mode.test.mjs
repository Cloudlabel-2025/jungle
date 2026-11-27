import test from "node:test";
import assert from "node:assert/strict";
import { tenancyEnabled } from "../lib/tenancy-mode.js";

test("Vercel defaults to college routing when the tenant flag is omitted or blank", () => {
  assert.equal(tenancyEnabled({ VERCEL: "1", NODE_ENV: "production" }), true);
  assert.equal(tenancyEnabled({ VERCEL: "1", TENANCY_ENABLED: "" }), true);
});
test("explicit deployment modes override the hosted default", () => {
  assert.equal(tenancyEnabled({ VERCEL: "1", TENANCY_ENABLED: "false" }), false);
  assert.equal(tenancyEnabled({ TENANCY_ENABLED: "true" }), true);
  assert.equal(tenancyEnabled({ TENANCY_ENABLED: "false" }), false);
});
test("unconfigured local and standalone installations preserve their existing mode", () => {
  assert.equal(tenancyEnabled({}), false);
  assert.equal(tenancyEnabled({ NODE_ENV: "production" }), false);
});
