import { expect, test } from "@playwright/test";
import { login, mailLink, memberState, ready, unique } from "./helpers";

const PASSWORD = "Strong-pass-2026";

test.describe("accounts and personal practice", () => {
  test.describe.configure({ mode: "serial" });
  const email = unique("member");

  test("sign up with email confirmation, then the guest intent completes after sign-in", async ({ page }) => {
    // Guest tries to save a pose → auth prompt
    await page.goto("/ru/poses/bakasana");
    await ready(page, false);
    await page.locator('[data-testid=\"favorite-button\"]:visible').first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("link", { name: "Создать аккаунт" }).click();
    await expect(page).toHaveURL(/\/ru\/sign-up\?next=/);
    const form = page.locator('[data-testid=\"signup-form\"]:visible');
    await form.locator('input[name="displayName"]').fill("E2E");
    await form.locator('input[name="email"]').fill(email);
    await form.locator('input[name="password"]').fill(PASSWORD);
    await form.locator('input[name="consent"]').check();
    await form.locator('button[type="submit"]').click();
    await expect(page.getByText("Проверьте почту")).toBeVisible();
    // Confirmation link from the email → back to the pose page with the intent → favorite saved
    await page.goto(await mailLink(email));
    await expect(page).toHaveURL(/\/ru\/poses\/bakasana/);
    await expect.poll(async () => (await memberState(page)).favorites.length).toBe(1);
    await expect(page.locator('[data-testid=\"favorite-button\"]:visible').first()).toHaveAttribute("aria-pressed", "true");
  });

  test("status and step completion are independent, synced across sessions and languages", async ({ page, browser }) => {
    await login(page, email, PASSWORD);
    await expect(page).toHaveURL(/my-practice/);
    // learned status on the pose page
    await page.goto("/ru/poses/bakasana");
    await ready(page);
    await page.locator('[data-testid=\"status-control\"]:visible').first().locator('[data-status="learned"]').click();
    await expect.poll(async () => Object.values((await memberState(page)).progress).map((p: unknown) => (p as { status: string }).status)).toEqual(["learned"]);
    // complete a program step
    await page.goto("/ru/programs/beginner");
    const firstStep = page.locator('[data-testid=\"program-steps\"]:visible').locator("li").first();
    await firstStep.locator("a").click();
    await ready(page);
    await page.locator('[data-testid=\"step-complete\"]:visible').click();
    await expect(page.locator('[data-testid=\"step-complete\"]:visible')).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => Object.values((await memberState(page)).completions).flat().length).toBe(1);
    const s = await memberState(page);
    // learned status untouched by step completion, and vice versa
    expect(Object.keys(s.progress)).toHaveLength(1);
    // another session (new context), other language → same state
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await login(p2, email, PASSWORD, "en");
    await p2.goto("/en/programs/beginner");
    await expect(p2.locator('[data-testid=\"program-progress\"]:visible')).toHaveAttribute("data-completed", "1");
    await p2.goto("/en/my-practice?tab=learned");
    await expect(p2.locator('a[href="/en/poses/bakasana"]').first()).toBeVisible();
    await ctx.close();
  });

  test("practice log and goals", async ({ page }) => {
    await login(page, email, PASSWORD);
    await page.goto("/ru/my-practice?tab=history");
    await ready(page);
    const f = page.locator('[data-testid=\"practice-form\"]:visible');
    await f.locator('input[type="number"]').fill("20");
    await f.locator("textarea").fill("Первая практика");
    await f.locator('button[type="submit"]').click();
    await expect(page.locator('[data-testid=\"practice-list\"]:visible')).toContainText("Первая практика");
    await page.goto("/ru/my-practice?tab=goals");
    await ready(page);
    const g = page.locator('[data-testid=\"goal-form\"]:visible');
    await g.locator("input").first().fill("Освоить ворону");
    await g.locator('button[type="submit"]').click();
    await expect(page.locator('[data-testid=\"goal-list\"]:visible')).toContainText("Освоить ворону");
  });

  test("sign out, password reset by email, sign in with the new password", async ({ page }) => {
    await login(page, email, PASSWORD);
    await page.goto("/ru/account");
    await ready(page);
    await page.locator('[data-testid=\"sign-out\"]:visible').click();
    await expect(page).toHaveURL(/\/ru$/);
    expect((await memberState(page)).user).toBeNull();
    await page.goto("/ru/reset-password");
    await page.locator('[data-testid=\"reset-form\"]:visible').locator('input[name="email"]').fill(email);
    await page.locator('[data-testid=\"reset-form\"]:visible').locator('button[type="submit"]').click();
    await expect(page.getByText("письмо со ссылкой")).toBeVisible();
    await page.goto(await mailLink(email, "/auth/v1/verify"));
    await expect(page).toHaveURL(/update-password/);
    await page.locator('[data-testid=\"update-password-form\"]:visible').locator('input[name="password"]').fill("Newer-pass-2027");
    await page.locator('[data-testid=\"update-password-form\"]:visible').locator('button[type="submit"]').click();
    await expect(page.getByText("Пароль обновлён")).toBeVisible();
    await page.context().clearCookies();
    await login(page, email, "Newer-pass-2027");
    await expect(page).toHaveURL(/my-practice/);
  });

  test("export data and delete the account", async ({ page }) => {
    await login(page, email, "Newer-pass-2027");
    await page.goto("/ru/account");
    await ready(page);
    const res = await page.request.get("/api/me/export");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.favorites).toHaveLength(1);
    expect(data.practiceLog).toHaveLength(1);
    await page.locator('[data-testid=\"delete-confirm\"]:visible').fill("УДАЛИТЬ");
    await page.locator('[data-testid=\"delete-account\"]:visible').click();
    await expect(page).toHaveURL(/\/ru$/);
    await login(page, email, "Newer-pass-2027");
    await expect(page.locator('[data-testid="login-form"]:visible').getByRole("alert")).toBeVisible();
    // anonymous export is refused
    expect((await page.request.get("/api/me/export")).status()).toBe(401);
  });
});
