import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
import { randomBytes } from "node:crypto";

process.env.SHIRONE_ADMIN_E2E_PASSWORD ??= randomBytes(12).toString("base64url");

/** Local authoring tests use the loopback-only API and Windows' installed Edge. */
export default defineConfig({
	...config,
	timeout: 120_000,
	globalSetup: "./tests/admin/browser-auth-setup.ts",
	use: {
		...config.use,
		channel: process.platform === "win32" ? "msedge" : config.use?.channel,
		baseURL: "http://127.0.0.1:4323",
	},
	webServer: {
		...config.webServer,
		command:
			process.platform === "win32"
				? "pnpm.cmd dev --host 127.0.0.1 --port 4323 --ignore-lock"
				: "pnpm dev --host 127.0.0.1 --port 4323 --ignore-lock",
		url: "http://127.0.0.1:4323",
		reuseExistingServer: false,
		env: { ASTRO_DEV_BACKGROUND: "false", SHIRONE_ADMIN_AUTH_TEST: "1", HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "", ASTRO_TELEMETRY_DISABLED: "1" },
	},
});
