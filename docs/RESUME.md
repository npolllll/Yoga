# RESUME — следующая операция

1. Окружение: `pnpm env:up` (dockerd + Supabase); dev: `setsid nohup pnpm dev > /tmp/dev.log 2>&1 &`.
2. Идёт финальный рендер всех 44 асан (персонаж 1.2.0). Проверка: `cat pipeline/out/queue.json`,
   `tail pipeline/out/logs/render_all.log` (строка `ALL DONE` = цепочка завершена: позы → бренд → валидация).
   Порядок поз — `pipeline/out/render_order.txt`; очередь перечитывает файл после каждой позы, исправленные
   конфиги можно дописывать в конец. Если процесс не идёт (`ps aux | grep render_pose`), перезапустить —
   готовые позы и кадры с тем же хэшем пропускаются:
   `setsid nohup pipeline/render_all.sh @pipeline/out/render_order.txt > pipeline/out/logs/render_all.log 2>&1 < /dev/null &`
   Файла нет (он в `pipeline/out`, не в git) — восстановить: `ls pipeline/poses | sed 's/.json//' > pipeline/out/render_order.txt`.
3. НЕ менять `pipeline/balance3d/*.py` во время рендера: хэш включает код рига/персонажа, любая правка
   перерендерит все позы. Правка одного `pipeline/poses/<slug>.json` перерендерит только эту позу.
4. Покадровая проверка конфигов (без рендера): все 44 проходят (самая низкая точка ≥ −2,5 см, снап ≤ 3 см,
   дрейф опор ≤ 1 см). Инструмент — `pipeline/keysheet.py` (стоп-кадры ключей + метрики).
5. После `ALL DONE`: `/opt/pyenv/bin/python pipeline/validate_media.py --sheet` (уже в цепочке, лог
   `pipeline/out/logs/validate.log`), `pnpm db:seed`, `pnpm exec tsx scripts/content-status.ts`, просмотр
   контактного листа, `pnpm e2e`, Lighthouse, коммит `public/media` (позы + бренд), обновить QA_REPORT/PROGRESS.
   Изменения в `public/media/poses/bakasana` в рабочем дереве — устаревший рендер персонажа 1.1, будет перезаписан.
6. Открытые внешние вопросы — `docs/DECISIONS.md` (рецензент, юрисдикция, доступность из РФ, коммерческий статус).
