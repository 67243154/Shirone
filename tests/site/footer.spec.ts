import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const viewport of [
	{ width: 1280, height: 900 },
	{ width: 390, height: 844 },
]) {
	test(`footer placeholders and official links at ${viewport.width}px`, async ({
		page,
	}) => {
		await page.setViewportSize(viewport);
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/", { waitUntil: "domcontentloaded" });
		const footer = page.locator(".m3-blog-footer:visible").first();
		await footer.scrollIntoViewIfNeeded();
		await expect(footer).toContainText("工信部 ICP 备案号：待填写");
		await expect(footer).toContainText("公安备案号：待填写");
		await expect(footer).toContainText("版权名称待填写");
		await expect(
			footer.getByRole("link", { name: "工信部 ICP 备案号：待填写" }),
		).toHaveAttribute("href", "https://beian.miit.gov.cn/");
		await expect(
			footer.getByRole("link", { name: "公安备案号：待填写" }),
		).toHaveAttribute("href", "https://beian.mps.gov.cn/");
		await expect(
			footer.getByRole("link", { name: "RSS", exact: true }),
		).toHaveAttribute("href", "/rss/");
		await expect(
			footer.locator(".m3-blog-footer__badge-placeholder"),
		).toBeVisible();
		await expect(footer.locator("img")).toHaveCount(0);
		const overflow = await footer.evaluate(
			(element) => element.scrollWidth > element.clientWidth,
		);
		expect(overflow).toBe(false);
		await expect
			.poll(() =>
				page.evaluate(() =>
					getComputedStyle(document.documentElement).getPropertyValue(
						"--mc-primary",
					),
				),
			)
			.not.toBe("");
		const axe = await new AxeBuilder({ page })
			.include(".m3-blog-footer")
			.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
			.analyze();
		expect(axe.violations).toEqual([]);
		await page.evaluate(() =>
			document.dispatchEvent(
				new CustomEvent("site:language-select", { detail: { locale: "en" } }),
			),
		);
		await expect(footer).toContainText("ICP registration: pending");
		await page.locator('a[href="/archive/"]:visible').first().click();
		await expect(page).toHaveURL(/\/archive\/$/);
		await expect(footer).toContainText("ICP registration: pending");
	});
}
