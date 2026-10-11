import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, mkdir, rename, symlink, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Build a fresh release; replace the public symlink only after every check passes. */
export function createPublisher({ projectRoot, publicRoot, pnpm, runBuild }) {
	let pending = Promise.resolve();
	return () => {
		const task = pending.then(async () => {
			const release = join(
				resolve(publicRoot),
				"releases",
				`${Date.now()}-${randomBytes(6).toString("hex")}`,
			);
			await mkdir(release, { recursive: true, mode: 0o755 });
			if (runBuild) await runBuild(release);
			else
				await new Promise((done, reject) => {
					const child = spawn(
						process.execPath,
						["scripts/admin/build-site.mjs", release],
						{
							cwd: projectRoot,
							detached: process.platform !== "win32",
							env: {
								...process.env,
								NODE_OPTIONS:
									process.env.NODE_OPTIONS ?? "--max-old-space-size=1024",
								UV_THREADPOOL_SIZE: "2",
								VIPS_CONCURRENCY: "1",
								MALLOC_ARENA_MAX: "2",
								SHIRONE_ADMIN_PNPM: pnpm,
								SHIRONE_REMOTE_ADMIN: "1",
								ASTRO_TELEMETRY_DISABLED: "1",
							},
							stdio: ["ignore", "pipe", "pipe"],
						},
					);
					child.stdout.pipe(process.stdout);
					child.stderr.pipe(process.stderr);
					const timer = setTimeout(() => {
						if (process.platform === "win32") child.kill("SIGTERM");
						else {
							try {
								process.kill(-child.pid, "SIGTERM");
							} catch {}
						}
						reject(new Error("Publication timed out"));
					}, 480000);
					child.once("error", (error) => {
						clearTimeout(timer);
						reject(error);
					});
					child.once("exit", (code) => {
						clearTimeout(timer);
						code === 0 ? done() : reject(new Error(`Build exited ${code}`));
					});
				});
			await access(join(release, "index.html"));
			await access(join(release, "admin", "index.html"));
			await access(join(release, "pagefind", "pagefind.js"));
			const temporary = join(
				publicRoot,
				`.current-${randomBytes(6).toString("hex")}`,
			);
			try {
				await symlink(release, temporary, "dir");
				await rename(temporary, join(publicRoot, "current"));
			} finally {
				await unlink(temporary).catch(() => {});
			}
		});
		pending = task.catch(() => {});
		return task;
	};
}
