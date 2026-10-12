import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readRuntimeEntries } from "../../src/runtime/files.ts";
import {
	readRuntimeState,
	runtimeExport,
	withRuntimeState,
} from "../../src/runtime/settings-server.ts";
import { createRuntimeDocumentStore } from "../../src/runtime/settings-store.ts";

test("runtime configuration is atomic, persistent, typed and preserves source; stale/source writes are refused", async () => {
	const root = await mkdtemp(join(tmpdir(), "shirone-runtime-settings-"));
	const configDir = join(root, "config");
	await mkdir(configDir);
	const baseline =
		'export const siteConfig: { title: string; site: string; base: string } = { title: "Initial", site: "https://example.com/", base: "/" };\n';
	await writeFile(join(configDir, "siteConfig.ts"), baseline);
	await writeFile(
		join(root, "tsconfig.json"),
		'{"compilerOptions":{"target":"ES2022","module":"ESNext","strict":true}}',
	);
	const paths = {
		projectRoot: root,
		configDir,
		dataDir: root,
		contentDir: root,
		isThemeRepo: true,
	};
	try {
		const store = createRuntimeDocumentStore(paths);
		const first = await store.read("site");
		const title = first.fields.find(
			(field) => field.path === "siteConfig.title",
		);
		assert.ok(title);
		await assert.rejects(
			store.save({ id: "site", version: first.version, source: baseline }),
			/deploymentRequired/,
		);
		await assert.rejects(
			store.save({
				id: "site",
				version: first.version,
				fields: [{ id: title.id, value: 123 }],
			}),
			/validation/,
		);
		const saved = await store.save({
			id: "site",
			version: first.version,
			fields: [{ id: title.id, value: "Live title" }],
		});
		assert.equal(
			await readFile(join(configDir, "siteConfig.ts"), "utf8"),
			baseline,
		);
		assert.equal(
			await readFile(
				join(root, ".shirones/runtime/backups/site.source"),
				"utf8",
			),
			baseline,
		);
		assert.match(saved.source, /Live title/);
		await assert.rejects(
			store.save({
				id: "site",
				version: first.version,
				fields: [{ id: title.id, value: "Stale" }],
			}),
			/conflict/,
		);
		assert.match(
			(await createRuntimeDocumentStore(paths).read("site")).source,
			/Live title/,
		);
		const config = runtimeExport("site", "siteConfig", {
			title: "Initial",
			site: "https://example.com/",
			base: "/",
		});
		withRuntimeState(readRuntimeState(root), () =>
			assert.equal(config.title, "Live title"),
		);
		assert.equal(config.title, "Initial");
		const current = await store.read("site");
		const base = current.fields.find(
			(field) => field.path === "siteConfig.base",
		);
		assert.ok(base);
		await assert.rejects(
			store.save({
				id: "site",
				version: current.version,
				fields: [{ id: base.id, value: "/changed/" }],
			}),
			/deploymentRequired/,
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runtime content updates without module reload; drafts never enter public collections", async () => {
	const root = await mkdtemp(join(tmpdir(), "shirone-runtime-content-"));
	await mkdir(join(root, "posts"));
	const file = join(root, "posts/one.md");
	try {
		await writeFile(
			file,
			"---\ntitle: First\npublished: 2026-10-12\n---\nFirst body",
		);
		await writeFile(
			join(root, "posts/draft.md"),
			"---\ntitle: Secret draft\ndraft: true\n---\nPrivate body",
		);
		assert.equal((await readRuntimeEntries(root, "posts")).length, 1);
		const first = (await readRuntimeEntries(root, "posts"))[0];
		first.data.title = "Mutated cache";
		assert.equal(
			(await readRuntimeEntries(root, "posts"))[0].data.title,
			"First",
		);
		await writeFile(
			file,
			"---\ntitle: Updated\npublished: 2026-10-12\n---\nChanged body",
		);
		assert.equal(
			(await readRuntimeEntries(root, "posts"))[0].data.title,
			"Updated",
		);
		await rm(file);
		assert.deepEqual(await readRuntimeEntries(root, "posts"), []);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
