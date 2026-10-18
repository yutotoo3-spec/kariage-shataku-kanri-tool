import { useEffect, useRef } from "react";

// Cloudflare Turnstile（CAPTCHA）のサイトキー。公開してよい値（Secret Key は Edge Function 側だけに置く）。
// ローカル開発では、Cloudflare 公式のテスト用キー（1x00000000000000000000AA：常に成功）を VITE_TURNSTILE_SITE_KEY に設定できる
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAAFaI3GzISf6qoQh_";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { scriptPromise = null; reject(new Error("Turnstile の読み込みに失敗しました")); };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

// onToken: 判定が済んだらトークン、期限切れ・エラーのときは null を受け取る
// resetKey: 値を変えるとウィジェットを作り直す（トークンは1回しか使えないため、送信失敗後に作り直す）
export default function TurnstileWidget({ onToken, onLoadError, resetKey }) {
  const containerRef = useRef(null);
  const onTokenRef = useRef(onToken);
  const onLoadErrorRef = useRef(onLoadError);

  useEffect(() => {
    onTokenRef.current = onToken;
    onLoadErrorRef.current = onLoadError;
  });

  useEffect(() => {
    let widgetId;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: "ja",
          callback: token => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(err => { if (!cancelled) onLoadErrorRef.current?.(err); });
    return () => {
      cancelled = true;
      if (widgetId !== undefined) window.turnstile?.remove(widgetId);
    };
  }, [resetKey]);

  return <div ref={containerRef} />;
}
