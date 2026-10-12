import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

process.env.SHIRONE_ADMIN_E2E_PASSWORD ??=
	randomBytes(12).toString("base64url");
export default defineConfig({
	...config,
	timeout: 120000,
	globalSetup: "./tests/runtime/browser-setup.ts",
	use: {
		...config.use,
		channel: process.platform === "win32" ? "msedge" : config.use?.channel,
		baseURL: "http://127.0.0.1:4327",
	},
	webServer: {
		command: "node .shirones/dynamic-server.mjs",
		url: "http://127.0.0.1:4327",
		reuseExistingServer: false,
		env: {
			SHIRONE_RUNTIME_PORT: "4327",
			SHIRONE_ADMIN_AUTH_TEST: "1",
			ASTRO_TELEMETRY_DISABLED: "1",
			HTTP_PROXY: "",
			HTTPS_PROXY: "",
			ALL_PROXY: "",
		},
	},
});
