import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import {
	lstat,
	mkdir,
	readdir,
	readFile,
	realpath,
	rename,
	unlink,
	writeFile,
} from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { isAbsolute, join, relative, resolve } from "node:path";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import type { Plugin } from "vite";
import { parseDocument, Scalar } from "yaml";
import type { AdminPost, AdminSave } from "../../types/admin.ts";
import {
	AdminAuthError,
	adminSessionCookie,
	adminSessionToken,
	createAdminAuth,
} from "./admin-auth.ts";
import {
	AdminDocumentError,
	type AdminDocumentPaths,
	createAdminDocumentStore,
} from "./admin-documents.ts";
import { readAdminImage } from "./admin-images.ts";
import { readAdminUpload } from "./admin-uploads.ts";

class AdminError extends Error {
	code: string;
	status: number;
	constructor(code: string, status = 400) {
		super(code);
		this.code = code;
		this.status = status;
	}
}
const fingerprint = (source: string): string =>
	createHash("sha256").update(source).digest("hex");

function split(source: string) {
	const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
		source,
	);
	if (!match) throw new AdminError("frontmatter");
	const document = parseDocument(match[1]);
	if (
		document.errors.length ||
		!document.toJSON() ||
		typeof document.toJSON() !== "object"
	)
		throw new AdminError("frontmatter");
	return { document, body: source.slice(match[0].length) };
}

function shape(file: string, source: string, includeBody = false): AdminPost {
	const { document, body } = split(source);
	const data = document.toJSON();
	return {
		file,
		version: fingerprint(source),
		title: String(data.title ?? file),
		published: String(data.published ?? "").slice(0, 10),
		description: String(data.description ?? ""),
		category: String(data.category ?? ""),
		tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
		image: String(data.image ?? ""),
		draft: data.draft === true,
		pinned: data.pinned === true,
		...(includeBody ? { body } : {}),
	};
}

/** File store is independent of Vite so safety and preservation can be tested. */
export function createAdminStore(
	contentDir: string,
	backupDir?: string,
	validateBody?: (
		file: string,
		body: string,
		previous: string,
	) => Promise<void>,
): {
	list(): Promise<AdminPost[]>;
	read(file: string): Promise<AdminPost>;
	save(input: AdminSave): Promise<AdminPost>;
} {
	const root = resolve(contentDir, "posts");
	let pending: Promise<unknown> = Promise.resolve();
	async function target(file: string, create = false): Promise<string> {
		if (
			typeof file !== "string" ||
			!file ||
			file.includes("\\") ||
			file.includes("\0") ||
			!/\.(md|mdx)$/.test(file)
		)
			throw new AdminError("path");
		const result = resolve(root, file);
		const suffix = relative(root, result);
		if (!suffix || suffix.startsWith("..") || isAbsolute(suffix))
			throw new AdminError("path");
		// Reject links in every segment, including the content root itself.
		let current = root;
		if ((await lstat(root)).isSymbolicLink()) throw new AdminError("path");
		for (const part of suffix.split(/[\\/]/)) {
			current = join(current, part);
			try {
				if ((await lstat(current)).isSymbolicLink())
					throw new AdminError("path");
			} catch (error) {
				if (
					(error as NodeJS.ErrnoException).code !== "ENOENT" ||
					!create ||
					current !== result
				)
					throw error;
			}
		}
		const realRoot = await realpath(root);
		const realParent = await realpath(resolve(result, ".."));
		const parentSuffix = relative(realRoot, realParent);
		if (parentSuffix.startsWith("..") || isAbsolute(parentSuffix))
			throw new AdminError("path");
		return result;
	}
	async function list(): Promise<AdminPost[]> {
		if (!existsSync(root)) return [];
		const posts: AdminPost[] = [];
		async function walk(dir: string): Promise<void> {
			for (const entry of await readdir(dir, { withFileTypes: true })) {
				if (entry.isSymbolicLink()) continue;
				const path = join(dir, entry.name);
				if (entry.isDirectory()) await walk(path);
				else if (/\.(md|mdx)$/.test(entry.name)) {
					const file = relative(root, path).replaceAll("\\", "/");
					posts.push(shape(file, await readFile(await target(file), "utf8")));
				}
			}
		}
		if ((await lstat(root)).isSymbolicLink()) throw new AdminError("path");
		await walk(root);
		return posts.sort((a, b) => b.published.localeCompare(a.published));
	}
	async function save(input: AdminSave): Promise<AdminPost> {
		const task = async (): Promise<AdminPost> => {
			if (
				typeof input.title !== "string" ||
				!input.title.trim() ||
				input.title.length > 300 ||
				typeof input.body !== "string" ||
				typeof input.description !== "string" ||
				typeof input.category !== "string" ||
				typeof input.image !== "string" ||
				typeof input.draft !== "boolean" ||
				typeof input.pinned !== "boolean" ||
				typeof input.create !== "boolean" ||
				!Array.isArray(input.tags) ||
				input.tags.some((tag) => typeof tag !== "string") ||
				typeof input.published !== "string" ||
				!/^\d{4}-\d{2}-\d{2}$/.test(input.published) ||
				Number.isNaN(Date.parse(input.published)) ||
				new Date(input.published).toISOString().slice(0, 10) !== input.published
			)
				throw new AdminError("validation");
			if (input.create && !/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(input.file))
				throw new AdminError("slug");
			await mkdir(root, { recursive: true });
			const path = await target(input.file, input.create);
			const original = input.create
				? "---\ntitle: ''\npublished: ''\n---\n"
				: await readFile(path, "utf8");
			if (!input.create && input.version !== fingerprint(original))
				throw new AdminError("conflict", 409);
			const { document } = split(original);
			await validateBody?.(input.file, input.body, split(original).body);
			if (backupDir && !input.create) {
				const backup = resolve(backupDir, input.file);
				await mkdir(resolve(backup, ".."), { recursive: true, mode: 0o700 });
				await writeFile(backup, original, { flag: "wx", mode: 0o600 }).catch(
					(error) => {
						if (error.code !== "EEXIST") throw error;
					},
				);
			}
			for (const key of [
				"title",
				"published",
				"description",
				"category",
				"tags",
				"image",
				"draft",
				"pinned",
			] as const)
				document.set(key, input[key]);
			// Astro's frontmatter parser needs the ISO date as a plain YAML scalar.
			const date = new Scalar(input.published);
			date.type = Scalar.PLAIN;
			document.set("published", date);
			const source = `---\n${document.toString()}---\n${input.body}`;
			if (input.create) {
				try {
					await writeFile(path, source, { encoding: "utf8", flag: "wx" });
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code === "EEXIST")
						throw new AdminError("exists", 409);
					throw error;
				}
			} else {
				const temp = `${path}.${randomBytes(6).toString("hex")}.admin-tmp`;
				try {
					await writeFile(temp, source, { encoding: "utf8", flag: "wx" });
					await target(input.file);
					if (fingerprint(await readFile(path, "utf8")) !== input.version)
						throw new AdminError("conflict", 409);
					await rename(temp, path);
				} finally {
					await unlink(temp).catch(() => {});
				}
			}
			return shape(input.file, source, true);
		};
		const result = pending.then(task);
		pending = result.catch(() => {});
		return result;
	}
	return {
		list,
		read: async (file) =>
			shape(file, await readFile(await target(file), "utf8"), true),
		save,
	};
}

async function readJson(
	request: IncomingMessage,
): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of request) {
		size += chunk.length;
		if (size > 1024 * 1024) throw new AdminError("size", 413);
		chunks.push(Buffer.from(chunk));
	}
	try {
		const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		if (!value || typeof value !== "object" || Array.isArray(value))
			throw new AdminError("validation");
		return value;
	} catch {
		throw new AdminError("validation");
	}
}

export interface AdminMiddlewareOptions {
	origin?: string;
	authFile?: string;
	afterSave?: () => Promise<void>;
	documents?: ReturnType<typeof createAdminDocumentStore>;
	backupDir?: string;
	validateBody?: (
		file: string,
		body: string,
		previous: string,
	) => Promise<void>;
}
export function createAdminMiddleware(
	contentDir: string,
	projectRoot: string,
	documentPaths: AdminDocumentPaths,
	options: AdminMiddlewareOptions = {},
): (
	request: IncomingMessage,
	response: import("node:http").ServerResponse,
	next: () => void,
) => Promise<void> {
	if (options.origin) {
		const url = new URL(options.origin);
		if (url.protocol !== "https:" || url.origin !== options.origin)
			throw new Error("An exact HTTPS admin origin is required");
	}
	const token = randomBytes(32).toString("hex");
	const store = createAdminStore(
		contentDir,
		options.backupDir,
		options.validateBody,
	);
	const documents =
		options.documents ?? createAdminDocumentStore(documentPaths);
	const authFile =
		options.authFile ??
		join(
			projectRoot,
			process.env.SHIRONE_ADMIN_AUTH_TEST === "1"
				? ".env.shirone-admin-test-auth"
				: ".env.shirone-admin-auth",
		);
	const auth = createAdminAuth(authFile);
	const markdown = new MarkdownIt({ html: false, linkify: false });
	let pending: Promise<unknown> = Promise.resolve();
	async function mutate<T>(save: () => Promise<T>): Promise<T> {
		const task = pending.then(async () => {
			const saved = await save();
			if (options.afterSave) {
				try {
					await options.afterSave();
				} catch {
					throw new AdminDocumentError(
						"publish",
						503,
						"Source saved; publication failed. The previous live release is unchanged.",
					);
				}
			}
			return saved;
		});
		pending = task.catch(() => {});
		return task;
	}
	return async (request, response, next) => {
		const pathname = (request.url ?? "").split("?")[0];
		if (!pathname.startsWith("/__admin/api/")) return next();
		response.setHeader("Content-Type", "application/json; charset=utf-8");
		response.setHeader("Cache-Control", "no-store");
		response.setHeader("X-Content-Type-Options", "nosniff");
		const send = (data: unknown) => {
			response.end(JSON.stringify(data));
		};
		try {
			const host = request.headers.host ?? "";
			const address = request.socket.remoteAddress ?? "";
			const origin = options.origin ?? `http://${host}`;
			if (
				(options.origin
					? host !== new URL(options.origin).host ||
						request.headers["x-forwarded-proto"] !== "https"
					: !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) ||
				!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address) ||
				request.headers["sec-fetch-site"] === "cross-site" ||
				(request.headers.origin && request.headers.origin !== origin)
			)
				throw new AdminError("forbidden", 403);
			if (
				process.env.CONTENT_DIR ||
				process.env.CONTENT_REPO_URL ||
				existsSync(join(projectRoot, "shirone.content.json"))
			)
				throw new AdminError("external", 409);
			const session = adminSessionToken(request.headers.cookie);
			if (pathname === "/__admin/api/auth/status" && request.method === "GET")
				return send({
					configured: await auth.configured(),
					authenticated: auth.authenticated(session),
				});
			if (
				pathname.startsWith("/__admin/api/auth/") &&
				request.method === "POST"
			) {
				if (
					request.headers.origin !== origin ||
					!request.headers["content-type"]?.startsWith("application/json")
				)
					throw new AdminError("forbidden", 403);
				if (pathname === "/__admin/api/auth/logout") {
					auth.logout(session);
					response.setHeader(
						"Set-Cookie",
						adminSessionCookie("", !!options.origin),
					);
					return send({ authenticated: false });
				}
				const data = await readJson(request);
				if (
					pathname !== "/__admin/api/auth/setup" &&
					pathname !== "/__admin/api/auth/login"
				)
					throw new AdminError("notFound", 404);
				if (options.origin && pathname.endsWith("/setup"))
					throw new AdminError("forbidden", 403);
				const nextSession = pathname.endsWith("/setup")
					? await auth.setup(data.password)
					: await auth.login(data.password);
				auth.logout(session);
				response.setHeader(
					"Set-Cookie",
					adminSessionCookie(nextSession, !!options.origin),
				);
				return send({ authenticated: true });
			}
			if (!auth.authenticated(session))
				throw new AdminError("unauthorized", 401);
			if (pathname === "/__admin/api/session" && request.method === "GET")
				return send({ token });
			if (pathname === "/__admin/api/image" && request.method === "GET") {
				const url = new URL(request.url ?? "/", origin);
				try {
					const image = await readAdminImage(
						projectRoot,
						contentDir,
						url.searchParams.get("path") ?? "",
						url.searchParams.get("post") ?? "",
					);
					response.setHeader("Content-Type", image.type);
					response.setHeader(
						"Content-Security-Policy",
						"default-src 'none'; sandbox",
					);
					response.end(image.body);
					return;
				} catch {
					throw new AdminError("notFound", 404);
				}
			}
			if (request.headers["x-shirone-admin"] !== token)
				throw new AdminError("forbidden", 403);
			const url = new URL(request.url ?? "/", origin);
			if (pathname === "/__admin/api/documents" && request.method === "GET")
				return send({ ids: await documents.list() });
			if (pathname === "/__admin/api/document" && request.method === "GET")
				return send(await documents.read(url.searchParams.get("id") ?? ""));
			if (pathname === "/__admin/api/posts" && request.method === "GET")
				return send({ posts: await store.list() });
			if (pathname === "/__admin/api/post" && request.method === "GET")
				return send(await store.read(url.searchParams.get("file") ?? ""));
			if (request.method !== "POST") throw new AdminError("method", 405);
			if (pathname === "/__admin/api/upload-image") {
				if (request.headers.origin !== origin)
					throw new AdminError("forbidden", 403);
				return send(await readAdminUpload(request, projectRoot));
			}
			if (
				!request.headers.origin ||
				!request.headers["content-type"]?.startsWith("application/json")
			)
				throw new AdminError("forbidden", 403);
			const data = await readJson(request);
			if (pathname === "/__admin/api/document")
				return send(
					await mutate(() =>
						documents.save(
							data as unknown as Parameters<typeof documents.save>[0],
						),
					),
				);
			if (pathname === "/__admin/api/post")
				return send(
					await mutate(() => store.save(data as unknown as AdminSave)),
				);
			if (pathname === "/__admin/api/preview" && typeof data.body === "string")
				return send({ html: sanitizeHtml(markdown.render(data.body)) });
			throw new AdminError("notFound", 404);
		} catch (error) {
			response.statusCode =
				error instanceof AdminError ||
				error instanceof AdminDocumentError ||
				error instanceof AdminAuthError
					? error.status
					: (error as NodeJS.ErrnoException).code === "ENOENT"
						? 404
						: 500;
			send({
				code:
					error instanceof AdminError ||
					error instanceof AdminDocumentError ||
					error instanceof AdminAuthError
						? error.code
						: "unavailable",
				...(error instanceof AdminDocumentError && error.details
					? { details: error.details }
					: {}),
			});
		}
	};
}

/** Local authoring retains its loopback-only request policy. */
export function shironesAdmin(
	contentDir: string,
	projectRoot: string,
	documentPaths: AdminDocumentPaths,
): Plugin {
	return {
		name: "shirones-local-admin",
		apply: "serve",
		config(config) {
			return {
				server: {
					fs: {
						deny: [
							...(config.server?.fs?.deny ?? [
								".env",
								".env.*",
								"*.{crt,pem,key,p12,pfx,cer,der}",
								".npmrc",
								".yarnrc.yml",
								"**/.git/**",
							]),
							"**/.env.shirone-admin*-auth",
						],
					},
				},
			};
		},
		async configureServer(server) {
			const dynamic = process.env.SHIRONE_DYNAMIC === "1";
			const documents = dynamic
				? (
						await import("../../runtime/settings-store.ts")
					).createRuntimeDocumentStore(documentPaths)
				: undefined;
			const validateBody = dynamic
				? (
						await import("../../runtime/post-validation.ts")
					).createRuntimePostValidator(projectRoot)
				: undefined;
			server.middlewares.use(
				createAdminMiddleware(contentDir, projectRoot, documentPaths, {
					documents,
					validateBody,
					...(dynamic
						? {
								backupDir: join(projectRoot, ".shirones/runtime/backups/posts"),
							}
						: {}),
				}),
			);
		},
	};
}
