# BALANCE — актуальные требования

Исходные документы сохранены без изменений в `docs/source/`:
- `docs/source/BALANCE_Project_Specification.md` — продуктовая спецификация v1.0;
- `docs/source/Balance.pdf` — визуальная концепция (переданный файл содержит 1 страницу);
- `docs/source/ui-mockup.jpg` — структура Homepage, Pose Library, Pose Detail.

Мастер-промпт v2.0 (сообщение владельца в сессии разработки) имеет приоритет над исходниками.
Порядок приоритета: мастер-промпт → спецификация → композиция JPG → стилистика PDF → собственные решения.

## Изменения относительно спецификации v1.0 (из мастер-промпта)
- Первый релиз — полный продукт (не MVP): аккаунты, избранное, статусы, программы, история практики, цели, админка.
- Каждая асана — собственная 10-секундная 3D-анимация (30 fps, 300 кадров, без звука), постер и 4–6 ключевых кадров.
- Собственная админка: роли Guest/Member/Reviewer/Editor/Owner; статусы Draft → Ready for Editorial Review → Needs Expert Review → Approved → Published; версии, предпросмотр RU/EN, снятие с публикации.
- Программы минимум для 4 уровней; шаги Lesson/Exercise/Pose с постоянным `stepKey` (UUID).
- My Practice: Overview, Favorites, In Progress, Learned, Programs Progress, Practice History, My Goals.
- Авторизация: email/password, подтверждение адреса, восстановление пароля, экспорт данных, удаление аккаунта.
- Инфраструктура: Supabase + Vercel, бюджет €0; учесть доступность из России.

Полный перечень требований и их покрытие — `docs/REQUIREMENTS_MATRIX.md`; решения — `docs/DECISIONS.md`.
