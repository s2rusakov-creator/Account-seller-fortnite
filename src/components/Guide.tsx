'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The steps, in the app rather than in a document nobody opens.
 *
 * Shows itself once — on the first visit from this browser — and then gets out
 * of the way behind the "Инструкция" button in the header. The flag is
 * per-browser rather than per-account: it answers "has this person seen this",
 * which has nothing to do with which locker is loaded.
 */

const SEEN_KEY = 'fortnite-lister.guide.seen.v1';

export interface GuideState {
  shown: boolean;
  open: () => void;
  close: () => void;
}

export function useGuide(): GuideState {
  // Starts closed on the server and on the first client frame: reading
  // localStorage during render would make the markup React produced on the
  // server disagree with the first client paint.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) setShown(true);
    } catch {
      /* private mode: just do not auto-open */
    }
  }, []);

  const close = useCallback(() => {
    setShown(false);
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* nothing to remember it with; it will open again next time */
    }
  }, []);

  return { shown, open: () => setShown(true), close };
}

const STEPS: [string, string][] = [
  [
    'Подключите аккаунт',
    'Кнопка «Подключить Epic» выдаёт код. Введите его на epicgames.com/activate, войдя в тот аккаунт, который продаёте. Пароль сюда не попадает, токен удаляется сразу после чтения. Если входить не хотите — «Отметить вручную».',
  ],
  [
    'Проверьте список',
    'Придёт вся раздевалка: скины, кирки, эмоции, обёртки и остальное, плюс уровень, В-Баксы и привязки к консолям. Редкое (Renegade Raider, Black Knight и подобное) идёт первым и обведено золотым.',
  ],
  [
    'Соберите коллаж',
    'Фильтры сверху задают, что попадёт на картинки. «Отдельно по типам» рендерит скины, кирки и эмоции разными наборами — так объявление читается лучше, чем одной простынёй.',
  ],
  [
    'Замажьте скриншот',
    'Если прикладываете реальный скриншот из игры, закройте ник и почту мозаикой — по ним аккаунт находят и пробуют вернуть.',
  ],
  [
    'Проверьте текст',
    'Заголовок и описание генерируются из состава и правятся руками. Всё, чего нет в данных, лучше не дописывать: покупатель проверит.',
  ],
  [
    'Выставьте оффер',
    'Сначала «Пробный прогон» — он показывает, что именно уйдёт на площадку, с закрытыми паролями. Поля для Fortnite не сверены с их схемой, так что первый прогон делайте пробным всегда.',
  ],
];

export function Guide({ state }: { state: GuideState }) {
  if (!state.shown) return null;

  return (
    <section className="card" style={{ borderColor: 'var(--accent-dark)' }}>
      <div className="spread" style={{ marginBottom: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Как это работает
        </h2>
        <button className="btn secondary small" onClick={state.close}>
          Понятно
        </button>
      </div>
      <ol className="steps" style={{ lineHeight: 1.6 }}>
        {STEPS.map(([heading, body]) => (
          <li key={heading} style={{ marginBottom: 8 }}>
            <b>{heading}.</b> {body}
          </li>
        ))}
      </ol>
    </section>
  );
}
