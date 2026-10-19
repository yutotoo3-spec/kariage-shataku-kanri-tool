// 一定時間操作がない場合の自動ログアウト (#56)
// 最後に操作した時刻を localStorage に保存し、同じブラウザの別タブとも共有する
// （どれか1つのタブで操作していれば、他のタブもログアウトしない）

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const IDLE_WARNING_MS = 2 * 60 * 1000;
const STORAGE_KEY = "kariage:lastActivity";

export function readActivity() {
  try {
    const record = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return record && typeof record.at === "number" ? record : null;
  } catch {
    return null;
  }
}

export function writeActivity(userId, at = Date.now()) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, at }));
  } catch {
    // 保存できない環境（プライベートモード等）では、このタブの中だけで判定する
  }
}

export function clearActivity() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 何もしない
  }
}

// 最後の操作からの経過時間で状態を判定する。
// 別のユーザーの記録や記録がない場合は、今から数え始める（"reset"）
export function idleState(record, userId, now, timeout = IDLE_TIMEOUT_MS, warning = IDLE_WARNING_MS) {
  if (!record || record.userId !== userId) return "reset";
  const idle = now - record.at;
  if (idle >= timeout) return "expired";
  if (idle >= timeout - warning) return "warning";
  return "active";
}
