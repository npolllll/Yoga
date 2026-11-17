# BALANCE — руководство по контенту

Контент — образовательный материал о физической практике. Всё, что подготовлено редакцией или
автоматически, имеет статус **«нужна экспертная проверка»**, пока преподаватель реально не утвердит
материал в админке. Никогда не помечайте контент как проверенный преподавателем.

## Источник данных

- `content/catalog.json` — список асан (slug, категория, уровень, навыки, названия) и упражнений.
- `content/poses/<slug>.json` — карточка асаны.
- `content/exercises/<slug>.json` — подготовительное упражнение.
- `content/programs/<slug>.json` — программа уровня.
- `content/pages/<slug>.json` — страницы (home, about, faq, contact, privacy, terms).

Скрипт `pnpm db:seed` импортирует эти файлы в базу (черновики + публикация в dev/staging).
После импорта единственным источником правды становится админка.

## Формат файла асаны

```jsonc
{
  "slug": "bakasana",                 // как в catalog.json
  "category": "arm-balances",         // как в catalog.json
  "level": "beginner",                // beginner | intermediate | advanced | expert
  "skills": ["arm-strength", "core-control"], // ключи навыков (см. ниже)
  "sortWeight": 10,                   // редакционный порядок «Рекомендуемые» (меньше = выше)
  "motion": {                         // бриф для 3D-анимации (EN), не публикуется
    "view": "side",                   // side | front | three-quarter
    "contacts": ["hands", "feet"],    // опоры в фазе удержания: hands, forearms, head, shoulders, feet, knees, one-hand
    "entry": "Squat, hands down, knees to upper arms, shift forward, lift one foot then the other.",
    "hold": "Elbows bent ~90°, knees on upper arms above elbows, feet together lifted, gaze forward.",
    "exit": "Lower feet back to the mat and return to squat."
  },
  "doc": {
    "name": { "ru": "Бакасана", "en": "Crow Pose" },
    "subtitle": { "ru": "Поза ворона", "en": "Bakasana" },     // необязательно
    "sanskrit": "Bakasana",                                    // упрощённая латиница без диакритики
    "altNames": ["Какасана", "Kakasana", "ворона", "crow"],    // для поиска: синонимы, транслитерация
    "summary": { "ru": "1–2 предложения для карточки", "en": "..." },
    "about":   { "ru": "Что это за поза, тип, навыки, почему такой уровень (3–5 предложений)", "en": "..." },
    "prerequisites": [ { "ru": "...", "en": "..." } ],         // 2–4 пункта: что нужно уметь до асаны
    "safety":        [ { "ru": "...", "en": "..." } ],         // 2–4 пункта: предупреждения
    "steps": [                                                  // 4–6 шагов
      { "key": "<uuid v4>", "title": { "ru": "...", "en": "..." }, "body": { "ru": "...", "en": "..." }, "keyframe": 0 }
    ],
    "muscles": [ { "key": "wrists-forearms" } ],               // 3–6 ключей (см. ниже)
    "anatomy": { "ru": "Что работает (2–3 предложения)", "en": "..." },
    "prep": [ { "exerciseSlug": "crow-weight-shift", "title": { "ru": "...", "en": "..." }, "body": { "ru": "...", "en": "..." } } ],
    "mistakes": [ { "title": {...}, "why": {...}, "fix": {...} } ],   // 2–3 ошибки
    "easier": ["slug"], "harder": ["slug"], "related": ["slug"],   // только slug из catalog.json
    "video": {},                                               // НЕ заполнять: ссылки добавляются только после проверки
    "animationPhases": [ { "fromSec": 0, "toSec": 2, "label": { "ru": "...", "en": "..." } } ],
    "sources": []                                              // только реально существующие источники
  }
}
```

### Ключи

- Навыки: `arm-strength`, `flexibility`, `shoulder-mobility`, `hip-openness`, `core-control`,
  `wrist-strength`, `balance-coordination`, `inversion`, `hamstring-flexibility`, `twist`.
- Мышцы: `wrists-forearms`, `shoulders-deltoids`, `serratus`, `triceps`, `biceps`, `chest`, `upper-back`,
  `lats`, `core-abs`, `obliques`, `lower-back`, `hip-flexors`, `glutes`, `adductors`, `hamstrings`,
  `quadriceps`, `calves-ankles`, `neck`.
- Упражнения для `prep[].exerciseSlug` — см. `exercises` в `content/catalog.json`.
- `keyframe` в шаге — индекс одного из 5 ключевых кадров анимации (0–4), который иллюстрирует шаг.
- `animationPhases` — 3–5 фаз, вместе покрывающих 0–10 с, синхронно с брифом `motion`.

## Стиль и правила

- RU: обращение на «вы», повелительное наклонение («Поставьте ладони…»), короткие ясные фразы.
  EN: «you», imperative. Переводы смысловые, без канцелярита. Санскрит — упрощённая латиница.
- Каждая асана описывает **одну форму**; вариант указывается в `about` и, при необходимости, в `subtitle`.
- Техника: безопасный вход, точки опоры (кисти, локти, колени, стопы), направление взгляда, дыхание,
  выход из позы. Сначала подготовка, потом попытка.
- Безопасность: при боли — прекратить; при травмах, беременности, повышенном давлении, глаукоме
  (для инверсий) — обсудить нагрузку со специалистом; страховка/стена/блоки для инверсий.
- Нельзя: обещать лечение, «отсутствие травм», индивидуальную пригодность; подталкивать к сложным
  позам ради уровня; выдумывать источники, преподавателей, YouTube-ссылки, статистику.
- `sources`: только если источник реально описывает эту позу (например, B.K.S. Iyengar, *Light on Yoga*,
  1966 — для классических асан, которые в ней есть). Без URL, если нет полной уверенности. Иначе `[]`.
- Пустых строк в обязательных полях быть не должно: и `ru`, и `en` заполнены.
