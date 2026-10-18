import { describe, it, expect } from "vitest";
import { isRecoverySession } from "./auth";

function tokenWith(payload) {
  const b64url = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify(payload))}.signature`;
}

describe("isRecoverySession", () => {
  it("再設定リンク経由（amr に recovery）なら true", () => {
    const session = { access_token: tokenWith({ amr: [{ method: "recovery", timestamp: 1 }] }) };
    expect(isRecoverySession(session)).toBe(true);
  });

  it("パスワードでの通常ログインなら false", () => {
    const session = { access_token: tokenWith({ amr: [{ method: "password", timestamp: 1 }], email: "山田@example.com" }) };
    expect(isRecoverySession(session)).toBe(false);
  });

  it("未ログイン・壊れたトークンなら false", () => {
    expect(isRecoverySession(null)).toBe(false);
    expect(isRecoverySession({ access_token: "invalid" })).toBe(false);
    expect(isRecoverySession({ access_token: tokenWith({}) })).toBe(false);
  });
});
