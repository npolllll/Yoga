# Архитектура BALANCE

```
Браузер (mobile-first)
  │  статическая оболочка страниц из CDN + потоковые серверные компоненты;
  │  личные данные — отдельный запрос /api/me/state и server actions
  ▼
Vercel ── Next.js 16 (App Router, Cache Components, TypeScript)
  ├─ src/proxy.ts            локаль (корень → /ru|/en), обновление сессии Supabase
  ├─ src/app/[locale]/...    публичные страницы, аккаунт, «Моя практика», админка (/[locale]/admin)
  ├─ src/app/api/...         GET /api/me/state, экспорт данных
  ├─ src/app/auth/...        подтверждение email, восстановление пароля (PKCE code exchange)
  └─ server actions          избранное, статусы, шаги, журнал, цели, редактирование контента
        │
        ▼
Supabase ── Postgres 17 + RLS ── Auth (email/password) ── Storage (бакет media)
public/media/poses/<slug>/  анимации MP4 (H.264), постеры и кадры WebP — раздаёт CDN Vercel
pipeline/ (локально)        Blender 5.2 LTS + Python: персонаж, риг, позы, очередь рендера, проверки
```

## Данные
- `documents` — черновики всех типов контента (`pose | program | exercise | page`), локализованный JSON
  `draft` + мета (категория, уровень, навыки, вес). Схемы — `src/lib/content/schema.ts` (zod).
- `publications` — опубликованный снимок (публичное чтение). Пишется только `publish_document()`.
- `document_versions` — история (publish/unpublish/restore), `restore_version()` возвращает версию в черновик.
- `reviews` — редакторские/экспертные решения и замечания. `set_review_status()` — единственный путь смены статуса;
  «approved» может поставить только роль `reviewer`; правка контента после утверждения сбрасывает статус.
- `levels`, `categories`, `skills`, `site_settings` — справочники и настройки (публичное чтение, запись editor/owner).
- `media_assets` — метаданные медиа (URL, размеры, длительность, alt RU/EN, статус проверки).
- Пользовательские: `profiles`, `user_roles`, `favorites`, `pose_progress` (not_started/in_progress/learned),
  `step_completions` (program_id + step_key UUID), `practice_log`, `goals`. RLS: только свои строки;
  ссылки допускаются только на опубликованные документы нужного типа.
- `audit_log` — журнал (триггеры + функции).

## Кэширование
- Публичные чтения — `src/lib/data/public.ts`: `"use cache"` + `cacheLife('hours')` + теги
  (`catalog`, `pose:<slug>`, `programs`, `page:<slug>`, `taxonomy`, `media`).
- После публикации/правки админка вызывает `updateTag(...)` → изменения видны сразу.
- Персональные данные никогда не кэшируются на сервере; страницы остаются статическими, личный слой
  догружается клиентом.

## Медиа
- `mediaUrl(path)` = `NEXT_PUBLIC_MEDIA_BASE_URL` + путь: смена хостинга без правки страниц.
- Анимация: постер (WebP) → по нажатию `<video preload="none" playsinline muted>`; YouTube — фасад, iframe
  `youtube-nocookie.com` только по нажатию; при ошибке — ссылка на провайдера.

## Безопасность
- RLS на всех таблицах, явные GRANT, security definer функции с `search_path = ''`.
- Серверная проверка ролей в каждом server action админки (`requireRole`).
- `SUPABASE_SECRET_KEY` используется только в `src/lib/supabase/admin.ts` (удаление аккаунта, управление ролями владельцем).
