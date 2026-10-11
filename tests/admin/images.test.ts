import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readAdminImage } from "../../src/integration/vite/admin-images.ts";

test("admin images resolve source, public and post assets without exposing other files", async () => {
	const root = await mkdtemp(join(tmpdir(), "shirone-admin-images-"));
	const content = join(root, "src/content");
	try {
		for (const dir of ["public", "src/assets", "src/content/posts/example", "outside"]) await mkdir(join(root, dir), { recursive: true });
		for (const path of ["public/logo.png", "src/assets/avatar.webp", "src/content/posts/example/cover.jpeg", "outside/secret.png"]) await writeFile(join(root, path), "image fixture");
		await writeFile(join(root, "src/assets/private.ts"), "private");
		for (const [path, post] of [["/logo.png", ""], ["assets/avatar.webp", ""], ["./cover.jpeg", "example/index.md"]]) assert.equal((await readAdminImage(root, content, path, post)).body.toString(), "image fixture");
		for (const path of ["../outside/secret.png", "assets/private.ts", "https://example.com/a.png", "//example.com/a.png"]) await assert.rejects(readAdminImage(root, content, path, ""));
		await symlink(join(root, "outside"), join(root, "src/assets/escape"), "junction");
		await assert.rejects(readAdminImage(root, content, "assets/escape/secret.png", ""));
	} finally { await rm(root, { recursive: true, force: true }); }
});
