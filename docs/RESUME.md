# RESUME — следующая операция

Состояние: продукт, админка, контент (44 асаны, 22 упражнения, 4 программы, 5 страниц) и все 44 3D-анимации
готовы и проверены автоматически (unit/integration 34, E2E 31 на dev и production, validate_media 44/44,
ESLint 0, tsc 0). Деплой не выполнялся. Экспертной проверки нет.

1. Окружение: `pnpm env:up`; dev: `setsid nohup pnpm dev > /tmp/dev.log 2>&1 &`. Медиа в БД: `pnpm db:seed`.
   Production локально: `rm -rf .next && pnpm build && pnpm start` (перед повторным запуском убить процессы
   `next-server` — `pkill -f 'next start'` их не находит).
2. Открытые инженерные задачи (TASKS, Phase 8–9):
   - LCP в лабораторной симуляции 2,3–3,3 с (цель 2,5 с): статическое подмножество Lora (одно начертание) вместо вариативного; шрифты — `public/fonts/v5` (`scripts/fonts-sync.py`).
   - (опц.) строгий 404 на первом запросе к несуществующему slug — проверка в `src/proxy.ts`.
3. Изменение 3D: правка `pipeline/balance3d/*.py` перерендерит все позы (хэш). Для одной позы — правка
   `pipeline/poses/<slug>.json`, проверка `pipeline/keysheet.py` + `pipeline/poster_probe.sh`, затем
   `pipeline/render_all.sh @pipeline/out/render_order.txt` (или `queue.py --only <slug>`), `validate_media.py --sheet`.
4. Заблокировано владельцем (`docs/DECISIONS.md`, «Открытые вопросы»): рецензент-преподаватель
   (`docs/ANIMATION_REVIEW_NOTES.md`), проверенные ссылки видеоуроков RU/EN, доступы Vercel/Supabase для деплоя
   (`docs/DEPLOYMENT.md`), юрисдикция и доступность из РФ, коммерческий статус (план Vercel).

## Контрольная точка финального аудита (2026-11-20)
Идёт этап «FINAL AUTONOMOUS COMPLETION & QA» (мастер-промпт пользователя). Порядок и статус:
1. Кэш после публикации (в работе). Найдено: на динамических маршрутах (`/[locale]/programs/[slug]`, `/poses/[slug]`,
   шаги) первый ответ после публикации собирается из Resume Data Cache fallback-оболочки (Next 16.4.6 проверяет
   теги RDC только внутри запроса server action — `isRevalidatedAfter` в `next/dist/server/use-cache/use-cache-wrapper.js`).
   Статические маршруты (`/about`) свежие сразу. Проверка: `scratchpad/fresh-check.mjs` на чистой сборке (:3100,
   скрипт `scratchpad/prod3100.sh`, не трогает dev `.next/dev`). Эксперимент «view по slug» (незакоммичен:
   `getProgramView` в `src/lib/data/public.ts`) — НЕ помог. Следующий вариант: отказ от fallback-оболочки для
   контента или самостоятельная проверка версии публикации.
2. Аудиты субагентами (визуальный, контент, анимации) прерваны лимитом API — правок не внесено; перезапускать
   по одному.
3. Затем: security-тесты, README (его нет!) + проверка «чистого клона», требования, LCP, финальный QA,
   `docs/FINAL_PRODUCT_AUDIT.md`.
