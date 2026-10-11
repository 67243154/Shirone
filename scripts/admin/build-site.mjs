import { spawn } from "node:child_process";
import { resolve } from "node:path";

const [output] = process.argv.slice(2);
if (!output) throw new Error("A release output directory is required");
const pnpm =
	process.env.SHIRONE_ADMIN_PNPM ??
	(process.platform === "win32" ? "pnpm.cmd" : "pnpm");
for (const args of [
	["exec", "astro", "build", "--outDir", resolve(output)],
	["exec", "pagefind", "--site", resolve(output)],
]) {
	await new Promise((done, reject) => {
		const child = spawn(pnpm, args, {
			stdio: "inherit",
			shell: process.platform === "win32",
		});
		child.once("error", reject);
		child.once("exit", (code) =>
			code === 0 ? done() : reject(new Error(`Build step exited ${code}`)),
		);
	});
}
