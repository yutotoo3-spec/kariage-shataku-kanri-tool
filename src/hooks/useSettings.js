import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { DEFAULT_SETTINGS } from "../utils/calc";
import { useCompany } from "./useCompany";

function mergeRows(rows) {
  const merged = { ...DEFAULT_SETTINGS };
  (rows || []).forEach(row => { merged[row.key] = row.value; });
  return merged;
}

// ログイン済みページ用。RLSで自社分のみに制限されているが、念のため明示的に自社のcompany_idで絞り込む。
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

// 未ログインの公開フォーム用。settingsテーブルは未ログインでは読めないため、1社分だけ返すRPC経由で取得する。
// companyId が解決されるまでは問い合わせない。
export function usePublicSettings(companyId) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    supabase.rpc("get_public_settings", { p_company_id: companyId }).then(({ data }) => {
      setSettings(mergeRows(data));
      setLoading(false);
    });
  }, [companyId]);

  return { settings, loading };
}
