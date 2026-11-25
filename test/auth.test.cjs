const test = require("node:test");
const assert = require("node:assert/strict");
const {
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  readCookie
} = require("../lib/auth");

test("password hashes verify only the password used to create them", async () => {
  const hash = await hashPassword("Strong Student Password 2026");
  assert.match(hash, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await verifyPassword("Strong Student Password 2026", hash), true);
  assert.equal(await verifyPassword("another password", hash), false);
});

test("signed sessions reject tampering and expired claims", () => {
  process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough";
  const now = 1_800_000_000_000;
  const token = signSession({ role:"student", sub:"17" }, now);
  assert.deepEqual(verifySession(token, now), {
    role:"student",
    sub:"17",
    exp:Math.floor(now / 1000) + 7 * 24 * 60 * 60
  });
  assert.equal(verifySession(`${token.slice(0, -1)}x`, now), null);
  assert.equal(verifySession(token, now + 8 * 24 * 60 * 60 * 1000), null);
});

test("cookie parsing ignores malformed encoded values", () => {
  assert.equal(readCookie({ headers:{ cookie:"cc_student_session=%E0%A4%A" } }, "cc_student_session"), "");
  assert.equal(readCookie({ headers:{ cookie:"other=value; cc_admin_session=token" } }, "cc_admin_session"), "token");
});
