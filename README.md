# BALANCE

Двуязычная (RU/EN) образовательная платформа о балансах на руках, стойках и переходах:
библиотека из 44 асан с 3D-анимациями, программы четырёх уровней, личная практика и собственная админка
с рецензированием контента.

Стек: Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth,
Storage, RLS) · Playwright / Vitest · Blender 5.2 LTS (Python) для 3D-анимаций. Целевой хостинг — Vercel + Supabase
(деплой ещё не выполнялся, см. [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)).

> Статус контента: тексты и анимации проверены автоматически, но **не проверены преподавателем**. На страницах это
> честно помечено. Подробности — [`docs/FINAL_PRODUCT_AUDIT.md`](docs/FINAL_PRODUCT_AUDIT.md).

## Требования

| Инструмент | Версия | Зачем |
|---|---|---|
| Node.js | ≥ 20.9 (проверено на 22) | приложение, скрипты |
| pnpm | 10 (`corepack enable`) | зависимости (`pnpm-lock.yaml`) |
| Docker | Desktop или Engine | локальный Supabase |
| Supabase CLI | ставится как devDependency (`pnpm exec supabase`) | — |
| Chromium для Playwright | `pnpm exec playwright install chromium` | E2E-тесты |
| Blender 5.2 LTS, ffmpeg, Python 3 + Pillow/numpy | только для пересборки 3D-анимаций | `pipeline/` |

## Быстрый старт

```bash
git clone <repo> balance && cd balance
pnpm install
pnpm env:up        # запускает Docker (если нужно) и локальный Supabase; создаёт .env.local из `supabase status`
pnpm db:reset      # применяет миграции из supabase/migrations
pnpm db:seed       # контент из content/, медиа-манифесты из public/media, тестовые пользователи (только dev)
pnpm dev           # http://localhost:3000 → перенаправит на /ru или /en
```

Если `.env.local` нужно создать вручную — скопируйте `.env.example` и подставьте значения из
`pnpm exec supabase status -o env`. Секретный ключ (`SUPABASE_SECRET_KEY`) используется только на сервере
(`src/lib/supabase/admin.ts`) и в скриптах; он никогда не попадает в браузер (это проверяет E2E-тест).

### Тестовые аккаунты (только локально)

`pnpm db:seed` создаёт пользователей с паролем `Balance-dev-2026`:
`owner@balance.local` (владелец), `editor@balance.local` (редактор), `reviewer@balance.local` (рецензент),
`member@balance.local` (участник). Письма (подтверждение, сброс пароля) приходят в Mailpit: http://127.0.0.1:54324.
Сид отказывается работать с удалённой базой без флага `--allow-remote`; демо-пользователи не предназначены
для production.

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | dev-сервер на :3000 |
| `pnpm build && pnpm start` | production-сборка и запуск на :3000 |
| `pnpm typecheck` / `pnpm lint` | TypeScript (strict) / ESLint |
| `pnpm test` | unit + integration (RLS, рабочий процесс публикации, безопасность) — нужен запущенный Supabase |
| `pnpm e2e` | Playwright (desktop + mobile) против запущенного приложения |
| `pnpm check` | typecheck + lint + test |
| `pnpm content:validate` | проверка файлов контента по схемам |
| `pnpm db:types` | перегенерация типов БД |
| `pnpm db:backup` | резервная копия (`scripts/backup.sh`, восстановление — `scripts/restore.sh`) |
| `pnpm media:build` | 3D-конвейер (Blender) → `public/media/poses/<slug>/`, см. `pipeline/README.md` |

### E2E-тесты

Тесты запускаются против уже запущенного приложения (`BASE_URL`, по умолчанию `http://localhost:3000`).
Сценарии регистрации и сброса пароля переходят по ссылкам из писем, которые ведут на `NEXT_PUBLIC_SITE_URL`,
поэтому приложение должно работать именно на этом адресе. Проверка «изменения видны с первого запроса после
публикации» (`tests/e2e/freshness.spec.ts`) осмысленна прежде всего на чистой production-сборке:

```bash
rm -rf .next && pnpm build && pnpm start &   # или pnpm dev
pnpm e2e
```

Тесты меняют и затем восстанавливают контент локальной базы; перед повторным прогоном с нуля выполните
`pnpm db:reset && pnpm db:seed`.

## Структура

```
src/app/[locale]/        страницы (RU/EN), админка в src/app/[locale]/admin
src/app/actions/         Server Actions (проверка ролей на сервере + RLS)
src/lib/data/public.ts   публичные данные: "use cache" + cacheTag; публикация → updateTag()
src/lib/content-index.ts индекс опубликованного контента для настоящих 404 в src/proxy.ts
supabase/migrations/     схема, RLS, функции publish_document / set_review_status / restore_version
content/                 исходный контент (44 асаны, 22 упражнения, 4 программы, 5 страниц)
public/media/            3D-анимации (MP4/WebM), постеры, кадры, брендовые иллюстрации
pipeline/                Blender-конвейер: персонаж, риг, решатель движения, рендер, проверки
tests/                   unit, integration (Supabase), e2e (Playwright)
docs/                    спецификация, решения, задачи, QA, статусы, деплой
```

## Документация

- Продукт и требования: [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md), [`docs/REQUIREMENTS_MATRIX.md`](docs/REQUIREMENTS_MATRIX.md), исходники ТЗ в `docs/source/`
- Архитектура и решения: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Качество: [`docs/QA_REPORT.md`](docs/QA_REPORT.md), [`docs/FINAL_PRODUCT_AUDIT.md`](docs/FINAL_PRODUCT_AUDIT.md)
- Контент и анимации: [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md), [`docs/CONTENT_STATUS.md`](docs/CONTENT_STATUS.md), [`docs/ANIMATION_STATUS.md`](docs/ANIMATION_STATUS.md), [`docs/ANIMATION_REVIEW_NOTES.md`](docs/ANIMATION_REVIEW_NOTES.md), [`pipeline/README.md`](pipeline/README.md)
- Деплой: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md); продолжение работы: [`docs/RESUME.md`](docs/RESUME.md)
