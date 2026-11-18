import { expect, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const envFile = join(__dirname, "..", "..", ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
export const MAILPIT = process.env.MAILPIT_URL || "http://127.0.0.1:54324";
export const SEED_PASSWORD = process.env.SEED_PASSWORD || "Balance-dev-2026";

export const unique = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.balance.local`;

export async function login(page: Page, email: string, password: string, locale = "ru", next?: string) {
  await page.goto(`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  // :visible — a hidden copy of the previous page can stay in the DOM (React Activity) after navigation.
  const form = page.locator('[data-testid="login-form"]:visible');
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="password"]').fill(password);
  await form.locator('button[type="submit"]').click();
  // Wait for the redirect after a successful sign-in (or for the error message).
  await Promise.race([
    page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 }),
    form.getByRole("alert").waitFor({ timeout: 30_000 }),
  ]).catch(() => {});
}

/** Returns the first link in the most recent email sent to `email`. */
export async function mailLink(email: string, contains = "/auth/v1/verify"): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const data = (await res.json()) as { messages?: { ID: string }[] };
    if (data.messages && data.messages.length > 0) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${data.messages[0].ID}`)).json();
      const body = `${msg.HTML ?? ""} ${msg.Text ?? ""}`;
      const links = [...body.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0].replace(/&amp;/g, "&"));
      const link = links.find((l) => l.includes(contains));
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email for ${email}`);
}

export async function memberState(page: Page) {
  return page.evaluate(async () => (await fetch("/api/me/state", { cache: "no-store" })).json());
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/** Waits until the client knows who the user is (member state loaded). */
export async function ready(page: Page, signedIn = true) {
  await expect(page.locator('[data-testid="account-link"]:visible')).toHaveAttribute("data-member-status", signedIn ? "member" : "guest");
}
