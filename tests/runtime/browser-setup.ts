import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import setupAuth from "../admin/browser-auth-setup";

export default async function setup(): Promise<() => Promise<void>> {
	const cleanAuth = await setupAuth();
	const file = resolve(".shirones/runtime/settings.json");
	let before: Buffer | undefined;
	try {
		before = await readFile(file);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	return async () => {
		if (before) await writeFile(file, before);
		else await rm(file, { force: true });
		await cleanAuth();
	};
}
