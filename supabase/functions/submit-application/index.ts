// 公開申請フォームの送信を受け付ける Edge Function (#32 第2段階)
// Cloudflare Turnstile（CAPTCHA）のトークンを検証し、人間による送信と確認できた場合だけ申請を登録する。
// 019 のマイグレーションで、未ログインのユーザーが applications に直接 INSERT することは禁止しているため、
// 申請はこの関数（service_role の権限）経由でのみ登録される。
//
// 必要な Secret（Supabase の Edge Functions → Secrets で登録）:
//   TURNSTILE_SECRET_KEY … Cloudflare Turnstile の Secret Key
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で設定する。
//
// デプロイ手順は docs/turnstile.md を参照。
import { createClient } from "npm:@supabase/supabase-js@2";

// 申請者が入力する項目だけを受け取る（013 で anon に許可していた列と同じ）。
// status・審査結果・限度額/負担額は受け取らず、DBトリガーがサーバー側で設定する
export const ALLOWED_FIELDS = [
  "company_id", "scene", "name", "email", "basic_salary", "family_type", "join_date",
  "property_name", "property_address", "floor_area",
  "rent", "common_fee", "management_fee", "parking_fee", "bicycle_parking_fee", "neighborhood_fee",
  "internet_fee", "water_fee_flat", "support_service_fee_monthly", "guarantee_fee_monthly",
  "other_fixed_lease_cost", "satellite_fee", "other_monthly_company", "other_monthly_personal",
  "desired_move_in", "note",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type Deps = {
  // Turnstile のトークンが本物か（Cloudflare に問い合わせる）
  verifyToken: (token: string, remoteIp: string | null) => Promise<boolean>;
  // 申請を受け付けてよい（有効な）会社か
  isActiveCompany: (companyId: string) => Promise<boolean>;
  // 申請を登録する。DBのエラーメッセージを返す（成功なら null）
  insertApplication: (record: Record<string, unknown>) => Promise<string | null>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export function pickAllowedFields(application: Record<string, unknown>) {
  const record: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in application) record[key] = application[key];
  }
  return record;
}

export async function handleRequest(req: Request, deps: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { turnstileToken?: unknown; application?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const { turnstileToken, application } = body ?? {};
  if (typeof turnstileToken !== "string" || turnstileToken.length === 0 || turnstileToken.length > 2048) {
    return json({ error: "captcha_required" }, 400);
  }
  if (!application || typeof application !== "object" || Array.isArray(application)) {
    return json({ error: "invalid_request" }, 400);
  }

  const remoteIp = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  if (!(await deps.verifyToken(turnstileToken, remoteIp))) {
    return json({ error: "captcha_failed" }, 403);
  }

  const record = pickAllowedFields(application as Record<string, unknown>);
  if (typeof record.company_id !== "string" || !(await deps.isActiveCompany(record.company_id))) {
    return json({ error: "company_not_found" }, 400);
  }

  const dbError = await deps.insertApplication(record);
  if (dbError) {
    if (dbError.includes("too many applications")) return json({ error: "rate_limited" }, 429);
    if (/violates (check|not-null) constraint|invalid input syntax/.test(dbError)) {
      return json({ error: "invalid_input" }, 400);
    }
    console.error("insert application failed:", dbError);
    return json({ error: "server_error" }, 500);
  }

  return json({ ok: true });
}

function createDefaultDeps(): Deps {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  return {
    async verifyToken(token, remoteIp) {
      // Secret が未設定なら、検証できないので受け付けない（安全側に倒す）
      if (!secret) {
        console.error("TURNSTILE_SECRET_KEY is not set");
        return false;
      }
      const form = new FormData();
      form.append("secret", secret);
      form.append("response", token);
      if (remoteIp) form.append("remoteip", remoteIp);
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
      if (!res.ok) return false;
      const result = await res.json();
      return result.success === true;
    },
    async isActiveCompany(companyId) {
      const { data, error } = await supabase
        .from("companies").select("id").eq("id", companyId).eq("status", "active").maybeSingle();
      return !error && data !== null;
    },
    async insertApplication(record) {
      const { error } = await supabase.from("applications").insert(record);
      return error ? error.message : null;
    },
  };
}

// テストから読み込むときはサーバーを起動しない
if (!Deno.env.get("SUBMIT_APPLICATION_TEST")) {
  const deps = createDefaultDeps();
  Deno.serve(req => handleRequest(req, deps));
}
