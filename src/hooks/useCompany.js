import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

async function fetchProfile(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("role, companies(id, name, slug)")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export function useCompany() {
  const [company, setCompany] = useState(null);
  const [role, setRole] = useState(null);
  // 所属はしているが、会社が運営者によって利用停止されている（020 で停止中の会社は companies を読めなくなる）
  const [suspended, setSuspended] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      let data = await fetchProfile(user.id);
      if (!data) {
        // 招待経由の登録直後の初回ログインでは、App.jsx の企業作成・招待承認RPCより先に
        // ここが実行されて所属企業が見つからないことがあるため、ここでも保留中の処理を実行して読み直す。
        // どちらも冪等で、該当する招待が無い場合はエラーを返すだけ
        await supabase.rpc("create_company_and_owner");
        await supabase.rpc("accept_invite");
        data = await fetchProfile(user.id);
      }
      setCompany(data?.companies || null);
      setRole(data?.role || null);
      setSuspended(!!data && !data.companies);
      setLoading(false);
    }
    load();
  }, []);

  return { company, role, loading, suspended };
}
