# Матрица требований

Источники: **M** — мастер-промпт v2.0, **S** — спецификация v1.0 (`docs/source`), **J** — JPG-макет, **P** — Balance.pdf.
Статус: ✅ реализовано и проверено тестом · 🟢 реализовано (проверено вручную/скриншотом) · 🟡 частично · ⛔ заблокировано внешним фактором · ⬜ не начато.

## Платформа и навигация
| Требование | Ист. | Реализация | Тест | Статус |
|---|---|---|---|---|
| RU/EN, маршруты `/ru`, `/en`, корень → язык (cookie → Accept-Language) | M,S | `src/proxy.ts`, `lib/i18n` | e2e public «home in RU and EN» | ✅ |
| Смена языка сохраняет страницу, асану, программу, фильтры | M | `LocaleSwitcher` (полная перезагрузка, query сохраняется) | e2e «filters… survive a language switch», «language switch keeps the pose» | ✅ |
| Не смешивать языки на экране; `html lang` | M | словари `lib/i18n/dictionaries`, корневой layout | e2e (lang=en после переключения) | ✅ |
| hreflang, sitemap, локализованные метаданные | M | `alternates` в `generateMetadata`; `app/sitemap.ts` (hreflang), `app/robots.ts` | e2e «SEO: hreflang…» | ✅ |
| Header/Footer, мобильное меню, поиск/избранное/профиль | S,J | `components/layout/*` | e2e mobile, axe | ✅ |
| Нет ссылок «в никуда» | M | все пункты меню ведут на реализованные страницы | e2e «no dead internal links» (RU/EN, ключевые страницы) | ✅ |
| 404 и ошибки | M | `[locale]/not-found.tsx`, `[...rest]`, `error.tsx` | e2e «localized 404» | ✅ |

## Главная
| Требование | Ист. | Реализация | Тест | Статус |
|---|---|---|---|---|
| Hero, слоган, кнопки Explore/Start Learning | S,P | `app/[locale]/page.tsx` | e2e home | ✅ |
| 7 категорий → каталог с активным фильтром | S,M | ссылки `?type=` | e2e «category card…» | ✅ |
| 4 уровня → каталог/программа уровня | S,M | карточки уровней | скриншот | 🟢 |
| Featured, обучение, How it works, My Practice teaser, Why, FAQ, Final CTA, Footer | S | секции главной | скриншот | 🟢 |
| Тексты главной редактируются в админке | M | page doc `home` (`blocks`, `featured`) | — | 🟢 |
| Иллюстрации маскота (hero, уровни, категории) | P,M | `pipeline/brand.py` → `public/media/brand` | — | 🟡 рендер в очереди (после поз) |
| Без вымышленной статистики | M | счётчиков пользователей нет | — | ✅ |

## Библиотека асан
| Требование | Ист. | Реализация | Тест | Статус |
|---|---|---|---|---|
| Поиск RU/EN/санскрит/альтернативные/транслит/раскладка | M,S | `lib/search/normalize.ts` | unit search (13 запросов), e2e search | ✅ |
| Фильтры: категория, уровень, навыки; быстрые навыки; сброс | M,S,J | `components/pose/Library.tsx` | e2e filters | ✅ |
| Счётчик, сортировка (Recommended/название/уровень), Load more | M | Library | e2e sort | ✅ |
| Фильтры в URL, сохраняются при смене языка | M | `useSearchParams` | e2e | ✅ |
| Пустые состояния, ошибка загрузки | M,S | Library, `error.tsx` | e2e «Ничего не найдено» | ✅ |
| Фильтры одной рукой на телефоне | M | нижняя панель | e2e mobile filter sheet | ✅ |

## Страница асаны (17 блоков)
| Требование | Ист. | Реализация | Тест | Статус |
|---|---|---|---|---|
| Названия RU/EN/санскрит, категория, уровень (не только цветом) | M,S | `PoseView`, `LevelBadge` | e2e, axe | ✅ |
| Медиаблок: постер → анимация по нажатию, пауза/повтор, Reduce Motion | M | `AnimationPlayer` | e2e «lazy animation» | ✅ |
| Описание, требования, предосторожности, техника, ключевые кадры, анатомия, подготовка, ошибки | M,S,J | `PoseView` | e2e headings | ✅ |
| Видеоурок: фасад, без запросов к YouTube до нажатия, fallback-ссылка, отдельный урок на язык | M | `VideoLesson`, `video.ru/en` | e2e (0 запросов) | ✅ (ссылки уроков не добавлены — ⛔ требуется проверка) |
| Связанные, проще/сложнее, вхождение в программы | M | `PoseView` | — | 🟢 |
| Избранное, статус освоения (3 состояния) | M | `PoseActions` | e2e member | ✅ |
| Предупреждение «не проверено преподавателем» | M | `expert_approved` | e2e | ✅ |

## Программы и практика
| Требование | Ист. | Реализация | Тест | Статус |
|---|---|---|---|---|
| Программы 4 уровней; шаги Lesson/Exercise/Pose; RU/EN | M | `content/programs`, страницы программ | e2e programs | ✅ |
| Постоянный UUID `stepKey`; перестановка не сбрасывает прогресс; копия = новый ключ; удалённые шаги не ломают данные | M | `step-keys.ts`, `publish_document`, `restore_version` | unit step-keys, integration «progress survives…», e2e admin reorder | ✅ |
| «Шаг выполнен» в контексте шага программы; независим от «Асана освоена» | M | step page, `StepCompleteButton` | e2e member «independent» | ✅ |
| My Practice: Overview, Favorites, In Progress, Learned, Programs, History, Goals | M | `PracticeDashboard` | e2e log/goals | ✅ |
| Синхронизация между устройствами и языками | M | `/api/me/state`, RLS | e2e (второй контекст, EN) | ✅ |

## Аккаунты и безопасность
| Требование | Ист. | Реализация | Тест | Статус |
|---|---|---|---|---|
| Регистрация с подтверждением email, вход/выход, восстановление пароля | M | `actions/auth.ts`, `/auth/callback` (PKCE) | e2e member (Mailpit) | ✅ |
| Гость → вход → возврат к исходному действию | M | `AuthPrompt` + `?intent=` | e2e sign up + intent | ✅ |
| Экспорт данных, удаление аккаунта | M | `/api/me/export`, `deleteAccount` | e2e export/delete | ✅ |
| RLS на всех таблицах; чужие данные недоступны | M | миграция `core` | integration (14 тестов) | ✅ |
| Роли Guest/Member/Reviewer/Editor/Owner; проверки на сервере и в RLS | M | `user_roles`, `AdminGate`, server actions | integration, e2e admin no-access | ✅ |
| service-role ключ не в браузере | M | `lib/supabase/admin.ts` (server-only) | code review | ✅ |

## Админка
| Требование | Ист. | Реализация | Тест | Статус |
|---|---|---|---|---|
| Dashboard, редакторы асан/программ/упражнений/страниц | M | `app/[locale]/admin/*`, `DocEditor` | e2e admin | ✅ |
| Черновики, предпросмотр RU/EN и рядом, публикация, снятие с публикации, дублирование, удаление (owner) | M | `actions/admin.ts` | e2e admin draft→preview→publish→delete | ✅ |
| Статусы Draft → Editorial → Expert → Approved → Published; утверждает только reviewer | M | `set_review_status` | integration workflow, e2e «review workflow» (UI + отказ сервера) | ✅ |
| Версии и откат; журнал изменений | M | `document_versions`, `audit_log` | integration, e2e «publication lifecycle» | ✅ |
| Порядок шагов, предупреждение о влиянии на прогресс | M | `ProgramSteps` (счётчики) | e2e reorder | ✅ |
| Медиатека: загрузка, alt RU/EN, статус проверки, мастер-файлы не публикуются | M | media page, Storage | e2e media upload | ✅ |
| Категории, навыки, уровни (подпись Pro), контакты, политика публикации | M | settings page | e2e «settings: custom label» | ✅ |

## Контент
| Требование | Ист. | Реализация | Тест | Статус |
|---|---|---|---|---|
| 40–50 уникальных асан RU/EN по 7 категориям и 4 уровням | M | `content/poses` (44) | `pnpm content:validate` | ✅ (экспертная проверка ⛔) |
| Упражнения, программы, страницы | M | `content/*` | validate | ✅ |
| Нет вымышленных источников/ссылок; честный статус экспертизы | M | правила + валидатор | validate | ✅ |

## 3D
| Требование | Ист. | Реализация | Тест | Статус |
|---|---|---|---|---|
| Единый персонаж (Blender Python), риг с ограничениями, контроль контактов | M | `pipeline/balance3d` | метрики в манифестах | ✅ |
| 5 пилотных анимаций | M | `pipeline/poses/*` | `validate_media.py` | 🟡 финальный рендер идёт (первые в очереди) |
| 40–50 анимаций 10 с / 30 fps / 300 кадров, постер, 4–6 ключевых кадров | M | queue + postprocess | покадровая проверка 44/44, validate_media | 🟡 конфиги 44/44 ✓, финальный рендер идёт |
| Очередь, повтор, продолжение, журналы, превью/финал, манифест, проверки | M | `queue.py`, `render_pose.py`, `validate_media.py` | запуск очереди | ✅ |

## Производительность, доступность, развёртывание
| Требование | Ист. | Реализация | Тест | Статус |
|---|---|---|---|---|
| Lighthouse ≥ 90 (моб.), LCP ≤ 2,5 с, CLS ≤ 0,1 | M | статические страницы, лёгкие медиа | Lighthouse prod (97/95/97) | ✅ (лаборатория; полевые данные — после запуска) |
| Клавиатура, контраст, alt, Reduce Motion | M,S | токены, aria, `prefers-reduced-motion` (`useSyncExternalStore`) | axe, e2e keyboard, e2e reduced motion (после импорта медиа) | ✅ |
| Деплой Supabase + Vercel, env, бэкап/восстановление, лимиты free tier | M | `docs/DEPLOYMENT.md`, `scripts/backup.sh`, `restore.sh` | restore drill | ✅ (деплой не выполнялся — нужны доступы) |
| Доступность из РФ, юридические требования | M | зафиксировано в DEPLOYMENT §5 | — | ⛔ требуют решения владельца |
