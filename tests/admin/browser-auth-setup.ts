import { access, unlink } from "node:fs/promises";
import { resolve } from "node:path";

export default async function setup(): Promise<() => Promise<void>> {
	try { await access(resolve(".env.shirone-admin-test-auth")); }
	catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		return async () => { await unlink(resolve(".env.shirone-admin-test-auth")).catch(error => { if (error.code !== "ENOENT") throw error; }); };
	}
	throw new Error("A stale .env.shirone-admin-test-auth exists. Resolve it before running isolated admin tests.");
}
