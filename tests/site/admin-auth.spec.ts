import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomBytes } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";

test("server-side setup/login protects APIs and credentials; logout revokes HttpOnly session", async ({ page, context, request }) => {
	const file = resolve(".env.shirone-admin-test-auth");
	let created = false;
	// Exclusive first setup fails safely if a stale fixture exists; never replace credentials.
	try {
		await page.goto("/admin/");
		await expect(page.getByRole("heading", { name: "设置后台密码" })).toBeVisible();
		for (const path of ["session", "posts", "documents", "post?file=guide/index.md", "image?path=assets/images/demo-avatar.webp"]) expect((await request.get(`/__admin/api/${path}`)).status()).toBe(401);
		expect((await request.post("/__admin/api/auth/setup", { data: { password: "anything" }, headers: { Origin: "https://example.com" } })).status()).toBe(403);
		const secret = randomBytes(12).toString("base64url");
		await page.getByLabel("密码", { exact: true }).fill(secret);
		await page.getByLabel("确认密码", { exact: true }).fill(secret);
		const setup = page.waitForResponse(response => response.url().endsWith("/auth/setup") && response.status() === 200);
		await page.getByRole("button", { name: "设置后台密码", exact: true }).click();
		await setup; created = true;
		await expect(page.locator(".admin-article-list li").first()).toBeVisible();
		const stored = await readFile(file, "utf8"); expect(stored).not.toContain(secret);
		const cookie = (await context.cookies()).find(item => item.name === "shirone_admin_session")!;
		expect(cookie.httpOnly).toBe(true); expect(cookie.sameSite).toBe("Strict");
		expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(secret);
		for (const path of ["/.env.shirone-admin-test-auth", "/.env.shirone-admin-test-auth?raw", `/@fs/${file.replace(/\\/g, "/")}`]) {
			const response = await request.get(path); expect(response.status()).toBeGreaterThanOrEqual(400); expect(await response.text()).not.toContain(JSON.parse(stored).hash);
		}
		await page.getByRole("button", { name: "退出登录" }).click();
		await expect(page.getByRole("heading", { name: "后台登录" })).toBeVisible();
		expect((await request.get("/__admin/api/session", { headers: { Cookie: `${cookie.name}=${cookie.value}` } })).status()).toBe(401);
		await page.getByLabel("密码", { exact: true }).fill("IncorrectPassword");
		await page.getByRole("button", { name: "后台登录", exact: true }).click();
		await expect(page.getByRole("alert")).toContainText("密码错误");
		expect(await page.getByLabel("密码", { exact: true }).inputValue()).toBe("");
		for (const theme of ["light", "dark"]) {
			await page.evaluate(mode => localStorage.setItem("theme", mode), theme);
			await page.reload();
			await expect(page.getByRole("heading", { name: "后台登录" })).toBeVisible();
			await expect.poll(() => page.evaluate(() => !!getComputedStyle(document.documentElement).getPropertyValue("--mc-primary").trim())).toBe(true);
			expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
		}
		await page.locator("#language-switch").click();
		await page.getByRole("menuitemradio", { name: "English" }).click();
		await expect(page.getByRole("heading", { name: "Admin login" })).toBeVisible();
		await page.setViewportSize({ width: 375, height: 812 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
		await page.screenshot({ path: "../output/shirone-admin-login.png", fullPage: true });
		await page.locator("#language-switch").click();
		await page.getByRole("menuitemradio", { name: "中文", exact: true }).click();
		await page.getByLabel("密码", { exact: true }).fill(secret);
		await page.getByRole("button", { name: "后台登录", exact: true }).click();
		await expect(page.locator(".admin-article-list li").first()).toBeVisible();
		await page.reload(); await expect(page.locator(".admin-article-list li").first()).toBeVisible();
		await page.getByRole("button", { name: "Shirone Authoring & Usage Guide", exact: true }).click();
		const image = page.locator(".admin-image-preview img"); await image.scrollIntoViewIfNeeded();
		await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
	} finally { if (created) await unlink(file).catch(error => { if (error.code !== "ENOENT") throw error; }); }
});
