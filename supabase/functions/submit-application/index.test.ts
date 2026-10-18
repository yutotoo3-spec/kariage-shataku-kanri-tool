// deno test --allow-env supabase/functions/submit-application/index.test.ts
import { assertEquals } from "jsr:@std/assert@1";

Deno.env.set("SUBMIT_APPLICATION_TEST", "1");
const { handleRequest, ALLOWED_FIELDS } = await import("./index.ts");

const validApplication = {
  company_id: "c1", scene: "new_hire", name: "山田", basic_salary: 300000, family_type: "single",
  property_name: "M", property_address: "A", rent: 50000, desired_move_in: "2026-11-01",
};

function makeDeps(overrides: Partial<Record<string, unknown>> = {}) {
  const calls = { verify: [] as unknown[], inserted: [] as Record<string, unknown>[] };
  const deps = {
    verifyToken: async (token: string, ip: string | null) => { calls.verify.push([token, ip]); return token === "good-token"; },
    isActiveCompany: async (id: string) => id === "c1",
    insertApplication: async (record: Record<string, unknown>) => { calls.inserted.push(record); return null; },
    ...overrides,
  };
  return { deps, calls };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/submit-application", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
  });
}

Deno.test("正しいトークンなら申請を登録する", async () => {
  const { deps, calls } = makeDeps();
  const res = await handleRequest(post({ turnstileToken: "good-token", application: validApplication }, { "x-forwarded-for": "1.2.3.4, 5.6.7.8" }), deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
  assertEquals(calls.inserted.length, 1);
  assertEquals(calls.verify[0], ["good-token", "1.2.3.4"]);
});

Deno.test("トークンがない・不正なら登録しない", async () => {
  for (const [body, status, error] of [
    [{ application: validApplication }, 400, "captcha_required"],
    [{ turnstileToken: "", application: validApplication }, 400, "captcha_required"],
    [{ turnstileToken: "bad-token", application: validApplication }, 403, "captcha_failed"],
  ] as const) {
    const { deps, calls } = makeDeps();
    const res = await handleRequest(post(body), deps);
    assertEquals(res.status, status);
    assertEquals((await res.json()).error, error);
    assertEquals(calls.inserted.length, 0);
  }
});

Deno.test("status・負担額などの項目は受け取らない（許可した項目だけ登録する）", async () => {
  const { deps, calls } = makeDeps();
  await handleRequest(post({
    turnstileToken: "good-token",
    application: { ...validApplication, status: "approved", personal_burden: 0, review_comment: "x", id: "forged" },
  }), deps);
  const inserted = calls.inserted[0];
  assertEquals("status" in inserted, false);
  assertEquals("personal_burden" in inserted, false);
  assertEquals("review_comment" in inserted, false);
  assertEquals("id" in inserted, false);
  assertEquals(Object.keys(inserted).every(k => ALLOWED_FIELDS.includes(k)), true);
});

Deno.test("無効な会社・不正な形式は拒否", async () => {
  const { deps, calls } = makeDeps();
  assertEquals((await handleRequest(post({ turnstileToken: "good-token", application: { ...validApplication, company_id: "suspended" } }), deps)).status, 400);
  assertEquals((await handleRequest(post({ turnstileToken: "good-token", application: [] }), deps)).status, 400);
  assertEquals((await handleRequest(new Request("http://localhost", { method: "POST", body: "not json" }), deps)).status, 400);
  assertEquals((await handleRequest(new Request("http://localhost", { method: "GET" }), deps)).status, 405);
  assertEquals(calls.inserted.length, 0);
});

Deno.test("DBのエラーを分かりやすいエラーコードに変換する", async () => {
  for (const [message, status, error] of [
    ["too many applications: hourly limit reached", 429, "rate_limited"],
    ['new row for relation "applications" violates check constraint "applications_text_length_check"', 400, "invalid_input"],
    ["connection lost", 500, "server_error"],
  ] as const) {
    const { deps } = makeDeps({ insertApplication: async () => message });
    const res = await handleRequest(post({ turnstileToken: "good-token", application: validApplication }), deps);
    assertEquals(res.status, status);
    assertEquals((await res.json()).error, error);
  }
});

Deno.test("ブラウザからの事前確認（CORS）に応答する", async () => {
  const { deps } = makeDeps();
  const res = await handleRequest(new Request("http://localhost", { method: "OPTIONS" }), deps);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
