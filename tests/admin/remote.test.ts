import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createAdminMiddleware } from "../../src/integration/vite/admin.ts";
import { createAdminAuth } from "../../src/integration/vite/admin-auth.ts";

test("remote reuse enforces HTTPS proxy, origin, sessions, tokens and publication", async () => {
	const root = await mkdtemp(join(tmpdir(), "shirone-remote-"));
	const contentDir = join(root, "content");
	const configDir = join(root, "config");
	await mkdir(join(contentDir, "posts"), { recursive: true });
	await mkdir(configDir);
	await writeFile(
		join(contentDir, "posts", "example.md"),
		"---\ntitle: Example\npublished: 2026-10-11\n---\nOriginal\n",
	);
	const configSource =
		'export const siteConfig: { title: string } = { title: "Original" };\n';
	await writeFile(join(configDir, "siteConfig.ts"), configSource);
	await writeFile(
		join(root, "tsconfig.json"),
		'{"compilerOptions":{"target":"ES2022","module":"ESNext","strict":true}}',
	);
	const credential = join(root, "private-auth");
	const password = randomBytes(12).toString("base64url");
	await createAdminAuth(credential).setup(password);
	let published = 0;
	let fail = false;
	const origin = "https://admin.example";
	const paths = {
		projectRoot: root,
		contentDir,
		configDir,
		dataDir: root,
		isThemeRepo: true,
	};
	assert.throws(() =>
		createAdminMiddleware(contentDir, root, paths, {
			origin: "http://admin.example",
		}),
	);
	const middleware = createAdminMiddleware(contentDir, root, paths, {
		origin,
		authFile: credential,
		afterSave: async () => {
			if (fail) throw Error("build failed");
			published++;
		},
	});
	const server = createServer(
		(req, res) =>
			void middleware(req, res, () => {
				res.statusCode = 404;
				res.end();
			}),
	);
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	const port = (server.address() as { port: number }).port;
	let cookie = "";
	let token = "";
	const request = (
		path: string,
		data?: unknown,
		headers: Record<string, string> = {},
	) =>
		new Promise<Response>((done, reject) => {
			const req = httpRequest(
				`http://127.0.0.1:${port}/__admin/api/${path}`,
				{
					method: data ? "POST" : "GET",
					headers: {
						Host: "admin.example",
						"X-Forwarded-Proto": "https",
						Cookie: cookie,
						"X-Shirone-Admin": token,
						...(data
							? { Origin: origin, "Content-Type": "application/json" }
							: {}),
						...headers,
					},
				},
				(response) => {
					const chunks: Buffer[] = [];
					response.on("data", (chunk) => chunks.push(chunk));
					response.on("end", () => {
						const responseHeaders = new Headers();
						for (const [key, value] of Object.entries(response.headers)) {
							if (value)
								responseHeaders.set(
									key,
									Array.isArray(value) ? value.join(", ") : value,
								);
						}
						done(
							new Response(Buffer.concat(chunks), {
								status: response.statusCode,
								headers: responseHeaders,
							}),
						);
					});
				},
			);
			req.on("error", reject);
			req.end(data ? JSON.stringify(data) : undefined);
		});
	try {
		assert.equal((await request("posts")).status, 401);
		assert.equal(
			(await request("auth/status", undefined, { "X-Forwarded-Proto": "http" }))
				.status,
			403,
		);
		assert.equal(
			(await request("auth/status", undefined, { Host: "wrong.example" }))
				.status,
			403,
		);
		assert.equal((await request("auth/setup", { password })).status, 403);
		assert.equal(
			(
				await request(
					"auth/login",
					{ password },
					{ Origin: "https://evil.example" },
				)
			).status,
			403,
		);
		assert.equal(
			(await request("auth/login", { password: "incorrect" })).status,
			401,
		);
		const login = await request("auth/login", { password });
		assert.equal(login.status, 200);
		const setCookie = login.headers.get("set-cookie");
		assert.ok(setCookie);
		assert.match(setCookie, /Secure/);
		assert.match(setCookie, /HttpOnly/);
		assert.match(setCookie, /SameSite=Strict/);
		cookie = setCookie.split(";")[0];
		token = (await (await request("session")).json()).token;
		assert.equal(
			(await request("posts", undefined, { "X-Shirone-Admin": "" })).status,
			403,
		);
		assert.equal((await request("post?file=../private-auth")).status, 400);
		assert.equal((await request("image?path=../../private-auth")).status, 404);
		const document = await (await request("document?id=site")).json();
		const bad = await request("document", {
			id: "site",
			version: document.version,
			source: "export const siteConfig: { title: string } = { title: 123 };",
		});
		assert.equal(bad.status, 400);
		assert.equal(
			await readFile(join(configDir, "siteConfig.ts"), "utf8"),
			configSource,
		);
		const saved = await request("document", {
			id: "site",
			version: document.version,
			source: configSource.replace("Original", "Published"),
		});
		assert.equal(saved.status, 200);
		assert.equal(published, 1);
		assert.equal(
			(
				await request("document", {
					id: "site",
					version: document.version,
					source: configSource,
				})
			).status,
			409,
		);
		const post = await (await request("post?file=example.md")).json();
		const postSave = {
			...post,
			create: false,
			body: "Changed",
			title: "Published post",
		};
		assert.equal((await request("post", postSave)).status, 200);
		assert.equal(published, 2);
		fail = true;
		const nextPost = await (await request("post?file=example.md")).json();
		const failed = await request("post", {
			...nextPost,
			create: false,
			body: "Saved but not published",
		});
		assert.equal(failed.status, 503);
		assert.equal((await failed.json()).code, "publish");
		assert.match(
			await readFile(join(contentDir, "posts", "example.md"), "utf8"),
			/Saved but not published/,
		);
		assert.equal((await request("auth/logout", {})).status, 200);
		assert.equal((await request("posts")).status, 401);
	} finally {
		await new Promise<void>((done) => server.close(() => done()));
		await rm(root, { recursive: true, force: true });
	}
});
