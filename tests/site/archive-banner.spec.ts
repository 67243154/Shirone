import { expect, test } from "@playwright/test";

test("archive banner follows category selection and resets for all posts", async ({
	page,
	request,
}) => {
	await page.goto("/archive/?category=Examples", {
		waitUntil: "domcontentloaded",
	});
	const container = page.locator("#swup-container");
	await expect(container).toHaveAttribute("data-banner-title", "Examples");
	const firstCount = await container.getAttribute("data-banner-description");
	expect(firstCount).toMatch(/^\d+ /);
	const response = await request.get("/archive/?category=Examples");
	expect(await response.text()).toContain('data-banner-title="Examples"');
	await page.waitForFunction(() => !!window.swup?.hooks);
	await page.locator("#category-bar a").filter({ hasText: "Guides" }).click();
	await expect(container).toHaveAttribute("data-banner-title", "Guides", {
		timeout: 30000,
	});
	const secondCount = await container.getAttribute("data-banner-description");
	expect(secondCount).toMatch(/^\d+ /);
	const banner = page.locator("[data-banner-context-title]");
	if (await banner.isVisible()) {
		await expect(banner).toHaveText("Guides");
		await expect(page.locator("[data-banner-context-description]")).toHaveText(
			secondCount!,
		);
	}
	await page
		.locator("#category-bar a")
		.filter({ hasText: /归档|Archive/ })
		.click();
	await expect(container).toHaveAttribute("data-banner-title", /归档|Archive/, {
		timeout: 30000,
	});
	await page.goBack({ waitUntil: "domcontentloaded" });
	await expect(container).toHaveAttribute("data-banner-title", "Guides", {
		timeout: 30000,
	});
	await page.goto("/archive/?category=does-not-exist", {
		waitUntil: "domcontentloaded",
	});
	await expect(container).toHaveAttribute(
		"data-banner-title",
		"does-not-exist",
	);
	await expect(container).toHaveAttribute("data-banner-description", /^0 /);
});
