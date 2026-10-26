import test from "node:test";
import assert from "node:assert/strict";
import { accountEmail } from "../lib/account-email.js";
import { personas } from "../lib/catalog.js";
import { hashPassword, checkPassword } from "../lib/password.js";
test("all 29 persona login addresses follow the requested unique name convention", () => {
  assert.equal(personas.length, 29);
  assert.equal(accountEmail("Karun"), "karun@gmail.com");
  assert.equal(accountEmail("Aarav Patel"), "aarav.patel@gmail.com");
  assert.equal(accountEmail("Commander Vikramaditya"), "vikramaditya@gmail.com");
  assert.ok(personas.every(p => p.email === accountEmail(p.name)));
  assert.equal(new Set(personas.map(p => p.email.replaceAll(".", ""))).size, 29);
});
test("the requested eight-character password policy still stores salted hashes", async () => {
  const password = "Test@123";
  const hash = await hashPassword(password);
  assert.equal(await checkPassword(password, hash), true);
  assert.equal(await checkPassword("Other@12", hash), false);
  await assert.rejects(hashPassword("short"));
});
