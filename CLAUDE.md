# BALANCE — правила работы для Claude Code

Двуязычная (RU/EN) образовательная платформа о балансах на руках, стойках и переходах.
Стек: Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind 4 + Supabase (Postgres, Auth,
Storage, RLS) + собственная админка + Blender 5.2 LTS (Python) для 3D-анимаций. Деплой: Vercel + Supabase.

## Протокол возобновления (в начале КАЖДОЙ сессии)
1. Прочитай `docs/RESUME.md` — там точная следующая операция.
2. Прочитай `docs/TASKS.md` и `docs/PROGRESS.md`.
3. `git status` и `git log --oneline -15`.
4. Подними окружение: `pnpm env:up` (Docker daemon + локальный Supabase), см. «Команды».
5. Продолжай с первой незавершённой задачи. Не начинай проект заново и не переписывай архитектуру.

В конце сессии/блока обнови `docs/PROGRESS.md`, `docs/RESUME.md` (что сделано, что проверено,
блокеры, следующая команда), закоммить и запушь в рабочую ветку.

## Команды
- `pnpm env:up` — запустить dockerd (если не запущен) и `supabase start` (без studio/realtime/edge).
- `pnpm db:reset` — применить миграции заново; `pnpm db:seed` — загрузить контент из `content/` (dev/staging).
- `pnpm dev` — dev-сервер на :3000. `pnpm build && pnpm start` — production-сборка.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit+integration/RLS), `pnpm e2e` (Playwright).
- `pnpm content:validate` — проверка файлов контента.
- `pnpm media:build` — 3D-конвейер (Blender) → `public/media/poses/<slug>/`. См. `pipeline/README.md`.

## Архитектурные правила (не нарушать)
- Одна запись на сущность; локализованные поля `{ ru, en }`. Никаких дублей асан под языки.
- Контент: черновик в `documents.draft` → публикация только через SQL-функцию `publish_document`
  (снимок в `publications`, версия в `document_versions`). Статус проверки меняется только через
  `set_review_status`. Экспертное «Утверждено» может поставить только пользователь с ролью `reviewer`.
- Шаги программ: постоянный UUID `key`; прогресс привязан к ключу; копия шага = новый ключ.
- Публичные данные читаются cookie-less клиентом в функциях `"use cache"` с `cacheTag`; после
  публикации — `updateTag`/`revalidateTag`. Данные пользователя — только через сессию (RLS).
- Секреты только в env. `SUPABASE_SECRET_KEY` — исключительно на сервере (`src/lib/supabase/admin.ts`).
- Проверка прав — в RLS и на сервере, не только скрытием кнопок.
- Медиа адресуются через `mediaUrl()` — хостинг можно заменить без правки страниц.
- Видео и YouTube загружаются только по действию пользователя. Учитывать `prefers-reduced-motion`.
- Не выдумывать источники, преподавателей, YouTube-ссылки, метрики. Не помечать контент
  «проверено преподавателем» без реального утверждения reviewer-аккаунтом.
- Демо-данные (тестовые пользователи) — только dev/staging.

## Next.js 16 — важно
Это не тот Next.js, что в обучающих данных: Middleware → `src/proxy.ts`; включены `cacheComponents`
и `partialPrefetching`; runtime API (cookies, headers, searchParams) — только внутри `<Suspense>`;
`params` — Promise. Перед использованием незнакомого API читай `node_modules/next/dist/docs/`.

## Документация
`docs/PRODUCT_SPEC.md`, `docs/REQUIREMENTS_MATRIX.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
`docs/TASKS.md`, `docs/PROGRESS.md`, `docs/QA_REPORT.md`, `docs/CONTENT_STATUS.md`,
`docs/ANIMATION_STATUS.md`, `docs/RESUME.md`, `docs/CONTENT_GUIDE.md`, `docs/DEPLOYMENT.md`.
