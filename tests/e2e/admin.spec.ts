import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login, ready, SEED_PASSWORD } from "./helpers";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;

test.describe("administration", () => {
  test.describe.configure({ mode: "serial" });

  test("members cannot open the admin panel", async ({ page }) => {
    await login(page, "member@balance.local", SEED_PASSWORD);
    await page.goto("/ru/admin");
    await expect(page.locator('[data-testid=\"admin-no-access\"]:visible')).toBeVisible();
  });

  test("owner creates a draft, edits RU/EN, previews both languages, publishes, then deletes it", async ({ page }) => {
    await login(page, "owner@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
    await expect(page.locator('[data-testid=\"admin-dashboard\"]:visible')).toBeVisible();
    await page.goto("/ru/admin/list/page");
    const slug = `e2e-${Date.now().toString(36)}`;
    await page.locator('[data-testid=\"create-slug\"]:visible').fill(slug);
    await page.locator('[data-testid=\"create-document\"]:visible').click();
    await expect(page.locator('[data-testid=\"doc-editor\"]:visible')).toBeVisible();
    // required RU/EN title missing → publish disabled
    await expect(page.locator('[data-testid=\"publish\"]:visible')).toBeDisabled();
    const title = page.locator('[data-testid=\"doc-editor\"]:visible').locator("fieldset").first().locator("input[lang]");
    await title.nth(0).fill("Тестовая страница");
    await title.nth(1).fill("Test page");
    await page.locator('[data-testid=\"save-draft\"]:visible').click();
    await expect(page.locator('[data-testid=\"save-draft\"]:visible')).toBeDisabled();
    const id = page.url().split("/").pop()!;
    // preview both languages (draft, not public)
    await page.goto(`/en/admin/preview/${id}`);
    await expect(page.locator('[data-testid=\"preview-banner\"]:visible')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Test page");
    await page.goto(`/ru/admin/preview/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Тестовая страница");
    await page.goto(`/ru/admin/preview/${id}/both`);
    await expect(page.locator("iframe")).toHaveCount(2);
    // publish
    await page.goto(`/ru/admin/edit/${id}`);
    await page.locator('[data-testid=\"publish\"]:visible').click();
    await expect(page.locator('[data-testid=\"publish-status\"]:visible')).toHaveText("Опубликовано");
    // cleanup (owner only)
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(page).toHaveURL(/\/ru\/admin$/);
  });

  test("reordering program steps keeps member progress", async ({ page, browser }) => {
    // Member completes the 2nd step of the beginner program (through the real API with RLS).
    const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
    const email = `reorder-${Date.now().toString(36)}@e2e.balance.local`;
    const password = "Reorder-pass-2026";
    await admin.auth.admin.createUser({ email, password, email_confirm: true });
    const member = createClient(URL_, ANON, { auth: { persistSession: false } });
    await member.auth.signInWithPassword({ email, password });
    const { data: pub } = await member.from("publications").select("document_id, doc").eq("type", "program").eq("slug", "beginner").single();
    const steps = (pub!.doc as { steps: { key: string }[] }).steps;
    const target = steps[1].key;
    const restoreOrder = () => restoreOrderFor(page, pub!.document_id, target);
    const { data: userData } = await member.auth.getUser();
    expect((await member.from("step_completions").insert({ user_id: userData.user!.id, program_id: pub!.document_id, step_key: target })).error).toBeNull();

    // Editor moves that step to the top and publishes.
    await login(page, "editor@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
    await page.goto(`/ru/admin/edit/${pub!.document_id}`);
    const row = page.locator('[data-testid=\"program-steps-editor\"]:visible').locator(`[data-step-key="${target}"]`);
    await expect(row).toContainText(/✓ [1-9]/); // editors see how many members completed the step
    await row.getByRole("button", { name: "Выше", exact: true }).click();
    await page.locator('[data-testid=\"save-draft\"]:visible').click();
    await expect(page.locator('[data-testid=\"save-draft\"]:visible')).toBeDisabled();
    await page.locator('[data-testid=\"publish\"]:visible').click();
    await expect(page.locator('[data-testid=\"publish-status\"]:visible')).toHaveText("Опубликовано");

    const { data: after } = await member.from("publications").select("doc").eq("type", "program").eq("slug", "beginner").single();
    const keys = (after!.doc as { steps: { key: string }[] }).steps.map((s) => s.key);
    expect(keys[0]).toBe(target);
    expect(new Set(keys)).toEqual(new Set(steps.map((s) => s.key)));

    try {
      // The member still sees 1 completed step, now at position 1. A page prerendered at build time can serve
      // the previous version once after the first invalidation (route cache), so poll with a reload.
      const ctx = await browser.newContext();
      const p2 = await ctx.newPage();
      await login(p2, email, password);
      await expect
        .poll(async () => {
          await p2.goto("/ru/programs/beginner");
          await ready(p2);
          return p2.locator('[data-testid="program-steps"]:visible').locator("li").first().getAttribute("data-done");
        })
        .toBe("true");
      await expect(p2.locator('[data-testid=\"program-progress\"]:visible')).toHaveAttribute("data-completed", "1");
      await ctx.close();
    } finally {
      // Always restore the original order for other tests.
      await restoreOrder();
    }
  });

  async function restoreOrderFor(page: import("@playwright/test").Page, documentId: string, target: string) {
    await page.goto(`/ru/admin/edit/${documentId}`);
    const rows = page.locator('[data-testid=\"program-steps-editor\"]:visible').locator("[data-step-key]");
    if ((await rows.first().getAttribute("data-step-key")) === target) {
      await page.locator('[data-testid=\"program-steps-editor\"]:visible').locator(`[data-step-key="${target}"]`).getByRole("button", { name: "Ниже", exact: true }).click();
      await page.locator('[data-testid=\"save-draft\"]:visible').click();
      await expect(page.locator('[data-testid=\"save-draft\"]:visible')).toBeDisabled();
    }
    await page.locator('[data-testid=\"publish\"]:visible').click();
    await expect(page.locator('[data-testid=\"publish-status\"]:visible')).toHaveText("Опубликовано");
  }

  test("media upload into Supabase Storage with alt texts", async ({ page }) => {
    await login(page, "editor@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
    await page.goto("/ru/admin/media");
    // 1x1 PNG
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
    const form = page.locator('[data-testid=\"media-upload\"]:visible');
    await form.locator('input[type="file"]').setInputFiles({ name: "e2e.png", mimeType: "image/png", buffer: png });
    await form.locator('input[name="altRu"]').fill("Тест");
    await form.locator('input[name="altEn"]').fill("Test");
    await form.getByRole("button", { name: "Загрузить файл" }).click();
    await expect(page.locator('[data-testid=\"admin-media\"]:visible').locator("img").first()).toBeVisible();
  });
});
