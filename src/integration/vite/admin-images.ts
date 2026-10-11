import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";

const types: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".avif": "image/avif",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};
const inside = (root: string, file: string): boolean => {
	const path = relative(root, file);
	return (
		!isAbsolute(path) &&
		path !== ".." &&
		!path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
	);
};

/** Serve only image files within author-owned asset roots. Never fetch remote URLs. */
export async function readAdminImage(
	projectRoot: string,
	contentDir: string,
	input: string,
	post: string,
): Promise<{ body: Buffer; type: string }> {
	const path = input.replace(/\\/g, "/").split(/[?#]/)[0];
	if (
		!path ||
		path.includes("\0") ||
		/^[a-z][a-z\d+.-]*:/i.test(path) ||
		path.startsWith("//")
	)
		throw new Error("image");
	const publicRoot = resolve(projectRoot, "public");
	const sourceRoot = resolve(projectRoot, "src");
	const postsRoot = resolve(contentDir, "posts");
	const root =
		path.startsWith("/") && !path.startsWith("/src/")
			? publicRoot
			: post &&
					!path.startsWith("assets/") &&
					!path.startsWith("src/") &&
					!path.startsWith("/src/") &&
					!path.startsWith("@/")
				? postsRoot
				: sourceRoot;
	const base = root === postsRoot ? dirname(resolve(postsRoot, post)) : root;
	if (!inside(root, base)) throw new Error("image");
	const file = resolve(base, path.replace(/^(?:\/src\/|src\/|@\/|\/)/, ""));
	if (!inside(root, file) || !types[extname(file).toLowerCase()])
		throw new Error("image");
	const [realRoot, realFile] = await Promise.all([
		realpath(root),
		realpath(file),
	]);
	if (!inside(realRoot, realFile)) throw new Error("image");
	const info = await stat(realFile);
	if (!info.isFile() || info.size > 20 * 1024 * 1024) throw new Error("image");
	return {
		body: await readFile(realFile),
		type: types[extname(file).toLowerCase()],
	};
}
