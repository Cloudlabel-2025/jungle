import test from "node:test";
import assert from "node:assert/strict";
import { allowedWriteOrigin } from "../lib/request-origin.js";

function request(origin, host = "localhost:3000", extra = {}) {
  return new Request("http://127.0.0.1:3000/api/auth/login", {
    headers: { host, ...(origin === undefined ? {} : { origin }), ...extra },
  });
}

test("same-site login works with localhost, alternate ports and a stale configured origin", () => {
  for (const host of ["localhost:3000", "127.0.0.1:3000", "localhost:3002"]) {
    assert.equal(
      allowedWriteOrigin(
        request(`http://${host}`, host),
        "http://127.0.0.1:3000",
      ),
      true,
    );
  }
});

test("deployed HTTPS and preview hosts work behind a TLS proxy", () => {
  for (const host of ["game.example.com", "game-preview.vercel.app"]) {
    assert.equal(
      allowedWriteOrigin(
        request(`https://${host}`, host, { "x-forwarded-proto": "https" }),
        "http://127.0.0.1:3000",
      ),
      true,
    );
  }
});

test("configured public origin supports proxies retaining an internal Host", () => {
  assert.equal(
    allowedWriteOrigin(
      request("https://game.example.com", "internal:3000"),
      "https://game.example.com/",
    ),
    true,
  );
});

test("unrelated origins, wrong ports, protocol downgrade and malformed origins stay blocked", () => {
  for (const origin of [
    "https://evil.example",
    "http://localhost:3001",
    "null",
    "http://localhost:3000.evil.example",
    "http://localhost:3000/path",
    "http://user@localhost:3000",
    "http://localhost:3000, https://evil.example",
  ]) {
    assert.equal(allowedWriteOrigin(request(origin), ""), false, origin);
  }
  assert.equal(
    allowedWriteOrigin(
      request("http://game.example.com", "game.example.com", {
        "x-forwarded-proto": "https",
      }),
      "",
    ),
    false,
  );
  assert.equal(
    allowedWriteOrigin(
      request("https://evil.example", "localhost:3000", {
        "x-forwarded-host": "evil.example",
      }),
      "",
    ),
    false,
  );
});

test("non-browser requests without Origin retain existing behavior", () => {
  assert.equal(allowedWriteOrigin(request(), ""), true);
});
