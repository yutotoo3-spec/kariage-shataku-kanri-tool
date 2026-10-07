import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { DEFAULT_SETTINGS } from "../utils/calc";

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("settings").select("key, value").then(({ data }) => {
      if (data) {
        const merged = { ...DEFAULT_SETTINGS };
        data.forEach(row => { merged[row.key] = row.value; });
        setSettings(merged);
      }
      setLoading(false);
    });
  }, []);

  return { settings, loading };
}
