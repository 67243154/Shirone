import { expect, test } from "./admin-fixtures";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { adminDocuments } from "../../src/utils/admin-catalog";

test("all documented config/data sections are available; forms, lists and source modes work", async ({
	page,
}) => {
	await page.goto("/admin/");
	await expect(page.locator(".admin-article-list li").first()).toBeVisible();
	const ids = await page.evaluate(async () => {
		const { token } = await (await fetch("/__admin/api/session")).json();
		const response = await fetch("/__admin/api/documents", {
			headers: { "X-Shirone-Admin": token },
		});
		return (await response.json()).ids as string[];
	});
	expect(ids.sort()).toEqual(adminDocuments.map((item) => item.id).sort());
	await page.getByRole("button", { name: "站点设置", exact: true }).click();
	await page.getByRole("button", { name: /站点基础与主题/ }).click();
	await expect(page.getByLabel("站点标题", { exact: true })).toHaveValue(
		"Shirone",
	);
	await expect(page.getByLabel("默认界面语言", { exact: true })).toHaveValue(
		"zh_CN",
	);
	await expect(page.getByLabel("默认界面语言", { exact: true })).toContainText(
		"简体中文",
	);
	await page.getByRole("button", { name: "高级源码", exact: true }).click();
	await expect(page.getByLabel("高级源码", { exact: true })).toHaveValue(
		/withUserConfig/,
	);
	await page.getByRole("button", { name: "表单编辑", exact: true }).click();
	await page.getByRole("button", { name: "返回栏目列表", exact: true }).click();
	await page.getByRole("button", { name: /个人资料与社交链接/ }).click();
	const before = await page.locator(".admin-array-item").count();
	await page.getByRole("button", { name: "添加条目", exact: true }).click();
	await expect(page.locator(".admin-array-item")).toHaveCount(before + 1);
	await page.locator(".admin-array-item").last().locator("summary").click();
	await page
		.locator(".admin-array-item")
		.last()
		.getByRole("button", { name: "移除此条目", exact: true })
		.click();
	await expect(page.locator(".admin-array-item")).toHaveCount(before);
	page.on("dialog", (dialog) => void dialog.accept());
	await page.getByRole("button", { name: "内容数据", exact: true }).click();
	await page.getByRole("button", { name: /友情链接/ }).click();
	await expect(page.locator(".admin-array-item")).toHaveCount(3);
	await page.getByRole("button", { name: "保存配置", exact: true }).click();
	await expect(
		page.getByRole("status").filter({ hasText: "已保存到项目文件" }),
	).toBeVisible({ timeout: 45000 });
	await page.setViewportSize({ width: 375, height: 812 });
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth),
	).toBeLessThanOrEqual(375);
	await page.screenshot({
		path: "../output/shirone-admin-settings-mobile.png",
		fullPage: true,
	});
});

test("configuration type errors do not write; a valid config edit writes the real file", async ({
	page,
}) => {
	const path = resolve("src/config/announcementConfig.ts");
	const original = await readFile(path, "utf8");
	try {
		await page.goto("/admin/");
		await expect(page.locator(".admin-article-list li").first()).toBeVisible();
		await page.getByRole("button", { name: "站点设置", exact: true }).click();
		await page.getByRole("button", { name: /公告/ }).click();
		await page.getByRole("button", { name: "高级源码", exact: true }).click();
		const editor = page.getByLabel("高级源码", { exact: true });
		await editor.fill(
			"export const announcementConfig: { text: string } = { text: 42 };\n",
		);
		await page.getByRole("button", { name: "保存配置", exact: true }).click();
		await expect(page.locator(".admin-diagnostics")).toContainText(
			"not assignable",
			{ timeout: 45000 },
		);
		expect(await readFile(path, "utf8")).toBe(original);
		page.on("dialog", (dialog) => void dialog.accept());
		await page.getByRole("button", { name: "表单编辑", exact: true }).click();
		await page
			.getByLabel("公告正文", { exact: true })
			.fill("Admin settings smoke test");
		await page.getByRole("button", { name: "保存配置", exact: true }).click();
		await expect
			.poll(async () => readFile(path, "utf8"), { timeout: 45000 })
			.toContain("Admin settings smoke test");
	} finally {
		await writeFile(path, original);
	}
});

for (const theme of ["light", "dark"]) {
	test(`settings cards and form accessibility ${theme}`, async ({ page }) => {
		await page.addInitScript(
			(mode) => localStorage.setItem("theme", mode),
			theme,
		);
		await page.goto("/admin/");
		await expect(page.locator(".admin-article-list li").first()).toBeVisible();
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
		await page.getByRole("button", { name: "功能与页面", exact: true }).click();
		await expect(page.getByRole("button", { name: /评论系统/ })).toBeEnabled();
		expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
		if (theme === "light")
			await page.screenshot({
				path: "../output/shirone-admin-settings.png",
				fullPage: true,
			});
		await page.getByRole("button", { name: /评论系统/ }).click();
		await expect(
			page.getByRole("checkbox", { name: "是否启用", exact: true }),
		).toBeVisible();
		expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
		if (theme === "light")
			await page.screenshot({
				path: "../output/shirone-admin-config-form.png",
				fullPage: true,
			});
	});
}
