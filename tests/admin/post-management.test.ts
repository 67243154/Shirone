import assert from "node:assert/strict";
import {
	mkdtemp,
	mkdir,
	readFile,
	readdir,
	rm,
	writeFile,
	symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createAdminStore } from "../../src/integration/vite/admin.ts";

test("batch status preserves MDX, rejects conflicts before mutation and backs up deletion", async () => {
	const dir = await mkdtemp(join(tmpdir(), "shirone-management-"));
	try {
		await mkdir(join(dir, "content/posts/nested"), { recursive: true });
		const source =
			"---\ntitle: Test\npublished: 2026-10-13\ncustom: retained\npassword: test-only\npermalink: /custom/\n---\n<Demo />\n";
		await writeFile(join(dir, "content/posts/nested/a.mdx"), source);
		await writeFile(join(dir, "content/posts/b.md"), source);
		const store = createAdminStore(join(dir, "content"), join(dir, "backups"));
		const refs = (await store.list()).map(({ file, version }) => ({
			file,
			version,
		}));
		await assert.rejects(
			store.batch({
				action: "delete",
				posts: [refs[0], { ...refs[1], version: "stale" }],
			}),
			/conflict/,
		);
		assert.equal((await store.list()).length, 2);
		await assert.rejects(
			store.batch({ action: "delete", posts: [refs[0], refs[0]] }),
			/validation/,
		);
		await assert.rejects(
			store.batch({
				action: "delete",
				posts: [{ file: "../outside.md", version: "x" }],
			}),
			/path/,
		);
		await assert.rejects(
			store.batch({
				action: "delete",
				posts: [
					{
						file: "nested/../b.md",
						version: refs.find((p) => p.file === "b.md")!.version,
					},
				],
			}),
			/path/,
		);
		await assert.rejects(
			store.batch({ action: "delete", posts: [] }),
			/validation/,
		);
		assert.deepEqual(await store.batch({ action: "draft", posts: refs }), {
			count: 2,
		});
		assert.ok((await store.list()).every((p) => p.draft));
		const saved = await readFile(
			join(dir, "content/posts/nested/a.mdx"),
			"utf8",
		);
		for (const text of [
			"custom: retained",
			"password: test-only",
			"permalink: /custom/",
			"<Demo />",
		])
			assert.ok(saved.includes(text));
		assert.ok(!("password" in (await store.list())[0]));
		const draftRefs = (await store.list()).map(({ file, version }) => ({
			file,
			version,
		}));
		await store.batch({ action: "publish", posts: draftRefs });
		assert.ok((await store.list()).every((p) => !p.draft));
		const current = (await store.list()).map(({ file, version }) => ({
			file,
			version,
		}));
		await store.batch({ action: "delete", posts: current });
		assert.equal((await store.list()).length, 0);
		const batches = await readdir(join(dir, "backups"));
		assert.equal(batches.length, 3);
		const originals = await Promise.all(
			batches.map((folder) =>
				readFile(join(dir, "backups", folder, "nested/a.mdx"), "utf8"),
			),
		);
		assert.ok(originals.includes(source));
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("batch rejects symbolic links and rolls back a failed multi-file deletion", async () => {
	const dir = await mkdtemp(join(tmpdir(), "shirone-management-"));
	try {
		await mkdir(join(dir, "content/posts/a.md.removed"), { recursive: true });
		const source = "---\ntitle: Test\npublished: 2026-10-13\n---\nBody\n";
		await writeFile(join(dir, "content/posts/a.md"), source);
		await writeFile(join(dir, "content/posts/a.md.removed/b.md"), source);
		const store = createAdminStore(join(dir, "content"), join(dir, "backups"));
		const first = await store.read("a.md.removed/b.md"),
			second = await store.read("a.md");
		await assert.rejects(
			store.batch({ action: "delete", posts: [first, second] }),
		);
		assert.equal(
			await readFile(join(dir, "content/posts/a.md.removed/b.md"), "utf8"),
			source,
		);
		assert.equal(
			await readFile(join(dir, "content/posts/a.md"), "utf8"),
			source,
		);
		await symlink(
			join(dir, "content/posts/a.md.removed"),
			join(dir, "content/posts/link"),
			process.platform === "win32" ? "junction" : "dir",
		);
		await assert.rejects(
			store.batch({
				action: "delete",
				posts: [{ file: "link/b.md", version: first.version }],
			}),
			/path/,
		);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
