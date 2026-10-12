import { expect, test } from "./admin-fixtures";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";

test("upload avatar, banner list and object image fields with paths collapsed", async ({
	page,
}) => {
	const buffer = await sharp({
		create: { width: 3, height: 2, channels: 4, background: "#724d92" },
	})
		.png()
		.toBuffer();
	const file = { name: "chosen-avatar.png", mimeType: "image/png", buffer };
	await page.goto("/admin/");
	await page.getByRole("button", { name: "站点设置", exact: true }).click();
	await page.getByRole("button", { name: /个人资料与社交链接/ }).click();
	const avatar = page.locator('[data-field-path="profileConfig.avatar"]');
	await expect(avatar.locator(".admin-image-path input")).not.toBeVisible();
	let release!: () => void;
	const gate = new Promise<void>((done) => {
		release = done;
	});
	await page.route(
		"**/__admin/api/upload-image",
		async (route) => {
			await gate;
			await route.continue();
		},
		{ times: 1 },
	);
	await avatar.locator("input[type=file]").setInputFiles(file);
	await expect(
		page.getByRole("button", { name: "保存配置", exact: true }),
	).toBeDisabled();
	const uploaded = page.waitForResponse(
		(response) =>
			response.url().endsWith("/__admin/api/upload-image") &&
			response.status() === 200,
	);
	release();
	const result = await (await uploaded).json();
	await expect
		.poll(() =>
			avatar
				.locator("img")
				.evaluate((image) => (image as HTMLImageElement).naturalWidth),
		)
		.toBe(3);
	const publicImage = await page.request.get(result.path);
	expect(publicImage.status()).toBe(200);
	expect(publicImage.headers()["content-type"]).toBe("image/webp");
	await page.getByRole("button", { name: "保存配置", exact: true }).click();
	await expect(
		page.getByText("已保存，下次访问将读取最新内容。", { exact: true }),
	).toBeVisible({ timeout: 20000 });
	const session = await (await page.request.get("/__admin/api/session")).json();
	const profile = await (
		await page.request.get("/__admin/api/document?id=profile", {
			headers: { "X-Shirone-Admin": session.token },
		})
	).json();
	expect(
		profile.fields.find(
			(field: { path: string }) => field.path === "profileConfig.avatar",
		).value,
	).toBe(result.path);
	const previous = await avatar.locator("img").getAttribute("src");
	await avatar.locator("input[type=file]").setInputFiles({
		name: "bad.png",
		mimeType: "image/png",
		buffer: Buffer.from("not an image"),
	});
	await expect(avatar.getByRole("alert")).toContainText("请选择有效");
	await expect(avatar.locator("img")).toHaveAttribute("src", previous!);
	await page.getByRole("button", { name: "返回栏目列表", exact: true }).click();
	await page.getByRole("button", { name: /站点基础与主题/ }).click();
	const banners = page.locator(
		'[data-field-path="siteConfig.banner.src.desktop"]',
	);
	const originalBannerCount = await banners
		.locator(".admin-array-item")
		.count();
	const append = banners.locator(".admin-image-field").last();
	await append
		.locator("input[type=file]")
		.setInputFiles([file, { ...file, name: "second.png" }]);
	await expect(banners.locator(".admin-array-item")).toHaveCount(
		originalBannerCount + 2,
	);
	await expect(
		banners.locator(".admin-image-path input").first(),
	).not.toBeVisible();
	await page.getByRole("button", { name: "保存配置", exact: true }).click();
	await expect(
		page.getByText("已保存，下次访问将读取最新内容。", { exact: true }),
	).toBeVisible({ timeout: 20000 });
	await page.getByRole("button", { name: "内容数据", exact: true }).click();
	await page.getByRole("button", { name: /友情链接/ }).click();
	const friend = page.locator('[data-field-path="friendsData[0].imgurl"]');
	if (!(await friend.isVisible()))
		await friend
			.locator("xpath=ancestor::details[1]")
			.locator("summary")
			.first()
			.click();
	await friend.locator("input[type=file]").setInputFiles(file);
	await expect
		.poll(() =>
			friend
				.locator("img")
				.evaluate((image) => (image as HTMLImageElement).naturalWidth),
		)
		.toBe(3);
	await expect(friend.locator(".admin-image-path input")).not.toBeVisible();
	expect(
		(
			await new AxeBuilder({ page })
				.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
				.analyze()
		).violations,
	).toEqual([]);
	await page.screenshot({
		path: "../output/admin-image-upload.png",
		fullPage: false,
	});
});
