import { describe, it, expect } from "vitest";
import { idleState, IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from "./idle";

const now = 1_000_000_000;

describe("idleState", () => {
  it("記録がない・別ユーザーの記録なら数え直す", () => {
    expect(idleState(null, "u1", now)).toBe("reset");
    expect(idleState({ userId: "u2", at: now - IDLE_TIMEOUT_MS * 2 }, "u1", now)).toBe("reset");
  });

  it("操作から30分未満は有効", () => {
    expect(idleState({ userId: "u1", at: now - 60_000 }, "u1", now)).toBe("active");
  });

  it("ログアウトの2分前から警告", () => {
    expect(idleState({ userId: "u1", at: now - (IDLE_TIMEOUT_MS - IDLE_WARNING_MS) }, "u1", now)).toBe("warning");
  });

  it("30分を過ぎたらログアウト", () => {
    expect(idleState({ userId: "u1", at: now - IDLE_TIMEOUT_MS }, "u1", now)).toBe("expired");
  });
});
