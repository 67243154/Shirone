import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createAdminMiddleware } from "../../src/integration/vite/admin.ts";
import { createRuntimePostValidator } from "../../src/runtime/post-validation.ts";
import { createRuntimeDocumentStore } from "../../src/runtime/settings-store.ts";
import { sendStaticFile } from "./static-file.mjs";

const root = resolve(process.env.SHIRONE_RUNTIME_PROJECT ?? process.cwd());
const client = join(root, ".shirones/dynamic-dist/client");
const { handler } = await import(
	pathToFileURL(join(root, ".shirones/dynamic-dist/server/entry.mjs")).href
);
const contentDir = join(root, "src/content");
const paths = {
	projectRoot: root,
	contentDir,
	configDir: join(root, "src/config"),
	dataDir: join(root, "src/data"),
	isThemeRepo: true,
};
const middleware = createAdminMiddleware(contentDir, root, paths, {
	documents: createRuntimeDocumentStore(paths),
	validateBody: createRuntimePostValidator(root),
	backupDir: join(root, ".shirones/runtime/backups/posts"),
	...(process.env.SHIRONE_ADMIN_AUTH_FILE
		? { authFile: process.env.SHIRONE_ADMIN_AUTH_FILE }
		: {}),
	...(process.env.SHIRONE_ADMIN_ORIGIN
		? { origin: process.env.SHIRONE_ADMIN_ORIGIN }
		: {}),
});
const mime = {
	".css": "text/css",
	".js": "text/javascript",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".avif": "image/avif",
	".gif": "image/gif",
	".woff2": "font/woff2",
	".woff": "font/woff",
	".ttf": "font/ttf",
	".ico": "image/x-icon",
	".mp3": "audio/mpeg",
	".m4a": "audio/mp4",
	".aac": "audio/aac",
	".ogg": "audio/ogg",
	".opus": "audio/ogg",
	".wav": "audio/wav",
	".flac": "audio/flac",
	".mp4": "video/mp4",
	".webm": "video/webm",
};
const server = createServer(async (request, response) => {
	try {
		if (request.url?.startsWith("/__admin/api/"))
			return await middleware(request, response, () => {
				response.writeHead(404);
				response.end();
			});
		const pathname = decodeURIComponent(
			new URL(request.url ?? "/", "http://localhost").pathname,
		);
		const file = resolve(client, `.${pathname}`);
		const suffix = relative(client, file);
		if (
			suffix.startsWith("..") ||
			isAbsolute(suffix) ||
			pathname.split("/").some((part) => part.startsWith("."))
		) {
			response.writeHead(404);
			return response.end();
		}
		try {
			const info = await stat(file);
			if (info.isFile()) {
				if (
					relative(await realpath(client), await realpath(file)).startsWith(
						"..",
					)
				)
					throw Error("Linked static asset");
				return await sendStaticFile(request, response, file, info, {
					"Content-Type": mime[extname(file)] ?? "application/octet-stream",
					"X-Content-Type-Options": "nosniff",
					"Cache-Control": pathname.startsWith("/_astro/")
						? "public,max-age=31536000,immutable"
						: "public,max-age=600",
				});
			}
		} catch (error) {
			if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
		}
		return await handler(request, response);
	} catch (error) {
		console.error(error);
		if (!response.headersSent)
			response.writeHead(500, { "Content-Type": "application/json" });
		response.end('{"code":"unavailable"}');
	}
});
server.listen(
	Number(process.env.SHIRONE_RUNTIME_PORT ?? 4326),
	"127.0.0.1",
	() =>
		console.log(
			"Shirone dynamic server: http://127.0.0.1:" +
				(process.env.SHIRONE_RUNTIME_PORT ?? 4326),
		),
);
for (const signal of ["SIGTERM", "SIGINT"])
	process.on(signal, () => server.close(() => process.exit(0)));
