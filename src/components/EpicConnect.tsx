'use client';

import type { LockerResult } from '@/lib/fortnite/types';
import { useCallback, useEffect, useRef, useState } from 'react';

interface DeviceCode {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
  client: string;
}

type Phase = 'idle' | 'starting' | 'waiting' | 'reading';

export function EpicConnect({ onLocker }: { onLocker: (locker: LockerResult) => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const cancelled = useRef(false);

  useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  const cancel = useCallback(() => {
    cancelled.current = true;
    setPhase('idle');
    setCode(null);
  }, []);

  const start = useCallback(async () => {
    cancelled.current = false;
    setError(null);
    setPhase('starting');
    setCode(null);

    let issued: DeviceCode;
    try {
      const response = await fetch('/api/epic/device', { method: 'POST' });
      const body = (await response.json()) as DeviceCode & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Epic не выдал код');
      issued = body;
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Не удалось начать вход');
      setPhase('idle');
      return;
    }

    setCode(issued);
    setSecondsLeft(issued.expiresIn);
    setPhase('waiting');
    // Opening the code page for the seller saves them typing it; the code
    // stays on screen because a blocked popup must not strand them.
    window.open(issued.verificationUriComplete, '_blank', 'noopener,noreferrer');

    const deadline = Date.now() + issued.expiresIn * 1000;
    // Epic asks for one poll every `interval` seconds and answers
    // `slow_down` if that is ignored.
    const wait = Math.max(5, issued.interval) * 1000;

    while (!cancelled.current && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, wait));
      if (cancelled.current) return;
      setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));

      try {
        const response = await fetch('/api/epic/poll', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ deviceCode: issued.deviceCode, client: issued.client }),
        });
        const body = (await response.json()) as {
          status?: string;
          locker?: LockerResult;
          error?: string;
        };

        if (!response.ok) throw new Error(body.error ?? 'Ошибка Epic');
        if (body.status === 'pending') {
          // The seller is still signing in. The next answer may be the locker,
          // and reading one takes a while, so say so before it arrives.
          continue;
        }
        if (body.status === 'expired') {
          setError('Код истёк. Запросите новый.');
          setPhase('idle');
          return;
        }
        if (body.status === 'ok' && body.locker) {
          setPhase('reading');
          onLocker(body.locker);
          setPhase('idle');
          setCode(null);
          return;
        }
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : 'Ошибка связи с Epic');
        setPhase('idle');
        return;
      }
    }

    if (!cancelled.current) {
      setError('Код истёк. Запросите новый.');
      setPhase('idle');
    }
  }, [onLocker]);

  return (
    <section className="card">
      <div className="spread">
        <div>
          <h2 className="section-title">Подключение аккаунта</h2>
          <p className="note" style={{ margin: 0, maxWidth: 640 }}>
            Список предметов отдаёт только сам Epic и только владельцу аккаунта — по нику или ID
            раздевалку не посмотреть ни здесь, ни где-либо ещё. Вход происходит на сайте Epic:
            пароль сюда не попадает, а выданный токен удаляется сразу после чтения.
          </p>
        </div>
        {phase === 'idle' && (
          <button className="btn" onClick={start}>
            Подключить Epic
          </button>
        )}
        {phase === 'starting' && <span className="note">Запрашиваем код…</span>}
        {phase === 'reading' && <span className="note">Читаем раздевалку…</span>}
        {phase === 'waiting' && (
          <button className="btn secondary" onClick={cancel}>
            Отмена
          </button>
        )}
      </div>

      {code && phase === 'waiting' && (
        <div style={{ marginTop: 18 }}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
            <div className="code-box">{code.userCode}</div>
            <ol className="steps" style={{ flex: '1 1 320px' }}>
              <li>
                Откройте <a href={code.verificationUri} target="_blank" rel="noreferrer">{code.verificationUri.replace('https://www.', '')}</a>{' '}
                и войдите в аккаунт, который продаёте.
              </li>
              <li>
                Введите код <b>{code.userCode}</b> и подтвердите.
              </li>
              <li>Список подтянется сюда сам — вкладку не закрывайте.</li>
            </ol>
          </div>
          <p className="note" style={{ marginBottom: 0 }}>
            Код действует ещё {Math.floor(secondsLeft / 60)}:
            {String(secondsLeft % 60).padStart(2, '0')}.
          </p>
        </div>
      )}

      {error && (
        <p className="error" style={{ marginBottom: 0 }}>
          {error}
        </p>
      )}
    </section>
  );
}
