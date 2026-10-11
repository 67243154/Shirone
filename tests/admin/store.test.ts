import assert from "node:assert/strict";
import {
	mkdtemp,
	readFile,
	rm,
	mkdir,
	writeFile,
	symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createAdminStore } from "../../src/integration/vite/admin.ts";
import type { AdminSave } from "../../src/types/admin.ts";

test("preserves unedited frontmatter/MDX, rejects stale writes and invalid paths", async () => {
	const dir = await mkdtemp(join(tmpdir(), "shirone-admin-"));
	try {
		await mkdir(join(dir, "posts"));
		const source =
			"---\ntitle: Example\npublished: 2026-10-11\nseries: original-series\npassword: secret\ncustom: keep-me\n---\n<Demo />\n";
		await writeFile(join(dir, "posts", "example.mdx"), source);
		const store = createAdminStore(dir);
		const post = await store.read("example.mdx");
		assert.equal((await store.list()).length, 1);
		assert.equal((await store.list())[0].body, undefined);
		const updated = await store.save({
			...post,
			body: post.body!,
			title: "Updated",
			create: false,
		});
		const saved = await readFile(join(dir, "posts", "example.mdx"), "utf8");
		assert.match(saved, /series: original-series/);
		assert.match(saved, /password: secret/);
		assert.match(saved, /custom: keep-me/);
		assert.match(saved, /<Demo \/>/);
		assert.match(saved, /published: 2026-10-11\r?\n/);
		assert.notEqual(updated.version, post.version);
		await assert.rejects(
			store.save({ ...post, body: post.body!, create: false }),
			/conflict/,
		);
		await assert.rejects(store.read("../outside.md"), /path/);
		await assert.rejects(store.read("example.txt"), /path/);
		const input: AdminSave = {
			...updated,
			file: "new-article.md",
			body: "# New",
			create: true,
			draft: true,
		};
		await store.save(input);
		await assert.rejects(store.save(input), /exists/);
		await assert.rejects(
			store.save({ ...input, file: "bad.md", published: "2026-02-31" }),
			/validation/,
		);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("rejects junctions that point outside the posts directory", async () => {
	const dir = await mkdtemp(join(tmpdir(), "shirone-admin-link-"));
	try {
		await mkdir(join(dir, "posts"));
		await mkdir(join(dir, "outside"));
		await writeFile(
			join(dir, "outside", "private.md"),
			"---\ntitle: Private\npublished: 2026-10-11\n---\nSecret",
		);
		await symlink(join(dir, "outside"), join(dir, "posts", "link"), "junction");
		const store = createAdminStore(dir);
		assert.equal((await store.list()).length, 0);
		await assert.rejects(store.read("link/private.md"), /path/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
