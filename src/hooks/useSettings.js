import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { DEFAULT_SETTINGS } from "../utils/calc";

function mergeRows(rows) {
  const merged = { ...DEFAULT_SETTINGS };
  (rows || []).forEach(row => { merged[row.key] = row.value; });
  return merged;
}

// ログイン済みページ用。RLSが自動的に自社（company_id）の行のみを返す。
export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("settings").select("key, value").then(({ data }) => {
      setSettings(mergeRows(data));
      setLoading(false);
    });
  }, []);

  return { settings, loading };
}

// 未ログインの公開フォーム用。companyId が解決されるまでは問い合わせない
// （company_id を省略すると全企業分の設定が返ってしまうため、必ず企業を明示して絞り込む）。
export function usePublicSettings(companyId) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("settings").select("key, value").eq("company_id", companyId).then(({ data }) => {
      setSettings(mergeRows(data));
      setLoading(false);
    });
  }, [companyId]);

  return { settings, loading };
}
