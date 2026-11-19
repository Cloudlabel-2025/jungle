import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCollegeUrl,
  collegeSlugFromHost,
  platformOrigin,
  validCollegeAddress,
  normalizeCollegeRootDomain,
} from "../lib/college-routing.js";
import { collegeSignInSelector } from "../lib/college-registry.js";

test("college portals use Lims-style local/subdomain URLs and a hosted path fallback", () => {
  assert.equal(
    buildCollegeUrl("college-for-test", "http://localhost:3000"),
    "http://college-for-test.localhost:3000/",
  );
  assert.equal(
    buildCollegeUrl("college-for-test", "http://127.0.0.1:3000"),
    "http://college-for-test.localhost:3000/",
  );
  assert.equal(
    buildCollegeUrl("beta", "http://alpha.localhost:3100"),
    "http://beta.localhost:3100/",
  );
  assert.equal(
    buildCollegeUrl("alpha", "https://vow.example.com", {
      rootDomain: "vow.example.com",
    }),
    "https://alpha.vow.example.com/",
  );
  assert.equal(
    buildCollegeUrl("alpha", "https://voyageofwilderness-vow.vercel.app"),
    "https://voyageofwilderness-vow.vercel.app/c/alpha",
  );
  assert.equal(
    buildCollegeUrl("alpha", "https://app.vercel.app", {
      pathname: "/recover",
    }),
    "https://app.vercel.app/c/alpha/recover",
  );
  assert.equal(collegeSlugFromHost("alpha.localhost:3000"), "alpha");
  assert.equal(
    collegeSlugFromHost("alpha.vow.example.com", "vow.example.com"),
    "alpha",
  );
  for (const host of [
    "localhost:3000",
    "127.0.0.1:3000",
    "cms.localhost:3000",
    "alpha.localhost.evil.com",
    "x.alpha.localhost",
    "alpha.vow.example.com.evil.com",
  ])
    assert.equal(collegeSlugFromHost(host, "vow.example.com"), null);
  assert.equal(
    platformOrigin("http://alpha.localhost:3000"),
    "http://localhost:3000",
  );
  assert.equal(
    platformOrigin("https://alpha.vow.example.com", "vow.example.com"),
    "https://vow.example.com",
  );
  for (const slug of [
    "",
    "cms",
    "admin",
    "www",
    "a.b",
    "../alpha",
    "a/b",
    "alpha?x",
    "UPPER",
    "a".repeat(64),
  ])
    assert.equal(validCollegeAddress(slug), false);
  assert.throws(() => normalizeCollegeRootDomain("vow.example.com/other"));
  assert.deepEqual(
    collegeSignInSelector({ collegeId: "immutable-id", collegeSlug: "wrong" }),
    { _id: "immutable-id" },
    "older API clients remain compatible without overriding portal identity",
  );
});
