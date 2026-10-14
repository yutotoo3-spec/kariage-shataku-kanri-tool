import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { DEFAULT_SETTINGS } from "../utils/calc";
import { useCompany } from "./useCompany";

function mergeRows(rows) {
  const merged = { ...DEFAULT_SETTINGS };
  (rows || []).forEach(row => { merged[row.key] = row.value; });
  return merged;
}

// ログイン済みページ用。settingsのSELECT用RLSは公開フォームからも読めるよう企業を問わず許可しているため、
// ここで明示的に自社のcompany_idに絞り込む（絞り込まないと他社の設定と混ざって返ってくる）。
export function useSettings() {
  const { company } = useCompany();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) return;
    supabase.from("settings").select("key, value").eq("company_id", company.id).then(({ data }) => {
      setSettings(mergeRows(data));
      setLoading(false);
    });
  }, [company?.id]);

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
