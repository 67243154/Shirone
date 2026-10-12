import { spawn } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [output] = process.argv.slice(2);
if (!output) throw new Error("A release output directory is required");
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const stagingRoot = join(projectRoot, ".shirones");
await mkdir(stagingRoot, { recursive: true });
// systemd binds the source and public roots as separate writable mounts.
// Astro renames prerender assets, so its build output must stay on the source mount.
const staging = await mkdtemp(join(stagingRoot, "release-"));
const pnpm =
	process.env.SHIRONE_ADMIN_PNPM ??
	(process.platform === "win32" ? "pnpm.cmd" : "pnpm");
try {
	for (const args of [
		["exec", "astro", "build", "--outDir", staging],
		["exec", "pagefind", "--site", staging],
	]) {
		await new Promise((done, reject) => {
			const child = spawn(pnpm, args, {
				cwd: projectRoot,
				stdio: "inherit",
				shell: process.platform === "win32",
			});
			child.once("error", reject);
			child.once("exit", (code) =>
				code === 0 ? done() : reject(new Error(`Build step exited ${code}`)),
			);
		});
	}
	// Copy works across mount boundaries; the publisher activates only after validation.
	await cp(staging, resolve(output), { recursive: true });
	await chmod(resolve(output), 0o755);
} finally {
	await rm(staging, { recursive: true, force: true });
}
