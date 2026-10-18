import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// ログイン中のユーザーが運営者（企業登録の招待を発行できる人）かどうか。
// 画面の出し分け用で、実際の権限チェックはDB側（is_platform_admin）で行う
export function usePlatformAdmin() {
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("is_platform_admin").then(({ data }) => {
      setIsPlatformAdmin(data === true);
      setLoading(false);
    });
  }, []);

  return { isPlatformAdmin, loading };
}
