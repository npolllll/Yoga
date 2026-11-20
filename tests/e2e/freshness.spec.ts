import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login, SEED_PASSWORD } from "./helpers";

/**
 * Publishing must be visible on the FIRST anonymous request afterwards — not "after a refresh".
 * Covers a dynamic route (pose page), the static library, a program and its step navigation, and a static page.
 * Most meaningful against a clean production build (`next build && next start`), where pages are prerendered.
 */
const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
const docId = async (type: string, slug: string) =>
  (await anon().from("publications").select("document_id").eq("type", type).eq("slug", slug).single()).data!.document_id as string;
const editor = (page: Page) => page.locator('[data-testid="doc-editor"]:visible');

async function publishEdit(page: Page, id: string, change: () => Promise<void>) {
  await page.goto(`/ru/admin/edit/${id}`);
  await expect(editor(page)).toBeVisible();
  await change();
  await page.locator('[data-testid="save-draft"]:visible').click();
  await expect(page.locator('[data-testid="save-draft"]:visible')).toBeDisabled();
  await page.locator('[data-testid="publish"]:visible').click();
  await expect(page.locator('[data-testid="publish-status"]:visible')).toHaveText("Опубликовано");
}

test.describe("publication freshness", () => {
  test.describe.configure({ mode: "serial" });

  test("pose name: pose page and library show the change on the first request", async ({ page, request }) => {
    const id = await docId("pose", "lolasana");
    const tag = `F${Date.now().toString(36)}`;
    const name = () => editor(page).locator('[data-field="name"] input[lang="ru"]');
    // Visitors already have these pages cached.
    for (const p of ["/ru/poses/lolasana", "/ru/poses"]) expect((await request.get(p)).ok()).toBe(true);
    await login(page, "editor@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
    let original = "";
    await publishEdit(page, id, async () => {
      original = await name().inputValue();
      await name().fill(`${original} ${tag}`);
    });
    try {
      expect(await (await request.get("/ru/poses/lolasana")).text()).toContain(tag);
      expect(await (await request.get("/ru/poses")).text()).toContain(tag);
    } finally {
      await publishEdit(page, id, () => name().fill(original));
    }
    expect(await (await request.get("/ru/poses/lolasana")).text()).not.toContain(tag);
  });

  test("program reorder: program page and step navigation change on the first request", async ({ page, request }) => {
    const id = await docId("program", "beginner");
    const keys = async () => [...(await (await request.get("/ru/programs/beginner")).text()).matchAll(/steps\/([0-9a-f-]{36})/g)].map((m) => m[1]);
    const before = (await keys())[0];
    const second = (await keys()).find((k) => k !== before)!;
    for (const k of [before, second]) expect((await request.get(`/ru/programs/beginner/steps/${k}`)).ok()).toBe(true);
    await login(page, "editor@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
    const moveSecondUp = () => editor(page).locator('[data-testid="program-steps-editor"] [data-step-key]').nth(1).getByRole("button", { name: "Выше", exact: true }).click();
    await publishEdit(page, id, moveSecondUp);
    try {
      expect((await keys())[0]).toBe(second);
      expect(await (await request.get(`/ru/programs/beginner/steps/${second}`)).text()).not.toContain('data-testid="step-prev"');
      expect(await (await request.get(`/ru/programs/beginner/steps/${before}`)).text()).toContain('data-testid="step-prev"');
    } finally {
      await publishEdit(page, id, moveSecondUp);
    }
    expect((await keys())[0]).toBe(before);
  });

  test("static page edit is visible on the first request", async ({ page, request }) => {
    const id = await docId("page", "about");
    const tag = `S${Date.now().toString(36)}`;
    const title = () => editor(page).locator('[data-field="title"] input[lang="ru"]');
    expect((await request.get("/ru/about")).ok()).toBe(true);
    await login(page, "editor@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
    let original = "";
    await publishEdit(page, id, async () => {
      original = await title().inputValue();
      await title().fill(`${original} ${tag}`);
    });
    try {
      expect(await (await request.get("/ru/about")).text()).toContain(tag);
    } finally {
      await publishEdit(page, id, () => title().fill(original));
    }
  });

  test("unknown content URLs answer 404 with noindex", async ({ request }) => {
    for (const url of ["/ru/poses/no-such-pose", "/en/programs/no-such-program", "/ru/programs/beginner/steps/00000000-0000-4000-8000-000000000000", "/ru/no/such/page"]) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(404);
      expect(await res.text(), url).toContain('content="noindex');
    }
  });
});
