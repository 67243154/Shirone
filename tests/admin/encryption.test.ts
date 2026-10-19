import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createAdminStore } from "../../src/integration/vite/admin.ts";
import type { AdminSave } from "../../src/types/admin.ts";

test("encryption settings preserve passwords, show owner details and omit passwords from lists", async () => {
	const root = await mkdtemp(join(tmpdir(), "shirone-encryption-"));
	try {
		const store = createAdminStore(root);
		const input: AdminSave = {
			file: "encrypted.md",
			create: true,
			title: "Encrypted test",
			published: "2026-10-12",
			description: "",
			category: "",
			tags: [],
			image: "",
			draft: true,
			pinned: false,
			body: "Protected text",
			encrypted: true,
			passwordHint: "Test hint",
		};
		await assert.rejects(store.save(input), /encryptionPasswordRequired/);
		for (const password of ["short", "a".repeat(21), "      "])
			await assert.rejects(
				store.save({ ...input, password }),
				/encryptionPasswordInvalid/,
			);
		const saved = await store.save({ ...input, password: "first-test-pass" });
		assert.equal(saved.encrypted, true);
		assert.equal(saved.hasPassword, true);
		assert.equal(saved.password, "first-test-pass");
		assert.equal(
			JSON.stringify(await store.list()).includes("first-test-pass"),
			false,
		);
		const kept = await store.save({
			...saved,
			body: saved.body!,
			create: false,
			password: "",
			title: "Changed title",
		});
		assert.match(
			await readFile(join(root, "posts/encrypted.md"), "utf8"),
			/password: first-test-pass/,
		);
		const replaced = await store.save({
			...kept,
			body: kept.body!,
			create: false,
			password: "second-test-pass",
		});
		const source = await readFile(join(root, "posts/encrypted.md"), "utf8");
		assert.match(source, /password: second-test-pass/);
		assert(!source.includes("first-test-pass"));
		assert.equal(
			JSON.stringify(await store.read("encrypted.md")).includes(
				"second-test-pass",
			),
			true,
		);
		await assert.rejects(
			store.save({
				...kept,
				body: kept.body!,
				create: false,
				password: "third-test-pass",
			}),
			/conflict/,
		);
		const disabled = await store.save({
			...replaced,
			body: replaced.body!,
			create: false,
			encrypted: false,
			password: "",
		});
		assert.equal(disabled.encrypted, false);
		assert.equal(disabled.hasPassword, false);
		assert(
			!/^password:/m.test(
				await readFile(join(root, "posts/encrypted.md"), "utf8"),
			),
		);
		await assert.rejects(
			store.save({
				...disabled,
				body: disabled.body!,
				create: false,
				encrypted: true,
				password: "",
			}),
			/encryptionPasswordRequired/,
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
