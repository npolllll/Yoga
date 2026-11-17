/**
 * Generates docs/CONTENT_STATUS.md and docs/ANIMATION_STATUS.md from content/, pipeline/poses and
 * public/media manifests.   pnpm exec tsx scripts/content-status.ts
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const catalog = JSON.parse(readFileSync(join(ROOT, "content/catalog.json"), "utf8")) as { poses: { slug: string; level: string; category: string; name: { ru: string } }[] };
let report: Record<string, { ok: boolean; problems: string[] }> = {};
const reportPath = join(ROOT, "pipeline/out/media-report.json");
if (existsSync(reportPath)) report = JSON.parse(readFileSync(reportPath, "utf8"));

const rows: string[] = [];
const anim: string[] = [];
let withText = 0, withAnim = 0, withConfig = 0, autoOk = 0, videoRu = 0, videoEn = 0;
for (const p of catalog.poses) {
  const file = join(ROOT, "content/poses", `${p.slug}.json`);
  const doc = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).doc : null;
  const cfg = existsSync(join(ROOT, "pipeline/poses", `${p.slug}.json`));
  const manifestPath = join(ROOT, "public/media/poses", p.slug, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  const r = report[p.slug];
  if (doc) withText++;
  if (cfg) withConfig++;
  if (manifest) withAnim++;
  if (r?.ok) autoOk++;
  if (doc?.video?.ru) videoRu++;
  if (doc?.video?.en) videoEn++;
  rows.push(`| ${p.slug} | ${p.name.ru} | ${p.level} | ${doc ? "✓" : "—"} | ${manifest ? "✓" : cfg ? "конфиг" : "—"} | ${doc?.video?.ru ? "✓" : "—"} | ${doc?.video?.en ? "✓" : "—"} | нет |`);
  const m = manifest?.motion ?? {};
  anim.push(`| ${p.slug} | ${cfg ? "✓" : "—"} | ${manifest ? manifest.generatedFrom?.characterVersion ?? "?" : "—"} | ${manifest ? `${m.maxContactDriftCm ?? "?"} / ${m.minBodyZCm ?? "?"} / ${m.comMarginCm ?? "?"}` : "—"} | ${r ? (r.ok ? "✓" : `✗ ${r.problems.join("; ")}`) : "—"} | нет |`);
}
const date = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(ROOT, "docs/CONTENT_STATUS.md"),
  `# Готовность контента (${date}, генерируется \`pnpm exec tsx scripts/content-status.ts\`)

Экспертная проверка: **ни один материал не утверждён преподавателем** (рецензент не назначен). На сайте такие страницы
показывают предупреждение «ещё не проверено преподавателем».

Итого: тексты RU/EN ${withText}/${catalog.poses.length} · анимации ${withAnim}/${catalog.poses.length} · видео RU ${videoRu} · видео EN ${videoEn}.
Видеоуроки не добавлены намеренно: ссылки вносятся только после проверки доступности, встраивания и соответствия варианту позы.
Программы: 4 (Beginner, Intermediate, Advanced, Expert) · упражнения: ${readdirSync(join(ROOT, "content/exercises")).length} · страницы: ${readdirSync(join(ROOT, "content/pages")).length}.

| Асана | Название | Уровень | Текст RU/EN | Анимация | Видео RU | Видео EN | Проверено преподавателем |
|---|---|---|---|---|---|---|---|
${rows.join("\n")}
`,
);
writeFileSync(
  join(ROOT, "docs/ANIMATION_STATUS.md"),
  `# Готовность 3D-анимаций (${date})

Мастер-персонаж: \`pipeline/balance3d/character.py\` (версия в манифестах). Конфигурации движения: ${withConfig}/${catalog.poses.length}.
Финальные ролики (10 с, 30 fps, 300 кадров, без звука): ${withAnim}/${catalog.poses.length}; автоматические проверки пройдены: ${autoOk}.
Метрики: дрейф опор в удержании (см) / самая низкая точка тела (см) / запас центра масс над опорой (см).
Экспертная (анатомическая) проверка анимаций **не проводилась**. Известные отклонения для проверки преподавателем — `docs/ANIMATION_REVIEW_NOTES.md`.

| Асана | Конфиг | Персонаж | Метрики | Автопроверка | Эксперт |
|---|---|---|---|---|---|
${anim.join("\n")}
`,
);
console.log({ withText, withConfig, withAnim, autoOk });
