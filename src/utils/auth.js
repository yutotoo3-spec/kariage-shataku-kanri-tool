// アクセストークン（JWT）の中身（payload）を読む。署名の検証はしない（画面の出し分けにだけ使う）
function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// パスワード再設定メールのリンクからログインした状態かどうか。
// Supabase はログイン方法をトークンの amr（認証方法の一覧）に記録し、再設定リンク経由では "recovery" になる。
// 通常のログイン中の画面からは、現在のパスワードを知らない人（席を外した間の第三者など）に
// パスワードを変えられないよう、再設定画面はこの状態のときだけ使えるようにする。
export function isRecoverySession(session) {
  if (!session?.access_token) return false;
  const payload = decodeJwtPayload(session.access_token);
  return Array.isArray(payload?.amr) && payload.amr.some(a => a?.method === "recovery");
}
