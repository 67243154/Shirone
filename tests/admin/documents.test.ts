import assert from "node:assert/strict";
import {
	mkdtemp,
	mkdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createAdminDocumentStore } from "../../src/integration/vite/admin-documents.ts";

test("config forms preserve comments/functions, validate TS and reject stale or arbitrary writes", async () => {
	const root = await mkdtemp(join(tmpdir(), "shirone-admin-config-"));
	try {
		const configDir = join(root, "config");
		await mkdir(configDir);
		await writeFile(
			join(root, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: { target: "ES2022", module: "ESNext", strict: true },
			}),
		);
		const source = `interface Config { title: string; mode: "light" | "dark"; enable: boolean; links: { name: string; url: string }[] }
export const siteConfig: Config = {
 // Preserve this documented default
 title: "Original", mode: "light", enable: true,
 links: [{ name: "Example", url: "/" }]
};
export function untouched() { return "keep"; }
`;
		await writeFile(join(configDir, "siteConfig.ts"), source);
		const store = createAdminDocumentStore({
			projectRoot: root,
			configDir,
			dataDir: join(root, "data"),
			contentDir: join(root, "content"),
			isThemeRepo: true,
		});
		assert.deepEqual(await store.list(), ["site"]);
		const doc = await store.read("site");
		const title = doc.fields.find((f) => f.path === "siteConfig.title")!;
		assert.match(title.comment, /documented/);
		const result = await store.save({
			id: "site",
			version: doc.version,
			fields: [{ id: title.id, value: "Updated" }],
		});
		assert.match(result.source, /title: "Updated"/);
		assert.match(result.source, /Preserve this documented default/);
		assert.match(result.source, /return "keep"/);
		await assert.rejects(
			store.save({ id: "site", version: doc.version, source }),
			/conflict/,
		);
		const mode = result.fields.find((f) => f.path === "siteConfig.mode")!;
		await assert.rejects(
			store.save({
				id: "site",
				version: result.version,
				fields: [{ id: mode.id, value: "invalid-enum" }],
			}),
			/validation/,
		);
		assert.equal(
			await readFile(join(configDir, "siteConfig.ts"), "utf8"),
			result.source,
		);
		const links = result.fields.find((f) => f.kind === "json")!;
		const updated = await store.save({
			id: "site",
			version: result.version,
			fields: [
				{
					id: links.id,
					value: JSON.stringify([{ name: "New", url: "/new/" }]),
				},
			],
		});
		assert.match(updated.source, /\/new\//);
		await assert.rejects(
			store.save({
				id: "site",
				version: updated.version,
				source: "export const broken = {",
			}),
			/validation/,
		);
		await assert.rejects(store.read("../site"), /path/);
		await assert.rejects(
			store.save({
				id: "site",
				version: updated.version,
				fields: [{ id: "9999", value: "ignored" }],
			}),
			/validation/,
		);
		await assert.rejects(
			store.save({
				id: "site",
				version: updated.version,
				fields: [
					{ id: title.id, value: "A" },
					{ id: title.id, value: "B" },
				],
			}),
			/validation/,
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("document sources stay within configured directories and npm integration copy is read-only", async () => {
	const root = await mkdtemp(join(tmpdir(), "shirone-admin-boundary-"));
	try {
		const configDir = join(root, "config"),
			outside = join(root, "outside");
		await mkdir(configDir);
		await mkdir(outside);
		await writeFile(
			join(outside, "friends.ts"),
			"export const friendsData = [];",
		);
		const dataDir = join(root, "data");
		await symlink(outside, dataDir, "junction");
		await writeFile(
			join(configDir, "integrationsConfig.ts"),
			"export const integrationsConfig = {};",
		);
		const store = createAdminDocumentStore({
			projectRoot: root,
			configDir,
			dataDir,
			contentDir: root,
			isThemeRepo: false,
		});
		await assert.rejects(store.read("data-friends"), /path/);
		const doc = await store.read("integrations");
		assert.equal(doc.readonly, true);
		await assert.rejects(
			store.save({ id: doc.id, version: doc.version, source: doc.source }),
			/readonly/,
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
