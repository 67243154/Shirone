import { expect, test } from "@playwright/test";

for (const viewport of [
	{ width: 1440, height: 900 },
	{ width: 390, height: 844 },
]) {
	test(`home article opens at reading start below banner at ${viewport.width}px`, async ({
		page,
	}) => {
		await page.setViewportSize(viewport);
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await page.waitForFunction(() => !!window.swup?.hooks);
		await page.waitForFunction(() =>
			[...document.querySelectorAll(".onload-animation")].every(
				(element) =>
					!(element as HTMLElement).offsetParent ||
					getComputedStyle(element).opacity === "1",
			),
		);
		const link = page.locator(".m3-blog-postcard__title").nth(2);
		await link.evaluate((element) =>
			element.scrollIntoView({ block: "center", behavior: "instant" }),
		);
		await page.waitForTimeout(300);
		const before = await page.evaluate(() => window.scrollY);
		expect(before).toBeGreaterThan(100);
		const href = await link.getAttribute("href");
		await link.click();
		await page.waitForURL(`**${href}`, { waitUntil: "domcontentloaded" });
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"post",
			{ timeout: 30000 },
		);
		await expect
			.poll(
				async () =>
					page.evaluate(() => {
						const top = document
							.querySelector(".post-card")!
							.getBoundingClientRect().top;
						return top >= -1 && top < 240;
					}),
				{ timeout: 10000 },
			)
			.toBe(true);
		await page.waitForTimeout(500);
		const geometry = await page.evaluate(() => ({
			articleTop: document.querySelector(".post-card")!.getBoundingClientRect()
				.top,
			bannerBottom: document
				.getElementById("banner-wrapper")!
				.getBoundingClientRect().bottom,
			bannerHidden: document.getElementById("banner-wrapper")!.hidden,
			bannerVisible: document.body.dataset.bannerVisible,
			bannerLayout: document.body.dataset.bannerLayout,
			page: document.body.dataset.currentPage,
		}));
		expect(geometry.articleTop).toBeGreaterThanOrEqual(-1);
		expect(geometry.articleTop).toBeLessThan(240);
		if (!geometry.bannerHidden)
			expect(geometry.bannerBottom).toBeLessThanOrEqual(80);
		await page.goBack({ waitUntil: "domcontentloaded" });
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"home",
		);
		await page.waitForTimeout(400);
		expect(
			Math.abs((await page.evaluate(() => window.scrollY)) - before),
		).toBeLessThan(5);
	});
}
