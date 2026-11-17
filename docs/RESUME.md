# RESUME — следующая операция

1. Окружение: `pnpm env:up` (dockerd + Supabase); dev: `setsid nohup pnpm dev > /tmp/dev.log 2>&1 &`.
2. Проверить рендер: `cat pipeline/out/queue.json`, `tail pipeline/out/logs/render_all.log` (ALL DONE = цепочка завершена).
   Если процесс не идёт — перезапустить (продолжит с готовых кадров): `setsid nohup pipeline/render_all.sh [slug,slug] > pipeline/out/logs/render_all.log 2>&1 &`.
3. Конфигурации движения: `ls pipeline/poses | wc -l` должно быть 44. Недостающие — по `pipeline/README.md`
   (проверка: `EGL_PLATFORM=surfaceless blender -b -t 2 --python pipeline/keysheet.py -- --out /tmp/ks <slug>`).
4. После рендера всех асан: `/opt/pyenv/bin/python pipeline/validate_media.py --sheet`, `pnpm db:seed`,
   `pnpm exec tsx scripts/content-status.ts`, `pnpm e2e`, коммит медиа (`public/media`).
5. Открытые внешние вопросы — `docs/DECISIONS.md` (рецензент, юрисдикция, доступность из РФ, коммерческий статус).
