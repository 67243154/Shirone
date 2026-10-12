import { expect, test } from "@playwright/test";

test("dynamic local music covers load and real audio can seek across navigation", async ({
	page,
}) => {
	await page.route("**/meting/**", (route) =>
		route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
	);
	await page.goto("/");
	const player = page.locator("[data-music-player]").first();
	const cover = player.locator(".music-player__cover img");
	await expect(cover).toHaveAttribute("src", /\/__content\/assets\//);
	await expect
		.poll(() =>
			cover.evaluate((image) => (image as HTMLImageElement).naturalWidth),
		)
		.toBeGreaterThan(0);
	await player.getByRole("button", { name: "播放", exact: true }).click();
	const progress = player.getByRole("slider", { name: /播放进度/ });
	await expect.poll(async () => Number(await progress.inputValue()), { timeout: 15000 }).toBeGreaterThan(0);
	await expect.poll(() => progress.getAttribute("max")).not.toBe("0");
	await progress.evaluate((input) => {
		const slider = input as HTMLInputElement;
		slider.value = "120";
		slider.dispatchEvent(new Event("input", { bubbles: true }));
		slider.dispatchEvent(new Event("change", { bubbles: true }));
	});
	await expect
		.poll(async () => Number(await progress.inputValue()), { timeout: 15000 })
		.toBeGreaterThan(115);
	await expect(
		player.getByRole("button", { name: "暂停", exact: true }),
	).toBeVisible();
	await page.locator('a[href="/archive/"]').first().click();
	await expect(page).toHaveURL(/\/archive\//);
	await expect
		.poll(() =>
			cover.evaluate((image) => (image as HTMLImageElement).naturalWidth),
		)
		.toBeGreaterThan(0);
	await expect
		.poll(async () => Number(await progress.inputValue()))
		.toBeGreaterThan(115);
});
