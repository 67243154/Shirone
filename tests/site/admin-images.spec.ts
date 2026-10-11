import { expect, test } from "./admin-fixtures";

test("admin image thumbnails load, update, show failures and fit mobile", async ({ page }) => {
	await page.goto("/admin/");
	await page.getByRole("button", { name: "站点设置", exact: true }).click();
	await page.getByRole("button", { name: /个人资料与社交链接/ }).click();
	const preview = page.locator(".admin-image-preview").first();
	await preview.scrollIntoViewIfNeeded();
	await expect.poll(() => preview.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
	const field = page.locator(".admin-config-field").filter({ has: preview });
	await field.locator("textarea").fill("/missing-admin-image.png");
	await expect(preview).toContainText("图片加载失败");
	await field.locator("textarea").fill("assets/images/demo-avatar.webp");
	await expect.poll(() => preview.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
	await page.setViewportSize({ width: 375, height: 812 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
	await page.screenshot({ path: "../output/shirone-admin-image-mobile.png", fullPage: true });
	await expect((await page.request.get("/__admin/api/image?path=..%2Fpackage.json")).status()).toBe(404);
});
