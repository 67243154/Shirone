import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./admin-fixtures";
import { readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";

test("creates and saves a real draft without changing existing posts", async ({
	page,
}) => {
	const slug = `admin-smoke-${Date.now()}`;
	const target = resolve("src/content/posts", `${slug}.md`);
	try {
		await page.goto("/admin/");
		await expect(page.locator(".admin-article-list li").first()).toBeVisible({
			timeout: 30000,
		});
		await expect(page.locator(".admin-workspace")).toHaveCSS("display", "grid");
		await page.screenshot({
			path: "../output/shirone-admin-desktop.png",
			fullPage: true,
		});
		await page.getByRole("button", { name: "新建文章", exact: true }).click();
		await page
			.getByLabel("文章标题", { exact: true })
			.fill("Admin smoke draft");
		await page.getByLabel("文件名（小写字母、数字和连字符）").fill(slug);
		await page
			.getByLabel("Markdown 正文")
			.fill("# Saved locally\n\nBrowser write verification.");
		await page.getByRole("button", { name: "保存文章", exact: true }).click();
		await expect(page.locator(".admin-feedback[role=status]")).toContainText(
			"文章已保存到本地。",
			{ timeout: 30000 },
		);
		const source = await readFile(target, "utf8");
		expect(source).toContain("draft: true");
		expect(source).toContain("Browser write verification.");
	} finally {
		await unlink(target).catch((error) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
});

test("admin lists real files, searches, edits, previews and fits mobile", async ({
	page,
	request,
}) => {
	await page.goto("/admin/");
	await expect(
		page.getByRole("heading", { name: "内容管理", exact: true }),
	).toBeVisible();
	await expect(page.locator(".admin-article-list li").first()).toBeVisible({
		timeout: 30000,
	});
	await page
		.getByRole("textbox", { name: "搜索标题、分类或标签" })
		.fill("Markdown Example");
	await expect(page.locator(".admin-article-list li")).toHaveCount(1);
	await page
		.getByRole("button", { name: "Markdown Example", exact: true })
		.click();
	await expect(page.getByLabel("文章标题", { exact: true })).toHaveValue(
		"Markdown Example",
	);
	await page.getByRole("button", { name: "预览", exact: true }).click();
	await expect(page.locator(".admin-preview")).toContainText("An h1 header");
	await page.getByRole("button", { name: "返回文章列表" }).click();
	await page.locator("#language-switch").click();
	await page.getByRole("menuitemradio", { name: "English" }).click();
	await expect(
		page.getByRole("heading", { name: "Content studio", exact: true }),
	).toBeVisible();
	await page.setViewportSize({ width: 375, height: 812 });
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth),
	).toBeLessThanOrEqual(375);
	await page.screenshot({
		path: "../output/shirone-admin-mobile.png",
		fullPage: true,
	});
	await page.evaluate(() => { (window as unknown as Record<string, unknown>).__adminNavigationProbe = true; });
	await page.locator(".admin-brand").click();
	await expect(page.locator(".admin-workspace")).toHaveCount(0);
	expect(await page.evaluate(() => "__adminNavigationProbe" in window)).toBe(false);
	await page.goto("/admin/");
	await expect(page.getByRole("heading", { name: "Content studio", exact: true })).toBeVisible();
	const forbidden = await request.get("/__admin/api/posts");
	expect(forbidden.status()).toBe(401);
	const crossOrigin = await request.get("/__admin/api/session", {
		headers: { Origin: "https://example.com" },
	});
	expect(crossOrigin.status()).toBe(403);
});

for (const mode of ["light", "dark"]) {
	test(`admin accessibility ${mode}`, async ({ page }) => {
		await page.addInitScript(
			(theme) => localStorage.setItem("theme", theme),
			mode,
		);
		await page.goto("/admin/");
		await expect(page.locator(".admin-article-list li").first()).toBeVisible({
			timeout: 30000,
		});
		await expect(page.locator(".admin-workspace")).toHaveCSS("display", "grid");
		expect(
			await page.evaluate(() =>
				document.documentElement.classList.contains("dark"),
			),
		).toBe(mode === "dark");
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						!!getComputedStyle(document.documentElement)
							.getPropertyValue("--mc-primary")
							.trim(),
				),
			)
			.toBe(true);
		expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
		await page.getByRole("button", { name: "新建文章", exact: true }).click();
		expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
		if (mode === "light")
			await page.screenshot({
				path: "../output/shirone-admin-editor.png",
				fullPage: true,
			});
	});
}
