import { expect, test } from "@playwright/test";
import { login, SEED_PASSWORD } from "./helpers";

/** HTTP-level security checks (database boundaries are covered by tests/integration/security.test.ts). */
test.describe("security", () => {
  test("personal API endpoints require a session", async ({ request }) => {
    const exp = await request.get("/api/me/export");
    expect(exp.status()).toBe(401);
    const state = await (await request.get("/api/me/state")).json();
    expect(state.user).toBeNull();
    expect(state.favorites).toEqual([]);
  });

  test("security headers are sent on pages", async ({ request }) => {
    const res = await request.get("/ru");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'self'");
  });

  test("admin screens and drafts are not reachable without staff roles", async ({ page, request }) => {
    // anonymous: no admin data in the HTML
    const anon = await (await request.get("/ru/admin")).text();
    expect(anon).not.toContain('data-testid="admin-dashboard"');
    // member: explicit no-access, also for a draft preview URL
    await login(page, "member@balance.local", SEED_PASSWORD);
    for (const url of ["/ru/admin", "/ru/admin/list/pose", "/ru/admin/users", "/ru/admin/preview/00000000-0000-4000-8000-000000000000"]) {
      await page.goto(url);
      await expect(page.locator('[data-testid="admin-no-access"]:visible'), url).toBeVisible();
    }
  });

  test("the service-role key never reaches the browser", async ({ page }) => {
    const bundles: string[] = [];
    page.on("response", async (r) => {
      if (r.url().includes("/_next/static/") && r.url().endsWith(".js")) bundles.push(await r.text().catch(() => ""));
    });
    await page.goto("/ru/poses/bakasana");
    await page.goto("/ru/login");
    const secret = process.env.SUPABASE_SECRET_KEY!;
    expect(secret.length).toBeGreaterThan(10);
    expect(bundles.length).toBeGreaterThan(0);
    for (const b of bundles) expect(b.includes(secret)).toBe(false);
    expect((await page.content()).includes(secret)).toBe(false);
  });
});
