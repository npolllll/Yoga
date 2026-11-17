# Задачи и зависимости

Легенда: [x] сделано · [~] в работе · [ ] не начато. Зависимости в скобках.

## Phase 0 — Audit & Bootstrap
- [x] Аудит исходников и окружения (Node 22, pnpm 10, Docker, Blender 5.2.4 LTS, FFmpeg 6.1, Python 3.13)
- [x] Next.js 16 + TS + Tailwind 4, Supabase local, vitest, Playwright 1.63
- [x] Документация проекта, CLAUDE.md, решения
- [ ] REQUIREMENTS_MATRIX — заполнить полностью (Phase 8)

## Phase 1 — Design System
- [~] Токены, шрифты, иконки, кнопки, бейджи
- [ ] Header/Footer/меню/переключатель языка, диалоги, формы, skeleton

## Phase 2 — Data & Backend
- [x] Миграции: документы/публикации/версии/ревью, справочники, медиа, пользовательские таблицы, аудит, RLS, storage
- [ ] Seed (`scripts/seed.ts`): тестовые пользователи dev, импорт контента (content/)
- [ ] Интеграционные тесты RLS и workflow (publish/approve/restore/stepKey)

## Phase 3 — Public Product (2)
- [ ] Home, Pose Library, Pose Detail, Programs, Program, Step, My Practice, Profile, Auth (login/sign-up/reset/update), About, FAQ, Contact, Privacy, Terms, 404

## Phase 4 — Administration (2)
- [ ] Dashboard, Pose Editor, Program Editor, Exercises, Pages, Media Library, Taxonomy, Settings, Users/Roles, Audit, Preview RU/EN, versions

## Phase 5 — 3D Master Character
- [ ] Персонаж (Blender Python), материалы, риг с IK, сравнительные рендеры

## Phase 6 — Animation Pilot (5)
- [ ] Bakasana, Parsva Bakasana, Handstand, Forearm Stand, One-Arm Handstand; очередь рендера; проверки медиа

## Phase 7 — Content & Animation Production (6)
- [~] 44 карточки асан RU/EN (параллельно), 22 упражнения
- [ ] 4 программы (Beginner/Intermediate/Advanced/Expert), страницы (home/about/faq/contact/privacy/terms)
- [ ] Остальные анимации, постеры, ключевые кадры, проверка уникальности

## Phase 8 — Full QA
- [ ] E2E 30 сценариев, RLS, a11y, Lighthouse, build, media validation, broken links

## Phase 9 — Deployment Readiness
- [ ] Vercel/Supabase конфигурация, лимиты free tier, backup/restore, release checklist
