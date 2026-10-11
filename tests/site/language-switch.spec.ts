import { expect, test } from "@playwright/test";

test("Chinese default, English preference, Swup navigation and round trip", async ({
	page,
	request,
}) => {
	const response = await request.get("/");
	expect(await response.text()).toContain('lang="zh-CN"');
	await page.goto("/");
	const button = page.locator("#language-switch");
	await expect(button).toHaveAttribute("aria-label", "选择语言");
	await expect(button.locator("svg")).toBeVisible();
	await expect(page.locator("#category-bar")).toContainText("归档");
	const originalTitle = await page
		.locator(".m3-blog-postcard__title")
		.first()
		.textContent();
	await button.click();
	await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
	await page
		.getByRole("menuitemradio", { name: "English", exact: true })
		.click();
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await expect(page.locator("#category-bar")).toContainText("Archive");
	await expect(button).toHaveAttribute("aria-label", "Select language");
	expect(
		await page.locator(".m3-blog-postcard__title").first().textContent(),
	).toBe(originalTitle);
	await page.locator('#category-bar a[href="/archive/"]').click();
	await expect(page).toHaveURL(/archive/);
	await expect(page.locator("#language-switch")).toHaveAttribute(
		"aria-label",
		"Select language",
	);
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await page.locator("#language-switch").focus();
	await page.keyboard.press("ArrowDown");
	await expect(
		page.getByRole("menuitemradio", { name: "English", exact: true }),
	).toBeFocused();
	await page.keyboard.press("ArrowDown");
	await expect(
		page.getByRole("menuitemradio", { name: "中文", exact: true }),
	).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
	await expect(page.locator("#language-switch-name")).toHaveCount(0);
	await page.goto("/");
	await page.screenshot({ path: "../output/shirone-language-desktop.png" });
});

test("language control fits mobile top bar", async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto("/");
	await expect(page.locator("#language-switch")).toBeVisible();
	await expect(page.locator("#language-switch svg")).toBeVisible();
	await page.locator("#language-switch").click();
	const menu = page.locator("[data-language-menu] [role=menu]");
	await expect(menu).toBeVisible();
	const geometry = await menu.boundingBox();
	const buttonGeometry = await page.locator("#language-switch").boundingBox();
	expect(geometry!.x + geometry!.width).toBeLessThanOrEqual(375);
	expect(geometry!.y).toBeGreaterThan(
		buttonGeometry!.y + buttonGeometry!.height,
	);
	await page.screenshot({ path: "../output/shirone-language-menu.png" });
	await page
		.getByRole("menuitemradio", { name: "English", exact: true })
		.click();
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await expect(menu).not.toBeVisible();
	await page.locator("#language-switch").click();
	await page.keyboard.press("Escape");
	await expect(menu).not.toBeVisible();
});
