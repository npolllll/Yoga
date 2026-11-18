import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login, ready, SEED_PASSWORD, unique } from "./helpers";

/**
 * Extended scenarios: auth error paths, the review workflow in the UI, publication lifecycle and cache
 * invalidation, version restore, settings, roles, SEO, reduced motion, step navigation, profile, links.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;
const admin = () => createClient(URL_, SECRET, { auth: { persistSession: false } });
const anon = () => createClient(URL_, ANON, { auth: { persistSession: false } });

const vis = (page: Page, id: string) => page.locator(`[data-testid="${id}"]:visible`);

async function poseDocId(slug: string): Promise<string> {
  const { data } = await anon().from("publications").select("document_id").eq("type", "pose").eq("slug", slug).single();
  return data!.document_id as string;
}

/** Opens the editor of a published pose and duplicates it; returns the copy's id and slug. */
async function duplicatePose(page: Page, slug: string): Promise<{ id: string; slug: string }> {
  await page.goto(`/ru/admin/edit/${await poseDocId(slug)}`);
  await expect(vis(page, "doc-editor")).toBeVisible();
  await vis(page, "duplicate-document").click();
  await expect(page).not.toHaveURL(new RegExp(await poseDocId(slug)));
  await expect(vis(page, "doc-editor")).toBeVisible();
  const id = page.url().split("/").pop()!;
  const { data } = await admin().from("documents").select("slug").eq("id", id).single();
  return { id, slug: data!.slug as string };
}

async function deleteAsOwner(browser: Browser, id: string) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await login(p, "owner@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
  await p.goto(`/ru/admin/edit/${id}`);
  p.once("dialog", (d) => d.accept());
  await vis(p, "delete-document").click();
  await expect(p).toHaveURL(/\/ru\/admin$/);
  await ctx.close();
}

test.describe("extended scenarios", () => {
  test.afterAll(async () => {
    // Safety net: remove copies left by a failed run (the normal path deletes them through the UI).
    await admin().from("documents").delete().like("slug", "bakasana-copy%");
  });

  test("auth errors: wrong password and a weak password are rejected with clear messages", async ({ page }) => {
    await page.goto("/ru/login");
    const form = vis(page, "login-form");
    await form.locator('input[name="email"]').fill("member@balance.local");
    await form.locator('input[name="password"]').fill("Wrong-pass-2026");
    await form.locator('button[type="submit"]').click();
    await expect(form.getByRole("alert")).toContainText("Неверный email или пароль");
    await expect(page).toHaveURL(/\/ru\/login/);

    await page.goto("/ru/sign-up");
    await ready(page, false);
    const su = vis(page, "signup-form");
    await su.locator('input[name="email"]').fill(unique("weak"));
    await su.locator('input[name="password"]').fill("onlyletters");
    await su.locator('input[name="consent"]').check();
    await su.locator('button[type="submit"]').click();
    await expect(su.getByRole("alert")).toContainText("Пароль слишком простой");
  });

  test("review workflow: editor submits, only a reviewer approves, an edit resets the approval", async ({ page, browser }) => {
    await login(page, "editor@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
    const copy = await duplicatePose(page, "bakasana");
    await expect(vis(page, "review-status")).toHaveText("Черновик");
    await vis(page, "submit-editorial").click();
    await expect(vis(page, "review-status")).toHaveText("Готово к редакторской проверке");
    await vis(page, "submit-expert").click();
    await expect(vis(page, "review-status")).toHaveText("Нужна экспертная проверка");
    await expect(page.locator('[data-testid="approve"]')).toHaveCount(0); // editors cannot approve

    // The server rejects an approval by an editor even if the button were forged.
    const editorApi = anon();
    await editorApi.auth.signInWithPassword({ email: "editor@balance.local", password: SEED_PASSWORD });
    const forged = await editorApi.rpc("set_review_status", { p_document_id: copy.id, p_status: "approved", p_note: null });
    expect(forged.error).not.toBeNull();

    const ctx = await browser.newContext();
    const reviewer = await ctx.newPage();
    await login(reviewer, "reviewer@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
    await reviewer.goto(`/ru/admin/edit/${copy.id}`);
    await vis(reviewer, "approve").click();
    await expect(vis(reviewer, "review-status")).toHaveText("Утверждено");
    await expect(reviewer.locator('[data-testid="save-draft"]')).toHaveCount(0); // reviewers do not edit
    await ctx.close();

    // Editing approved content sends it back to draft.
    await page.reload();
    await expect(vis(page, "review-status")).toHaveText("Утверждено");
    const name = vis(page, "doc-editor").locator('[data-field="name"] input[lang]');
    await name.nth(0).fill("Бакасана (правка)");
    await vis(page, "save-draft").click();
    await expect(vis(page, "save-draft")).toBeDisabled();
    await page.reload();
    await expect(vis(page, "review-status")).toHaveText("Черновик");

    await deleteAsOwner(browser, copy.id);
  });

  test("publication lifecycle: publish shows the pose to guests, a restored version, unpublish hides it", async ({ page, browser }) => {
    await login(page, "editor@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
    const copy = await duplicatePose(page, "bakasana");
    const name = vis(page, "doc-editor").locator('[data-field="name"] input[lang]');
    const original = await name.nth(0).inputValue();
    await vis(page, "publish").click();
    await expect(vis(page, "publish-status")).toHaveText("Опубликовано");

    const guest = await browser.newContext();
    const g = await guest.newPage();
    let res = await g.goto(`/ru/poses/${copy.slug}`);
    expect(res?.status()).toBe(200);
    await expect(g.getByRole("heading", { level: 1 })).toHaveText(original);

    // Edit → save: the public page keeps the published snapshot; the editor sees "has changes".
    await name.nth(0).fill("Черновая правка");
    await vis(page, "save-draft").click();
    await expect(vis(page, "publish-status")).toHaveText("Опубликовано · есть изменения");
    await g.reload();
    await expect(g.getByRole("heading", { level: 1 })).toHaveText(original);

    // Restore version 1 (the publication): the open editor picks up the restored draft without a reload.
    await vis(page, "restore-1").click();
    await expect(name.nth(0)).toHaveValue(original);
    await expect(vis(page, "publish-status")).toHaveText("Опубликовано · есть изменения");

    // Unpublish → guests get the localized "not found" page, never indexable. With Cache Components the
    // prerendered shell can start the response (status 200) before the page calls notFound(); Next.js then
    // adds <meta name="robots" content="noindex"> (see docs/DECISIONS.md). A real 404 is accepted too.
    await vis(page, "unpublish").click();
    await expect(vis(page, "publish-status")).toHaveText("Не опубликовано");
    res = await g.goto(`/ru/poses/${copy.slug}`);
    expect([200, 404]).toContain(res?.status());
    await expect(g.getByRole("heading", { level: 1 })).toHaveText("Страница не найдена");
    await expect(g.locator('head meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    await guest.close();

    await deleteAsOwner(browser, copy.id);
  });

  test("settings: a custom label for the expert level appears on public pages", async ({ page, browser }) => {
    await login(page, "owner@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
    await page.goto("/ru/admin/settings");
    await ready(page); // hydrated: filling controlled inputs before hydration would be reset by React
    const form = vis(page, "settings-form");
    const expert = form.locator("div", { has: page.locator("span.font-mono", { hasText: /^expert \(/ }) }).last().locator("input[lang]");
    const save = form.getByRole("button", { name: "Сохранить настройки" });
    // Wait for the server action to finish before reading public pages: a page request issued while the
    // save is still running can start a background regeneration with the old settings (see DECISIONS).
    const saveAndWait = async () => {
      const done = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/settings"));
      await save.click();
      expect((await done).ok()).toBe(true);
    };
    const guest = await browser.newContext();
    const g = await guest.newPage();
    // Count of the label on a public page, re-fetched on every poll (the save invalidates the cache tag).
    const shown = async (path: string, text: string) => {
      await g.goto(path);
      return g.locator('[data-testid="pose-page"]:visible').getByText(text).count();
    };
    try {
      await expert.nth(0).fill("Про-уровень");
      await expert.nth(1).fill("Pro level");
      await saveAndWait();
      await expect.poll(() => shown("/ru/poses/vrschikasana", "Про-уровень")).toBeGreaterThan(0);
      await expect.poll(() => shown("/en/poses/vrschikasana", "Pro level")).toBeGreaterThan(0);
    } finally {
      await expert.nth(0).fill("");
      await expert.nth(1).fill("");
      await saveAndWait();
    }
    await expect.poll(() => shown("/ru/poses/vrschikasana", "Про-уровень")).toBe(0);
    await expect.poll(() => shown("/ru/poses/vrschikasana", "Эксперт")).toBeGreaterThan(0);
    await guest.close();
    // Owner-only escape hatch for stale public pages.
    await vis(page, "cache-refresh").getByRole("button", { name: "Обновить публичный кэш" }).click();
    await expect(page.getByText("Публичный кэш обновлён").first()).toBeVisible();
  });

  test("roles: owner grants and revokes a role; an editor cannot open user management", async ({ page, browser }) => {
    const email = unique("role");
    const { data: created } = await admin().auth.admin.createUser({ email, password: "Role-pass-2026", email_confirm: true });
    try {
      const ctx = await browser.newContext();
      const ed = await ctx.newPage();
      await login(ed, "editor@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
      await ed.goto("/ru/admin/users");
      await expect(vis(ed, "admin-no-access")).toBeVisible();
      await ctx.close();

      await login(page, "owner@balance.local", SEED_PASSWORD, "ru", "/ru/admin");
      await page.goto("/ru/admin/users");
      await expect(vis(page, "admin-users")).toBeVisible();
      const formRow = vis(page, "admin-users").locator("div", { has: page.locator('input[type="email"]') }).last();
      await formRow.locator('input[type="email"]').fill(email);
      await formRow.locator("select").selectOption("reviewer");
      await formRow.getByRole("button").first().click();
      await expect(vis(page, "admin-users")).toContainText(email);
      const roles = async () => (await admin().from("user_roles").select("role").eq("user_id", created.user!.id)).data!.map((r) => r.role);
      await expect.poll(roles).toEqual(["reviewer"]);
      await formRow.getByRole("button").nth(1).click();
      await expect.poll(roles).toEqual([]);
    } finally {
      await admin().auth.admin.deleteUser(created.user!.id);
    }
  });

  test("SEO: hreflang alternates on pages, sitemap with both languages, robots rules", async ({ page, request }) => {
    await page.goto("/ru/poses/bakasana");
    await expect(page.locator('head link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/poses\/bakasana$/);
    await expect(page.locator('head link[rel="alternate"][hreflang="ru"]')).toHaveAttribute("href", /\/ru\/poses\/bakasana$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    const sm = await request.get("/sitemap.xml");
    expect(sm.status()).toBe(200);
    const xml = await sm.text();
    expect(xml).toContain("/en/poses/bakasana");
    expect(xml).toContain("/ru/programs/beginner");
    expect(xml).toMatch(/hreflang="en"/);
    expect(xml).not.toContain("/admin");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /ru/admin");
    expect(robots).toContain("Disallow: /ru/my-practice");
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
  });

  test("reduced motion: the animation plays once, never loops, and the player says so", async ({ browser }) => {
    // Any pose whose rendered animation is imported (pnpm db:seed after the 3D pipeline).
    const { data: media } = await anon().from("media_assets").select("document_id").eq("kind", "animation").limit(1);
    test.skip(!media?.length, "no rendered animation imported yet");
    const { data: pub } = await anon().from("publications").select("slug").eq("document_id", media![0].document_id).single();
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(`/ru/poses/${pub!.slug}`);
    await expect(page.getByText("Включено уменьшение движения").first()).toBeVisible();
    await vis(page, "play-animation").click();
    const video = vis(page, "pose-animation-video");
    await expect(video).toBeVisible();
    await expect(video).toHaveJSProperty("loop", false);
    // Jump close to the end and check, inside the "ended" event, that the player did not start it again.
    const pausedAtEnd = await video.evaluate(async (v: HTMLVideoElement) => {
      if (v.readyState < 1) await new Promise((r) => v.addEventListener("loadedmetadata", r, { once: true }));
      const ended = new Promise<boolean>((r) => v.addEventListener("ended", () => r(v.paused), { once: true }));
      v.currentTime = Math.max(0, v.duration - 0.3);
      if (v.paused) await v.play().catch(() => {});
      return ended;
    });
    expect(pausedAtEnd).toBe(true);
    await ctx.close();
  });

  test("step pages: next/previous navigation walks through the whole program", async ({ page }) => {
    const { data } = await anon().from("publications").select("doc").eq("type", "program").eq("slug", "beginner").single();
    const keys = (data!.doc as { steps: { key: string }[] }).steps.map((s) => s.key);
    // Pages prerendered at build time may serve the previous version once after the first publish (route
    // cache); request each step page until it reflects the published order before walking through it.
    for (const k of keys) {
      await expect.poll(async () => (await page.request.get(`/ru/programs/beginner/steps/${k}`)).ok()).toBe(true);
    }
    await expect
      .poll(async () => {
        await page.goto(`/ru/programs/beginner/steps/${keys[0]}`);
        return page.locator('[data-testid="step-prev"]:visible').count();
      })
      .toBe(0);
    await expect(page.locator('[data-testid="step-prev"]:visible')).toHaveCount(0);
    for (let i = 1; i < keys.length; i++) {
      await vis(page, "step-next").click();
      await expect(page).toHaveURL(new RegExp(`/steps/${keys[i]}$`));
      await expect(vis(page, "step-page")).toBeVisible();
    }
    await expect(page.locator('[data-testid="step-next"]:visible')).toHaveCount(0);
    await vis(page, "step-prev").click();
    await expect(page).toHaveURL(new RegExp(`/steps/${keys[keys.length - 2]}$`));
  });

  test("profile: display name and preferred language persist", async ({ page }) => {
    const email = unique("profile");
    const password = "Profile-pass-2026";
    const { data: created } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
    try {
      await login(page, email, password, "ru", "/ru/account");
      await expect(page).toHaveURL(/\/ru\/account/);
      await ready(page);
      await vis(page, "profile-name").fill("Тестовое имя");
      const form = page.locator("form", { has: page.locator('[data-testid="profile-name"]:visible') });
      await form.locator("select").selectOption("en");
      await form.getByRole("button", { name: "Сохранить профиль" }).click();
      await expect
        .poll(async () => (await admin().from("profiles").select("display_name, locale").eq("id", created.user!.id).single()).data)
        .toEqual({ display_name: "Тестовое имя", locale: "en" });
      await page.reload();
      await expect(vis(page, "profile-name")).toHaveValue("Тестовое имя");
    } finally {
      await admin().auth.admin.deleteUser(created.user!.id);
    }
  });

  test("no dead internal links on key pages (RU and EN)", async ({ page, request }) => {
    test.setTimeout(240_000);
    const hrefs = new Set<string>();
    for (const path of ["/ru", "/en", "/ru/poses/bakasana", "/en/programs/beginner", "/ru/about", "/en/faq"]) {
      await page.goto(path);
      const found = await page.locator("a[href^='/']:visible").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!));
      for (const h of found) hrefs.add(h.split("#")[0]);
    }
    expect(hrefs.size).toBeGreaterThan(20);
    const broken: string[] = [];
    for (const h of hrefs) {
      if (!h) continue;
      const r = await request.get(h, { maxRedirects: 5 });
      if (r.status() >= 400) broken.push(`${h} → ${r.status()}`);
    }
    expect(broken).toEqual([]);
  });
});
