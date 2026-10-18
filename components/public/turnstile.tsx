"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback": () => void;
        "error-callback": () => void;
        "timeout-callback": () => void;
      }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export function Turnstile({ siteKey, onToken, resetKey = 0 }: {
  siteKey: string;
  onToken: (token: string) => void;
  resetKey?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    onToken("");
    let cancelled = false;
    let script: HTMLScriptElement | null = null;
    const render = () => {
      if (!cancelled && window.turnstile && container.current && !widgetId.current) {
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          callback: (token) => { if (!cancelled) onToken(token); },
          "expired-callback": () => { if (!cancelled) onToken(""); },
          "error-callback": () => { if (!cancelled) onToken(""); },
          "timeout-callback": () => { if (!cancelled) onToken(""); },
        });
      }
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-arc-turnstile="true"]');
    if (existing) {
      script = existing;
      if (window.turnstile) render();
      else existing.addEventListener("load", render);
    } else {
      script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.arcTurnstile = "true";
      script.addEventListener("load", render);
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      script?.removeEventListener("load", render);
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, onToken, resetKey]);

  if (!siteKey) return null;
  return <div ref={container} className="min-h-[65px]" aria-label="Bot protection challenge" />;
}
