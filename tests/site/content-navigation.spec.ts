import { expect, test } from "@playwright/test";

test("feed and sidebar navigation settle at content with animated scrolling", async ({
	page,
}) => {
	test.setTimeout(360000);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await page.waitForFunction(() => !!window.swup?.hooks);
	for (const selector of [
		'#category-bar a[href$="/archive/"]',
		'#category-bar a[href*="category=Examples"]',
		'#categories a[href*="category=Guides"]',
		"#series a",
		"#tags a",
		'#category-bar a[href="/"]',
	]) {
		// Some taxonomy widgets are intentionally hidden on series/detail pages.
		// Exercise each visible entry from the feed (home button from the archive).
		await page.goto(selector.includes('href="/"') ? "/archive/" : "/", {
			waitUntil: "domcontentloaded",
		});
		await page.waitForFunction(() => !!window.swup?.hooks);
		const link = page.locator(selector).first();
		const href = await link.getAttribute("href");
		await link.evaluate((element) =>
			element.scrollIntoView({ block: "center", behavior: "instant" }),
		);
		await page.evaluate(() => {
			const samples: number[] = [];
			(window as unknown as { navSamples: number[] }).navSamples = samples;
			window.addEventListener("scroll", () => samples.push(window.scrollY), {
				passive: true,
			});
		});
		await link.click();
		await page.waitForURL(`**${href}`, { waitUntil: "domcontentloaded" });
		await expect
			.poll(
				() =>
					page.evaluate(() => {
						const bar = document.getElementById("category-bar")!;
						const nav = document.getElementById("navbar")!;
						return Math.abs(
							bar.getBoundingClientRect().top -
								nav.getBoundingClientRect().height,
						);
					}),
				{ timeout: 30000 },
			)
			.toBeLessThanOrEqual(24);
		await page.waitForTimeout(400);
		const samples = await page.evaluate(
			() => (window as unknown as { navSamples: number[] }).navSamples,
		);
		expect(
			new Set(samples.map((value) => Math.round(value))).size,
			selector,
		).toBeGreaterThan(3);
	}
	// Clicking the already selected home chip must not return to the banner.
	await page.evaluate(() =>
		window.scrollTo({ top: 1200, behavior: "instant" }),
	);
	await page.locator('#category-bar a[href="/"]').click();
	await expect
		.poll(
			() =>
				page.evaluate(() =>
					Math.abs(
						document.getElementById("category-bar")!.getBoundingClientRect()
							.top -
							document.getElementById("navbar")!.getBoundingClientRect().height,
					),
				),
			{ timeout: 30000 },
		)
		.toBeLessThanOrEqual(24);
});
