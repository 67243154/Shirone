import { test, expect } from "./admin-fixtures";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";

test("admin category filter, batch statuses and confirmed deletion work in production SSR", async ({
	page,
	baseURL,
}) => {
	const prefix = `management-${Date.now()}`;
	const files = ["alpha", "beta", "other"].map(
		(name) => `${prefix}-${name}.md`,
	);
	const token = (await (await page.request.get("/__admin/api/session")).json())
		.token;
	const headers = { Origin: baseURL!, "X-Shirone-Admin": token };
	try {
		for (const [index, file] of files.entries()) {
			const response = await page.request.post("/__admin/api/post", {
				headers,
				data: {
					file,
					create: true,
					title: `${prefix} ${index}`,
					published: "2026-10-13",
					category: index < 2 ? prefix : `${prefix}-other`,
					tags: [],
					image: "",
					description: "",
					draft: false,
					pinned: false,
					body: "Test-only content",
				},
			});
			expect(response.ok()).toBe(true);
		}
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/admin/", { waitUntil: "domcontentloaded" });
		await page.getByRole("combobox", { name: "按分类筛选" }).click();
		await page.getByRole("option", { name: prefix, exact: true }).click();
		await expect(page.locator(".admin-article-list li")).toHaveCount(2);
		const categoryField = page.getByRole("combobox", { name: "按分类筛选" });
		const searchBox = await page
			.locator(".admin-search .m3-text-field")
			.boundingBox();
		const categoryBox = await categoryField.boundingBox();
		expect(categoryBox!.height).toBeCloseTo(searchBox!.height, 0);
		const corners = await categoryField.evaluate((element) => {
			const style = getComputedStyle(element);
			return [
				style.borderTopLeftRadius,
				style.borderBottomLeftRadius,
				style.borderBottomRightRadius,
			];
		});
		expect(parseFloat(corners[1])).toBeGreaterThan(0);
		expect(corners[1]).toBe(corners[0]);
		expect(corners[2]).toBe(corners[0]);
		await page
			.getByRole("checkbox", { name: "全选当前筛选结果" })
			.locator("..")
			.click();
		await expect(page.getByText("已选 2 篇", { exact: true })).toBeVisible();
		await page.getByRole("button", { name: "转为草稿", exact: true }).click();
		await expect(
			page.getByText("已更新 2 篇文章。", { exact: true }),
		).toBeVisible();
		await expect(
			page.locator(".admin-article-list .admin-status.draft"),
		).toHaveCount(2);
		await page
			.getByRole("checkbox", { name: "全选当前筛选结果" })
			.locator("..")
			.click();
		await page.getByRole("button", { name: "发布所选", exact: true }).click();
		await expect(
			page.locator(".admin-article-list .admin-status.draft"),
		).toHaveCount(0);
		await page
			.getByRole("textbox", { name: "搜索标题、分类或标签" })
			.fill(`${prefix} 0`);
		await expect(page.locator(".admin-article-list li")).toHaveCount(1);
		await page
			.getByRole("checkbox", { name: "全选当前筛选结果" })
			.locator("..")
			.click();
		await expect(page.getByText("已选 1 篇", { exact: true })).toBeVisible();
		await page.getByRole("button", { name: "批量删除", exact: true }).click();
		await expect(
			page.getByRole("dialog", { name: "确认删除文章" }),
		).toBeVisible();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: "取消", exact: true })
			.click();
		await expect(page.locator(".admin-article-list li")).toHaveCount(1);
		await page
			.getByRole("button", { name: `删除: ${prefix} 0`, exact: true })
			.click();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: "删除", exact: true })
			.click();
		await expect(
			page.getByText("已删除 1 篇文章，原文件已备份。", { exact: true }),
		).toBeVisible();
		expect(
			(
				await page.request.get(`/posts/${files[0].replace(/\.md$/, "")}/`)
			).status(),
		).toBe(404);
		await page.getByRole("textbox", { name: "搜索标题、分类或标签" }).fill("");
		await expect(page.locator(".admin-article-list li")).toHaveCount(1);
		await page.setViewportSize({ width: 390, height: 844 });
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth > innerWidth,
			),
		).toBe(false);
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
			.include("[data-admin-workspace]")
			.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
			.analyze();
		expect(axe.violations).toEqual([]);
		await page.screenshot({
			path: ".shirones/admin-management-mobile.png",
			fullPage: true,
		});
		const visitor = await page.context().browser()!.newContext({ baseURL });
		expect(
			(
				await visitor.request.post("/__admin/api/posts/batch", {
					headers: { Origin: baseURL! },
					data: { action: "delete", posts: [] },
				})
			).status(),
		).toBe(401);
		await visitor.close();
		expect(
			(
				await page.request.post("/__admin/api/posts/batch", {
					headers: { Origin: baseURL! },
					data: { action: "delete", posts: [] },
				})
			).status(),
		).toBe(403);
	} finally {
		for (const file of files)
			await rm(resolve("src/content/posts", file), { force: true });
	}
});
