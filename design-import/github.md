repo: s2rusakov-creator/Account-seller-fortnite
branch: main

## Last sync
date: 2026-09-09T12:07:35Z

### Updated in this project
- Прочитаны globals.css, page.tsx и все 10 компонентов как основа светлой темы
- Собран интерактивный макет инструмента в светлой теме (двухколоночный воркспейс)
- Новая система цветов для 16 редкостей под светлые плашки
- Тёмный рендер-выход (collage.ts / profile-card.ts) не тронут — только оправа в UI

## Screen map
| Экран в проекте | Файлы репозитория |
| --- | --- |
| Подключение Epic (код устройства) | src/components/EpicConnect.tsx, src/app/globals.css |
| Шапка + статистика аккаунта | src/components/StatsStrip.tsx, src/app/page.tsx |
| Фильтры + сетка предметов | src/components/Filters.tsx, src/components/ItemGrid.tsx, src/lib/fortnite/rarity.ts, src/lib/fortnite/notable.ts |
| Коллаж и превью | src/components/CollagePanel.tsx, src/lib/collage.ts, src/lib/profile-card.ts |
| Текст объявления | src/components/ListingPanel.tsx, src/lib/listing.ts |
| Оффер на площадки | src/components/UploadPanel.tsx, src/lib/history.ts |
