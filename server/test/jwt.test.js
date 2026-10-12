const { test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { verifyToken } = require("../lib/jwt");

const secret = "test-secret-that-is-long-enough-1234567890";

test("accepts a token signed with the same secret", () => {
  const token = jwt.sign({ id: 1 }, secret, { algorithm: "HS256", expiresIn: "1h" });
  assert.equal(verifyToken(token, secret).id, 1);
});

test("rejects a token signed with a different secret", () => {
  const token = jwt.sign({ id: 1 }, "another-secret", { algorithm: "HS256" });
  assert.equal(verifyToken(token, secret), null);
});

test("rejects an expired token", () => {
  const token = jwt.sign({ id: 1, exp: Math.floor(Date.now() / 1000) - 10 }, secret, { algorithm: "HS256" });
  assert.equal(verifyToken(token, secret), null);
});

test("rejects a missing token or missing secret", () => {
  assert.equal(verifyToken(undefined, secret), null);
  assert.equal(verifyToken("x.y.z", ""), null);
});
