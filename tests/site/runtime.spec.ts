import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./admin-fixtures";

test("runtime admin saves site title and appearance; SSR and client navigation agree", async ({
	page,
	context,
}) => {
	await page.goto("/admin/");
	await expect(
		page.getByText("动态管理 · 保存后下次访问直接生效，无需重建整站"),
	).toBeVisible();
	await page.getByRole("button", { name: "站点设置", exact: true }).click();
	await page.getByRole("button", { name: /站点基础与主题/ }).click();
	await page.getByLabel("站点标题", { exact: true }).fill("本地动态验证站点");
	await page.getByRole("button", { name: "保存配置", exact: true }).click();
	await expect(
		page.getByText("已保存，下次访问将读取最新内容。", { exact: true }),
	).toBeVisible({ timeout: 15000 });
	await expect(
		page.getByRole("button", { name: "高级源码", exact: true }),
	).toBeDisabled();
	const blog = await context.newPage();
	await blog.goto("/");
	await expect(blog).toHaveTitle(/本地动态验证站点/);
	await expect(blog.locator('meta[property="og:site_name"]')).toHaveAttribute(
		"content",
		"本地动态验证站点",
	);
	await blog.waitForFunction(
		() =>
			getComputedStyle(document.documentElement)
				.getPropertyValue("--mc-primary")
				.trim() !== "",
	);
	await expect(blog.locator("#shirone-runtime-state")).toHaveCount(1);
	const update = await blog.evaluate(async () => {
		const session = await (await fetch("/__admin/api/session")).json();
		const headers = { "X-Shirone-Admin": session.token };
		const doc = await (
			await fetch("/__admin/api/document?id=site", { headers })
		).json();
		const title = doc.fields.find(
			(field: { path: string }) => field.path === "siteConfig.title",
		);
		return (
			await fetch("/__admin/api/document", {
				method: "POST",
				headers: { ...headers, "Content-Type": "application/json" },
				body: JSON.stringify({
					id: "site",
					version: doc.version,
					fields: [{ id: title.id, value: "导航读取最新标题" }],
				}),
			})
		).status;
	});
	expect(update).toBe(200);
	await blog.locator('a[href="/archive/"]').first().click();
	await expect(blog).toHaveURL(/\/archive\//);
	await expect(blog).toHaveTitle(/导航读取最新标题/);
	await expect(
		blog.getByText("导航读取最新标题", { exact: true }).first(),
	).toBeVisible();
	await blog.screenshot({
		path: "../output/dynamic-home-browser.png",
		fullPage: false,
	});
	await page.getByRole("button", { name: "返回栏目列表", exact: true }).click();
	await page.getByRole("button", { name: "外观与布局", exact: true }).click();
	await page.getByRole("button", { name: /动态外观参数/ }).click();
	await page.getByLabel("正文基础字号（px）", { exact: true }).fill("18");
	await page.getByRole("button", { name: "保存配置", exact: true }).click();
	await expect(
		page.getByText("已保存，下次访问将读取最新内容。", { exact: true }),
	).toBeVisible({ timeout: 15000 });
	await blog.reload();
	await expect(blog.locator("html")).toHaveCSS("font-size", "18px");
	await page.screenshot({
		path: "../output/dynamic-admin-browser.png",
		fullPage: false,
	});
});

for (const theme of ["light", "dark"])
	test(`dynamic home and authenticated admin accessibility ${theme}`, async ({
		page,
	}) => {
		await page.addInitScript(
			(theme) => localStorage.setItem("theme", theme),
			theme,
		);
		await page.goto("/");
		await page.waitForFunction(
			() =>
				getComputedStyle(document.documentElement)
					.getPropertyValue("--mc-primary")
					.trim() !== "",
		);
		await page.waitForFunction(
			() =>
				[...document.querySelectorAll(".onload-animation")].every(
					(element) =>
						(element as HTMLElement).offsetParent === null ||
						Number(getComputedStyle(element).opacity) === 1,
				),
			undefined,
			{ timeout: 15000 },
		);
		expect(
			(
				await new AxeBuilder({ page })
					.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
					.disableRules(["page-has-heading-one"])
					.analyze()
			).violations,
		).toEqual([]);
		await page.goto("/admin/");
		await expect(page.locator(".admin-article-list li").first()).toBeVisible();
		expect(
			(
				await new AxeBuilder({ page })
					.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
					.analyze()
			).violations,
		).toEqual([]);
	});
