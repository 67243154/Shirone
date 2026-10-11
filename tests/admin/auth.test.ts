import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AdminAuthError, adminSessionCookie, createAdminAuth } from "../../src/integration/vite/admin-auth.ts";

test("passwords are salted/hashed; sessions expire and revoke; incorrect attempts are throttled", async () => {
	const root = await mkdtemp(join(tmpdir(), "shirone-auth-"));
	try {
		const file = join(root, "auth.json"), secret = randomBytes(12).toString("base64url");
		let time = Date.now();
		const auth = createAdminAuth(file, () => time);
		assert.equal(await auth.configured(), false);
		await assert.rejects(auth.setup("short"), (error: AdminAuthError) => error.code === "passwordInvalid");
		await assert.rejects(auth.setup("x".repeat(21)), (error: AdminAuthError) => error.code === "passwordInvalid");
		const session = await auth.setup(secret);
		assert.equal(auth.authenticated(session), true);
		const stored = await readFile(file, "utf8");
		assert.equal(stored.includes(secret), false);
		assert.equal(stored.includes(session), false);
		assert.equal(JSON.parse(stored).hash.length, 128);
		const restarted = createAdminAuth(file);
		assert.equal(await restarted.configured(), true);
		assert.equal(restarted.authenticated(session), false);
		await assert.rejects(auth.setup(secret), (error: AdminAuthError) => error.code === "alreadyConfigured");
		auth.logout(session); assert.equal(auth.authenticated(session), false);
		const loggedIn = await auth.login(secret);
		assert.match(adminSessionCookie(loggedIn), /HttpOnly; SameSite=Strict/);
		time += 8 * 60 * 60 * 1000 + 1;
		assert.equal(auth.authenticated(loggedIn), false);
		for (let i = 0; i < 5; i++) await assert.rejects(auth.login("wrong-password"), (error: AdminAuthError) => error.code === "credentials");
		await assert.rejects(auth.login(secret), (error: AdminAuthError) => error.status === 429);
		time += 10 * 60 * 1000 + 1;
		assert.equal(auth.authenticated(await auth.login(secret)), true);
		assert.equal(await readFile(file, "utf8"), stored);
	} finally { await rm(root, { recursive: true, force: true }); }
});

test("6 and 20 character passwords can be set and verified", async () => {
	const root = await mkdtemp(join(tmpdir(), "shirone-auth-length-"));
	try {
		for (const length of [6, 20]) {
			const secret = randomBytes(20).toString("hex").slice(0, length);
			const auth = createAdminAuth(join(root, `${length}.json`));
			await auth.setup(secret);
			assert.equal(auth.authenticated(await auth.login(secret)), true);
		}
	} finally { await rm(root, { recursive: true, force: true }); }
});
