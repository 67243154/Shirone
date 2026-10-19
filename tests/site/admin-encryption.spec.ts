import { test, expect } from "./admin-fixtures";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";

test("admin enables, preserves, rotates and disables post encryption in production SSR", async ({
	page,
}) => {
	const slug = `admin-encryption-${Date.now()}`;
	const file = resolve("src/content/posts", `${slug}.md`);
	const secretBody = `Secret body ${slug}`;
	const firstPassword = "Test-only-pass1";
	const nextPassword = "Test-only-pass2";
	try {
		await page.goto("/admin/", { waitUntil: "domcontentloaded" });
		await page.getByRole("button", { name: "新建文章", exact: true }).click();
		await page
			.getByLabel("文章标题", { exact: true })
			.fill("Encryption browser test");
		await page.getByLabel("文件名（小写字母、数字和连字符）").fill(slug);
		await page.getByLabel("Markdown 正文").fill(secretBody);
		await page.getByLabel("保存为草稿", { exact: true }).locator("..").click();
		await expect(
			page.getByLabel("保存为草稿", { exact: true }),
		).not.toBeChecked();
		await page
			.getByLabel("启用文章加密", { exact: true })
			.locator("..")
			.click();
		await expect(
			page.getByLabel("启用文章加密", { exact: true }),
		).toBeChecked();
		await page.getByLabel("文章密码", { exact: true }).fill(firstPassword);
		await page.getByLabel("密码提示（可选）").fill("Test hint");
		const saved = page.waitForResponse(
			(response) =>
				response.url().endsWith("/__admin/api/post") &&
				response.request().method() === "POST",
		);
		await page.getByRole("button", { name: "保存文章", exact: true }).click();
		const data = await (await saved).json();
		expect(data.encrypted).toBe(true);
		expect(data.hasPassword).toBe(true);
		expect(data.password).toBe(firstPassword);
		const visitor = await page.context().browser()!.newContext({baseURL:new URL(page.url()).origin});
		expect((await visitor.request.get(`/__admin/api/post?file=${slug}.md`)).status()).toBe(401);
		await visitor.close();
		await expect(page.getByLabel("文章密码", { exact: true })).toHaveValue(
			firstPassword,
		);
		await expect(page.getByLabel("文章密码", { exact: true })).toHaveAttribute(
			"type",
			"text",
		);
		await expect(
			page.getByText(
				"密码已保存。这里可直接查看和修改；清空后保存会保留原密码。",
				{ exact: true },
			),
		).toBeVisible();
		const html = await (await page.request.get(`/posts/${slug}/`)).text();
		expect(html).not.toContain(secretBody);
		expect(html).not.toContain(firstPassword);
		const axe = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
			.analyze();
		expect(axe.violations).toEqual([]);
		await page
			.getByLabel("文章标题", { exact: true })
			.fill("Renamed encrypted test");
		await page.getByLabel("文章密码", { exact: true }).fill("");
		await page.getByRole("button", { name: "保存文章", exact: true }).click();
		await expect(page.locator(".admin-feedback[role=status]")).toBeVisible();
		expect(await readFile(file, "utf8")).toContain(firstPassword);
		await expect(page.getByLabel("文章密码", { exact: true })).toHaveValue(
			firstPassword,
		);
		await page.getByLabel("文章密码", { exact: true }).fill(nextPassword);
		const rotated = page.waitForResponse(
			(response) =>
				response.url().endsWith("/__admin/api/post") &&
				response.request().method() === "POST",
		);
		await page.getByRole("button", { name: "保存文章", exact: true }).click();
		expect((await (await rotated).json()).hasPassword).toBe(true);
		const insecureReader = await page.context().newPage();
		await insecureReader.addInitScript(() =>
			Object.defineProperty(globalThis.crypto, "subtle", {
				value: undefined,
				configurable: true,
			}),
		);
		await insecureReader.goto(`/posts/${slug}/`, {
			waitUntil: "domcontentloaded",
		});
		await insecureReader
			.locator(".password-gate input[type=password]")
			.fill(nextPassword);
		await insecureReader.locator(".password-gate button[type=submit]").click();
		await expect(
			insecureReader.locator(".password-gate .m3-text-field__error"),
		).toContainText("HTTPS");
		await insecureReader.close();
		const reader = await page.context().newPage();
		await reader.goto(`/posts/${slug}/`, { waitUntil: "domcontentloaded" });
		await reader
			.locator(".password-gate input[type=password]")
			.fill(firstPassword);
		await reader.locator(".password-gate button[type=submit]").click();
		await expect(
			reader.locator(".password-gate .m3-text-field__error"),
		).toBeVisible();
		await reader
			.locator(".password-gate input[type=password]")
			.fill(nextPassword);
		await reader.locator(".password-gate button[type=submit]").click();
		await expect(reader.locator(".markdown-content")).toContainText(secretBody);
		await reader.close();
		await page
			.getByLabel("启用文章加密", { exact: true })
			.locator("..")
			.click();
		const disabled = page.waitForResponse(
			(response) =>
				response.url().endsWith("/__admin/api/post") &&
				response.request().method() === "POST",
		);
		await page.getByRole("button", { name: "保存文章", exact: true }).click();
		expect((await (await disabled).json()).encrypted).toBe(false);
		expect(await (await page.request.get(`/posts/${slug}/`)).text()).toContain(
			secretBody,
		);
	} finally {
		await rm(file, { force: true });
	}
});
