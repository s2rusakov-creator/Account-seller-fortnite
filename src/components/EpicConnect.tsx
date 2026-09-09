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

    // The countdown ticks every second so the bar moves visibly; polling stays
    // on Epic's own interval.
    const ticker = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    }, 1000);

    try {
      while (!cancelled.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, wait));
        if (cancelled.current) return;

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
            // The seller is still signing in.
            continue;
          }
          if (body.status === 'expired') {
            setError('Код истёк. Запросите новый.');
            setPhase('idle');
            return;
          }
          if (body.status === 'ok' && body.locker) {
            // The read already happened inside that poll; this phase covers the
            // moment between the sign-in landing and the grid appearing.
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
    } finally {
      clearInterval(ticker);
    }
  }, [onLocker]);

  if (phase === 'reading') {
    return (
      <section className="card" style={{ textAlign: 'center', padding: '40px 22px' }}>
        <div className="spinner" />
        <div style={{ font: '650 16px/1.3 system-ui' }}>Вход подтверждён — читаем раздевалку</div>
        <div className="note" style={{ marginTop: 4 }}>Это занимает несколько секунд</div>
      </section>
    );
  }

  if (phase === 'waiting' && code) {
    const share = code.expiresIn > 0 ? secondsLeft / code.expiresIn : 0;
    return (
      <section className="card" style={{ paddingTop: 0 }}>
        {/* The seller stares at this screen for up to ten minutes while nothing
            of theirs happens here. The pulse says the poll is alive. */}
        <div className="polling">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
          <span>Ждём подтверждения от Epic — опрос каждые {Math.max(5, code.interval)} секунд</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,320px) minmax(0,1fr)',
            gap: 26,
            alignItems: 'start',
          }}
        >
          <div>
            <div className="code-box">
              {code.userCode.split('').map((character, index) => (
                <b
                  key={`${character}-${index}`}
                  style={{ animationDelay: `${(index * 0.11).toFixed(2)}s` }}
                >
                  {character}
                </b>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="meter">
                <i style={{ transform: `scaleX(${share.toFixed(3)})` }} />
              </div>
              <div
                className="note"
                style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}
              >
                <span>
                  Код действует ещё {Math.floor(secondsLeft / 60)}:
                  {String(secondsLeft % 60).padStart(2, '0')}
                </span>
                <button
                  onClick={cancel}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--accent)',
                    font: '600 12px/1.4 system-ui',
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>

          <ol className="steps">
            <li>
              Откройте{' '}
              <a href={code.verificationUri} target="_blank" rel="noreferrer">
                {code.verificationUri.replace('https://www.', '')}
              </a>{' '}
              и войдите в аккаунт, который продаёте.
            </li>
            <li>
              Введите код <b>{code.userCode}</b> и подтвердите.
            </li>
            <li>Список подтянется сюда сам — вкладку не закрывайте.</li>
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div style={{ maxWidth: 640 }}>
          <h2 className="section-title" style={{ margin: '0 0 8px' }}>
            Подключение аккаунта
          </h2>
          <p className="note" style={{ margin: 0 }}>
            Список предметов отдаёт только сам Epic и только владельцу аккаунта — по нику или ID
            раздевалку не посмотреть ни здесь, ни где-либо ещё. Вход происходит на сайте Epic:
            пароль сюда не попадает, а выданный токен удаляется сразу после чтения.
          </p>
        </div>
        <button className="btn" onClick={start} disabled={phase === 'starting'}>
          {phase === 'starting' ? 'Запрашиваем код…' : 'Подключить Epic'}
        </button>
      </div>

      {error && (
        <p className="error" style={{ marginBottom: 0, marginTop: 14 }}>
          {error}
        </p>
      )}
    </section>
  );
}
