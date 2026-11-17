import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectNoHorizontalOverflow } from "./helpers";

test.describe("public product", () => {
  test("home in RU and EN with working sections @mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(ru|en)$/);
    await page.goto("/ru");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Найди свою точку баланса.");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find your balance.");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expectNoHorizontalOverflow(page);
  });

  test("category card opens the library with an active filter", async ({ page }) => {
    await page.goto("/ru");
    await page.getByRole("link", { name: /Балансы на руках/ }).first().click();
    await expect(page).toHaveURL(/\/ru\/poses\?type=arm-balances/);
    await expect(page.locator('[data-testid=\"result-count\"]:visible')).toContainText(/Найдено: \d+/);
    const count = await page.locator('[data-testid=\"pose-grid\"]:visible').locator("li").count();
    expect(count).toBeGreaterThan(5);
  });

  test("search by Russian, English, Sanskrit, alternative name and wrong keyboard layout", async ({ page }) => {
    for (const q of ["ворона", "crow", "bakasana", "Какасана", "ифлфыфтф"]) {
      await page.goto(`/ru/poses?q=${encodeURIComponent(q)}`);
      await expect(page.locator('[data-slug="bakasana"]')).toBeVisible();
    }
    await page.goto("/ru/poses");
    await page.locator('[data-testid=\"library-search\"]:visible').fill("zzzzzz");
    await expect(page.getByText("Ничего не найдено")).toBeVisible();
  });

  test("filters, counter, sort and URL state survive a language switch", async ({ page }) => {
    await page.goto("/ru/poses");
    const total = Number((await page.locator('[data-testid=\"result-count\"]:visible').textContent())!.match(/\d+/)![0]);
    expect(total).toBeGreaterThanOrEqual(40);
    await page.locator('[data-testid=\"desktop-filters\"]:visible').getByText("Начальный", { exact: true }).click();
    await expect(page).toHaveURL(/level=beginner/);
    const beginner = Number((await page.locator('[data-testid=\"result-count\"]:visible').textContent())!.match(/\d+/)![0]);
    expect(beginner).toBeLessThan(total);
    await page.locator('[data-testid=\"desktop-filters\"]:visible').getByText("Балансы на руках", { exact: true }).click();
    await expect(page).toHaveURL(/type=arm-balances/);
    await expect(page.locator('[data-slug="bakasana"]')).toBeVisible();
    await page.locator('[data-testid=\"sort-select\"]:visible').last().selectOption("name");
    await expect(page).toHaveURL(/sort=name/);
    // switch language: same page, same filters
    await page.getByRole("link", { name: "en", exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/poses\?.*level=beginner.*type=arm-balances/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('[data-testid="result-count"]:visible')).toContainText("Found:");
    await expect(page.locator('[data-slug="bakasana"]')).toBeVisible();
  });

  test("pose page: sections, lazy animation, no third-party video requests before interaction", async ({ page }) => {
    const media: string[] = [];
    page.on("request", (r) => {
      const u = r.url();
      if (/youtube|ytimg|googlevideo/.test(u) || /\.(mp4|webm)(\?|$)/.test(u)) media.push(u);
    });
    await page.goto("/ru/poses/bakasana");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Бакасана");
    for (const h of ["Как выполнить", "Анатомия и мышцы", "Подготовительные упражнения", "Типичные ошибки", "Видеоурок", "Меры предосторожности", "Требования к подготовке"]) {
      await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("note").first()).toContainText("не проверен преподавателем");
    expect(media).toHaveLength(0);
    const play = page.locator('[data-testid=\"play-animation\"]:visible');
    if (await play.count()) {
      await play.click();
      await expect(page.locator('[data-testid=\"pose-animation-video\"]:visible')).toBeVisible();
      await expect.poll(() => media.filter((u) => /\.(mp4|webm)/.test(u)).length).toBeGreaterThan(0);
    }
    // no verified lesson yet → honest message instead of a random video
    await expect(page.locator('[data-testid=\"video-missing\"]:visible')).toBeVisible();
    expect(media.filter((u) => /youtube|ytimg|googlevideo/.test(u))).toHaveLength(0);
  });

  test("language switch keeps the pose and changes content", async ({ page }) => {
    await page.goto("/ru/poses/tittibhasana");
    await page.getByRole("link", { name: "en", exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/poses\/tittibhasana/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Firefly Pose");
  });

  test("programs, program and step pages render for guests", async ({ page }) => {
    await page.goto("/ru/programs");
    await page.getByRole("link", { name: /Первые балансы/ }).first().click();
    await expect(page).toHaveURL(/\/ru\/programs\/beginner/);
    await page.locator('[data-testid=\"program-steps\"]:visible').locator("a").first().click();
    await expect(page.locator('[data-testid=\"step-page\"]:visible')).toBeVisible();
    await expect(page.locator('[data-testid=\"step-complete\"]:visible')).toBeVisible();
  });

  test("content pages and localized 404", async ({ page }) => {
    for (const p of ["about", "faq", "contact", "privacy", "terms"]) {
      const res = await page.goto(`/en/${p}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    const res = await page.goto("/ru/no-such-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("Страница не найдена")).toBeVisible();
  });

  test("keyboard navigation: skip link and focusable header", async ({ page }) => {
    await page.goto("/ru/poses");
    await page.keyboard.press("Tab");
    const skip = page.locator(".skip-link");
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main/);
  });

  test("accessibility: no serious/critical axe violations on key pages", async ({ page }) => {
    for (const url of ["/ru", "/ru/poses", "/ru/poses/bakasana", "/en/programs/beginner", "/ru/login"]) {
      await page.goto(url);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${url}: ${v.id} (${v.nodes.length})`)).toEqual([]);
    }
  });

  test("mobile layout without horizontal overflow, filter sheet @mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile project only");
    for (const url of ["/ru", "/ru/poses", "/ru/poses/bakasana", "/ru/programs/beginner", "/ru/my-practice", "/ru/login"]) {
      await page.goto(url);
      await expectNoHorizontalOverflow(page);
    }
    await page.goto("/ru/poses");
    await page.locator('[data-testid=\"open-filters\"]:visible').click();
    await page.getByRole("dialog").getByText("Начальный", { exact: true }).click();
    await page.locator('[data-testid=\"apply-filters\"]:visible').click();
    await expect(page).toHaveURL(/level=beginner/);
  });
});
