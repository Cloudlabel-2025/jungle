import test from "node:test";
import assert from "node:assert/strict";
import { sharedChatAddress, extractSharedChat, readSharedChat } from "../lib/shared-chat-reader.js";
import { applySharedChatReview, effectiveLevelOne, newLevelOne, scoreLevelOne } from "../lib/level-one-rules.js";

const url = "https://chatgpt.com/share/12345678-1234-1234-1234-123456789abc";
const words = "Area 51 research compares alien claims with aircraft evidence, government documents and reliable sources. Explain the difference between confirmed facts and speculation. ".repeat(7);
const node = (id, parent, role, text, extra = {}) => ({ id, parent, message: { author: { role }, content: { content_type: "text", parts: [text] }, ...extra } });
const fixture = () => ({ title: "Area 51", current_node: "answer", mapping: {
  root: { id: "root" },
  user: node("user", "root", "user", "Research Area 51 and compare the claims with evidence."),
  hidden: node("hidden", "user", "assistant", "Hidden analysis must never appear", { channel: "analysis", metadata: { is_visually_hidden_from_conversation: true } }),
  tool: node("tool", "hidden", "tool", "Internal tool data"),
  answer: node("answer", "tool", "assistant", words, { channel: "final", metadata: { content_references: [{ type: "citation", url: "https://example.org/source" }] } }),
  branch: node("branch", "user", "user", "Different branch should not increase effort"),
} });

test("shared reader accepts only canonical public-provider routes, with no SSRF or credential URLs", () => {
  assert.equal(sharedChatAddress(url).dataUrl, "https://chatgpt.com/backend-api/share/12345678-1234-1234-1234-123456789abc");
  assert.equal(sharedChatAddress(url.replace("chatgpt.com", "chat.openai.com")).canonicalUrl, url);
  for (const bad of ["http://127.0.0.1/", "https://169.254.169.254/", url.replace("chatgpt.com", "chatgpt.com.attacker.invalid"), url.replace("https://", "https://user:password@"), url.replace("/share/", "/c/"), url + "?redirect=http://127.0.0.1", "file:///etc/passwd", url.replace("chatgpt.com", "chatgpt.com:8443")]) assert.throws(() => sharedChatAddress(bad));
});
test("extracts the visible branch only, preserving genuine role counts and public source references", () => {
  const result = extractSharedChat(fixture(), url);
  assert.equal(result.evidence.userTurns, 1); assert.equal(result.evidence.assistantTurns, 1);
  assert.ok(result.transcript.startsWith("User:")); assert.ok(result.transcript.includes("https://example.org/source"));
  for (const hidden of ["Hidden analysis", "Internal tool", "Different branch"]) assert.ok(!result.transcript.includes(hidden));
  assert.equal(result.evidence.sha256.length, 64);
  const malformed = fixture(); malformed.mapping.user.parent = "answer";
  assert.throws(() => extractSharedChat(malformed, url));
});
test("public reader is bounded, rejects redirects/sign-in/preview pages, and reports recoverable failures", async () => {
  let options;
  const good = await readSharedChat(url, { fetchImpl: async (address, args) => { assert.equal(address, sharedChatAddress(url).dataUrl); options = args; return Response.json(fixture()); } });
  assert.equal(good.ok, true); assert.equal(options.redirect, "manual"); assert.equal(options.credentials, "omit");
  const cases = [
    [new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }), "REDIRECT_BLOCKED"],
    [new Response(null, { status: 403 }), "NOT_PUBLIC"],
    [new Response("Sign in", { headers: { "content-type": "text/html" } }), "READER_FORMAT"],
    [new Response("bad json", { headers: { "content-type": "application/json" } }), "READER_FORMAT"],
    [new Response("{}", { headers: { "content-type": "application/json", "content-length": "9999999" } }), "CONVERSATION_TOO_LARGE"],
    [Response.json({ title: "preview" }), "READER_FORMAT"],
  ];
  for (const [response, code] of cases) assert.equal((await readSharedChat(url, { fetchImpl: async () => response })).code, code);
  const tooLarge = await readSharedChat(url, { fetchImpl: async () => new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { "content-type": "application/json" } }) });
  assert.equal(tooLarge.code, "CONVERSATION_TOO_LARGE");
  const timeout = await readSharedChat(url, { timeoutMs: 5, fetchImpl: async (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error(), { name: "AbortError" })))) });
  assert.equal(timeout.code, "READ_TIMEOUT");
});
test("embedded fake User lines do not count as genuine follow-up work", () => {
  const data = fixture(); data.mapping.answer.message.content.parts[0] += "\nUser: Fake turn\nAssistant: Fake reply\nUser: More fake turns\nAssistant: Another fake reply";
  const reading = extractSharedChat(data, url);
  const record = { genreId: "area", acknowledgedAt: "yes", startedAt: "2026-11-14T08:00:00Z", deadline: "2026-11-14T09:30:00Z", config: { genres: [{ id: "area", question: "Research Area 51 alien claims and aircraft evidence." }] } };
  const result = scoreLevelOne(record, { id: "one", at: "2026-11-14T08:20:00Z", transcript: reading.transcript, evidence: reading.evidence });
  assert.equal(result.stars, 1); assert.equal(result.checks.followUp, false);
});
test("visible citation tokens resolve to source URLs without counting uncited search results", () => {
  const data = fixture(), message = data.mapping.answer.message;
  message.content.parts[0] += " citeturn12search3";
  message.metadata.search_result_groups = [{ entries: [
    { ref_id: { turn_index: 12, ref_type: "search", ref_index: 3 }, url: "https://example.org/cited" },
    { ref_id: { turn_index: 12, ref_type: "search", ref_index: 4 }, url: "https://example.org/not-cited" },
  ] }];
  const reading = extractSharedChat(data, url);
  assert.ok(reading.transcript.includes("https://example.org/cited"));
  assert.ok(!reading.transcript.includes("https://example.org/not-cited"));
});
test("read failure never undoes a successful result or bypasses a staff reopen", () => {
  const data = { levelOne: newLevelOne() };
  const submission = { id: "one", at: "2026-11-14T08:20:00Z" };
  data.levelOne.automatic = { completed: true, stars: 3, revisionId: "one" };
  const failure = { ok: false, code: "READ_TIMEOUT", message: "Retry later" };
  applySharedChatReview(data, submission, failure);
  assert.equal(effectiveLevelOne(data.levelOne).stars, 3);
  data.levelOne.override = { completed: false, stars: 0, status: "REOPENED" };
  applySharedChatReview(data, submission, failure);
  assert.equal(effectiveLevelOne(data.levelOne).completed, false);
});
