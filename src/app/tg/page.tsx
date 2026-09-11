'use client';

import { useEffect, useState } from 'react';

/**
 * Точка входа для Mini App.
 *
 * Telegram кладёт подписанную строку и в адрес страницы (#tgWebAppData), и в
 * window.Telegram.WebApp.initData. Первое доступно сразу и не зависит от
 * внешнего скрипта, поэтому читается первым; второе остаётся запасным путём.
 *
 * Страница меняет подпись на куку и уходит на главную — отдельного экрана
 * входа пользователь не видит.
 */

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } };
  }
}

const SCRIPT = 'https://telegram.org/js/telegram-web-app.js';

function fromHash(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  const value = new URLSearchParams(hash).get('tgWebAppData');
  return value || null;
}

function loadTelegramScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.Telegram?.WebApp) return resolve();
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.append(script);
  });
}

export default function TelegramEntry() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      let initData = fromHash();
      if (!initData) {
        await loadTelegramScript();
        const app = window.Telegram?.WebApp;
        app?.ready?.();
        app?.expand?.();
        initData = app?.initData ?? null;
      }

      if (cancelled) return;
      if (!initData) {
        setError('Откройте страницу из Telegram — или попросите у бота ссылку для браузера.');
        return;
      }

      try {
        const response = await fetch('/api/auth/tg', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
        if (cancelled) return;
        if (response.ok) {
          window.location.replace('/');
          return;
        }
        setError('Telegram не подтвердил вход. Проверьте, что у сервиса указан токен того же бота.');
      } catch {
        if (!cancelled) setError('Сеть недоступна — попробуйте ещё раз.');
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ opacity: 0.7 }}>{error ?? 'Проверяем подпись Telegram…'}</p>
    </main>
  );
}
