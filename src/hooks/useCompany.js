import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useCompany() {
  const [company, setCompany] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("profiles")
        .select("role, companies(id, name, slug)")
        .eq("user_id", user.id)
        .single();
      setCompany(data?.companies || null);
      setRole(data?.role || null);
      setLoading(false);
    }
    load();
  }, []);

  return { company, role, loading };
}
