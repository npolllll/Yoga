import type { Field, Option } from "./fields";
import { MUSCLE_KEYS } from "@/lib/content/schema";

/* eslint-disable @typescript-eslint/no-explicit-any */
const L = (v: any) => (v?.ru || v?.en || "—") as string;
const empty = () => ({ ru: "", en: "" });

export interface SpecOptions {
  muscles: Option[];
  exerciseSlugs: Option[];
  poseSlugs: Option[];
  homeKeys: string[];
}

export function poseFields(o: SpecOptions): Field[] {
  return [
    { k: "name", t: "loc", label: "Название / Name" },
    { k: "subtitle", t: "loc", label: "Подзаголовок / Subtitle" },
    { k: "sanskrit", t: "text", label: "Sanskrit", hint: "Упрощённая латиница без диакритики" },
    { k: "altNames", t: "tags", label: "Альтернативные названия (поиск)" },
    { k: "summary", t: "loc", label: "Кратко (карточка)", multiline: true },
    { k: "about", t: "loc", label: "О позе", multiline: true },
    { k: "prerequisites", t: "locList", label: "Требования к подготовке" },
    { k: "safety", t: "locList", label: "Меры предосторожности" },
    {
      k: "steps",
      t: "list",
      label: "Шаги техники",
      keyed: true,
      summary: (v) => L(v.title),
      empty: () => ({ title: empty(), body: empty() }),
      item: [
        { k: "title", t: "loc", label: "Заголовок" },
        { k: "body", t: "loc", label: "Описание", multiline: true },
        { k: "keyframe", t: "number", label: "Ключевой кадр (0–4)", min: 0, max: 9 },
      ],
    },
    {
      k: "muscles",
      t: "list",
      label: "Мышцы",
      summary: (v) => o.muscles.find((m) => m.value === v.key)?.label ?? v.key,
      empty: () => ({ key: MUSCLE_KEYS[0] }),
      item: [
        { k: "key", t: "select", label: "Мышца", options: o.muscles, allowEmpty: false },
        { k: "note", t: "loc", label: "Пояснение" },
      ],
    },
    { k: "anatomy", t: "loc", label: "Что работает", multiline: true },
    {
      k: "prep",
      t: "list",
      label: "Подготовительные упражнения",
      summary: (v) => L(v.title),
      empty: () => ({ title: empty(), body: empty() }),
      item: [
        { k: "exerciseSlug", t: "select", label: "Упражнение из библиотеки", options: o.exerciseSlugs },
        { k: "title", t: "loc", label: "Название" },
        { k: "body", t: "loc", label: "Описание", multiline: true },
      ],
    },
    {
      k: "mistakes",
      t: "list",
      label: "Типичные ошибки",
      summary: (v) => L(v.title),
      empty: () => ({ title: empty(), why: empty(), fix: empty() }),
      item: [
        { k: "title", t: "loc", label: "Ошибка" },
        { k: "why", t: "loc", label: "Почему мешает", multiline: true },
        { k: "fix", t: "loc", label: "Как исправить", multiline: true },
      ],
    },
    { k: "easier", t: "multi", label: "Проще", options: o.poseSlugs },
    { k: "harder", t: "multi", label: "Сложнее", options: o.poseSlugs },
    { k: "related", t: "multi", label: "Связанные", options: o.poseSlugs },
    { k: "video", t: "video", label: "Видеоуроки (отдельно для RU и EN)" },
    {
      k: "animationPhases",
      t: "list",
      label: "Подписи фаз анимации",
      summary: (v) => `${v.fromSec}–${v.toSec}s · ${L(v.label)}`,
      empty: () => ({ fromSec: 0, toSec: 2, label: empty() }),
      item: [
        { k: "fromSec", t: "number", label: "С (сек)", min: 0, max: 10, step: 0.1 },
        { k: "toSec", t: "number", label: "По (сек)", min: 0, max: 10, step: 0.1 },
        { k: "label", t: "loc", label: "Подпись" },
      ],
    },
    {
      k: "sources",
      t: "list",
      label: "Источники",
      summary: (v) => v.title || "—",
      empty: () => ({ title: "" }),
      item: [
        { k: "title", t: "text", label: "Источник" },
        { k: "url", t: "text", label: "URL" },
        { k: "note", t: "text", label: "Примечание" },
      ],
    },
  ];
}

export function programFields(): Field[] {
  return [
    { k: "title", t: "loc", label: "Название" },
    { k: "summary", t: "loc", label: "Кратко", multiline: true },
    { k: "description", t: "loc", label: "Описание", multiline: true },
    { k: "audience", t: "loc", label: "Для кого", multiline: true },
    { k: "prerequisites", t: "locList", label: "Перед началом" },
    { k: "goals", t: "locList", label: "Цели" },
    { k: "safety", t: "locList", label: "Безопасность" },
  ];
}

export function exerciseFields(o: SpecOptions): Field[] {
  return [
    { k: "name", t: "loc", label: "Название" },
    { k: "summary", t: "loc", label: "Кратко", multiline: true },
    { k: "instructions", t: "locList", label: "Инструкция", multiline: true },
    { k: "safety", t: "locList", label: "Безопасность" },
    { k: "muscles", t: "multi", label: "Мышцы", options: o.muscles },
    {
      k: "sources",
      t: "list",
      label: "Источники",
      summary: (v) => v.title || "—",
      empty: () => ({ title: "" }),
      item: [
        { k: "title", t: "text", label: "Источник" },
        { k: "url", t: "text", label: "URL" },
        { k: "note", t: "text", label: "Примечание" },
      ],
    },
  ];
}

export function pageFields(o: SpecOptions, slug: string): Field[] {
  const fields: Field[] = [
    { k: "title", t: "loc", label: "Заголовок" },
    { k: "intro", t: "loc", label: "Вступление", multiline: true },
    { k: "updatedOn", t: "text", label: "Дата обновления (YYYY-MM-DD)" },
    {
      k: "sections",
      t: "list",
      label: "Разделы",
      summary: (v) => L(v.heading),
      empty: () => ({ heading: empty(), body: empty() }),
      item: [
        { k: "heading", t: "loc", label: "Заголовок" },
        { k: "body", t: "loc", label: "Текст", multiline: true },
      ],
    },
    {
      k: "items",
      t: "list",
      label: "Вопросы (FAQ)",
      summary: (v) => L(v.q),
      empty: () => ({ q: empty(), a: empty() }),
      item: [
        { k: "q", t: "loc", label: "Вопрос" },
        { k: "a", t: "loc", label: "Ответ", multiline: true },
      ],
    },
  ];
  if (slug === "home") {
    fields.push({ k: "blocks", t: "blocks", label: "Тексты главной (пусто = текст по умолчанию)", keys: o.homeKeys });
    fields.push({ k: "featured", t: "multi", label: "Популярные асаны на главной", options: o.poseSlugs });
  }
  if (slug === "contact") {
    fields.push({
      k: "contact",
      t: "group",
      label: "Контакты",
      fields: [
        { k: "email", t: "text", label: "Email" },
        {
          k: "socials",
          t: "list",
          label: "Соцсети",
          summary: (v) => v.label || "—",
          empty: () => ({ label: "", url: "" }),
          item: [
            { k: "label", t: "text", label: "Название" },
            { k: "url", t: "text", label: "URL" },
          ],
        },
      ],
    });
  }
  return fields;
}
