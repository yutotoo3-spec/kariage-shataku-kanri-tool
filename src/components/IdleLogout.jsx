import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { IDLE_TIMEOUT_MS, clearActivity, idleState, readActivity, writeActivity } from "../utils/idle";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
const WRITE_THROTTLE_MS = 15 * 1000;
const CHECK_INTERVAL_MS = 10 * 1000;

// ログイン中、30分操作がなければ自動でログアウトする。ログアウトの2分前に警告を表示する
export default function IdleLogout({ userId }) {
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    let lastWrite = 0;
    function markActive() {
      const now = Date.now();
      if (now - lastWrite < WRITE_THROTTLE_MS) return;
      lastWrite = now;
      writeActivity(userId, now);
    }

    async function check() {
      const state = idleState(readActivity(), userId, Date.now());
      if (state === "reset") { writeActivity(userId); setWarning(false); return; }
      if (state === "expired") {
        clearActivity();
        try { sessionStorage.setItem("kariage:idleLogout", "1"); } catch { /* 表示用のみ */ }
        await supabase.auth.signOut({ scope: "local" });
        return;
      }
      setWarning(state === "warning");
    }

    check();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, markActive, { passive: true }));
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, markActive));
      clearInterval(timer);
    };
  }, [userId]);

  if (!warning) return null;

  return (
    <div role="alert" style={{
      position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1000,
      background: "#1E293B", color: "#fff", borderRadius: 10, padding: "12px 16px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 12,
      fontSize: 13, maxWidth: "calc(100% - 32px)", flexWrap: "wrap",
    }}>
      <span>操作がないため、まもなく自動でログアウトします（{IDLE_TIMEOUT_MS / 60000}分間操作なし）</span>
      <button onClick={() => { writeActivity(userId); setWarning(false); }} style={{
        padding: "6px 12px", borderRadius: 6, border: "none", background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600,
      }}>
        ログインを続ける
      </button>
    </div>
  );
}
