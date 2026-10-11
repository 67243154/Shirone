import { test as base, expect } from "@playwright/test";

/** Authenticate against the isolated test server; never set the real admin password. */
export const test = base.extend({
	page: async ({ page, baseURL }, use) => {
		const password = process.env.SHIRONE_ADMIN_E2E_PASSWORD;
		if (!password) throw new Error("Use playwright.admin.config.ts for isolated, authenticated admin tests.");
		const state = await (await page.request.get("/__admin/api/auth/status")).json();
		const response = await page.request.post(`/__admin/api/auth/${state.configured ? "login" : "setup"}`, { data: { password }, headers: { Origin: baseURL! } });
		expect(response.ok()).toBe(true);
		await use(page);
	},
});
export { expect };
