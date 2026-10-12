import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../../", import.meta.url));
const command = process.argv[2] ?? "start";
const env = {
	...process.env,
	SHIRONE_DYNAMIC: "1",
	SHIRONE_RUNTIME_PROJECT: root,
	ASTRO_TELEMETRY_DISABLED: "1",
};
if (command === "build") {
	await run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
		"exec",
		"astro",
		"build",
		"--outDir",
		".shirones/dynamic-dist",
	]);
	await build({
		entryPoints: [resolve(root, "scripts/runtime/server.mjs")],
		outfile: resolve(root, ".shirones/dynamic-server.mjs"),
		bundle: true,
		platform: "node",
		format: "esm",
		packages: "external",
		target: "node24",
	});
} else if (command === "dev") {
	await run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
		"dev",
		"--host",
		"127.0.0.1",
		"--port",
		"4326",
	]);
} else if (command === "start") {
	await run(process.execPath, [resolve(root, ".shirones/dynamic-server.mjs")]);
} else throw new Error("Use build, dev or start");

async function run(executable, args) {
	await new Promise((done, reject) => {
		const child = spawn(executable, args, {
			cwd: root,
			env,
			stdio: "inherit",
			shell: process.platform === "win32" && executable.endsWith(".cmd"),
		});
		child.once("error", reject);
		child.once("exit", (code) =>
			code === 0 ? done() : reject(new Error(`Command failed: ${code}`)),
		);
	});
}
