import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { createAdminMiddleware } from "../../src/integration/vite/admin.ts";
import { createAdminAuth } from "../../src/integration/vite/admin-auth.ts";
import {
	MAX_IMAGE_UPLOAD_BYTES,
	saveAdminUpload,
} from "../../src/integration/vite/admin-uploads.ts";

const fixture = (): Promise<Buffer> =>
	sharp({ create: { width: 3, height: 2, channels: 4, background: "#724d92" } })
		.png()
		.toBuffer();

test("uploads validate bytes, size and links, normalize raster images and deduplicate", async () => {
	const root = await mkdtemp(join(tmpdir(), "shirone-upload-"));
	try {
		const bytes = await fixture();
		const saved = await saveAdminUpload(root, bytes);
		assert.match(saved.path, /^\/uploads\/admin\/[a-f0-9]{64}\.webp$/);
		const output = await readFile(join(root, "public", saved.path));
		const image = await sharp(output).metadata();
		assert.equal(image.format, "webp");
		assert.equal(image.width, 3);
		assert.equal(image.height, 2);
		assert.equal((await saveAdminUpload(root, bytes)).path, saved.path);
		const gif = await sharp(Buffer.from([255, 0, 0, 255, 0, 0, 255, 255]), {
			raw: { width: 1, height: 2, channels: 4, pageHeight: 1 },
		})
			.gif({ loop: 0, delay: [100, 100] })
			.toBuffer();
		const animation = await saveAdminUpload(root, gif);
		assert.equal(
			(
				await sharp(await readFile(join(root, "public", animation.path)), {
					animated: true,
				}).metadata()
			).pages,
			2,
		);
		await assert.rejects(
			saveAdminUpload(
				root,
				Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
			),
			/uploadInvalid/,
		);
		await assert.rejects(
			saveAdminUpload(root, Buffer.from("not an image")),
			/uploadInvalid/,
		);
		await assert.rejects(
			saveAdminUpload(root, Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES + 1)),
			/uploadSize/,
		);
		const linkedRoot = join(root, "linked");
		const outside = join(root, "outside");
		await mkdir(join(linkedRoot, "public"), { recursive: true });
		await mkdir(outside);
		await symlink(
			outside,
			join(linkedRoot, "public/uploads"),
			process.platform === "win32" ? "junction" : "dir",
		);
		await assert.rejects(saveAdminUpload(linkedRoot, bytes), /uploadInvalid/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("upload API requires a session, token and same origin; returns authenticated preview", async () => {
	const root = await mkdtemp(join(tmpdir(), "shirone-upload-api-"));
	const authFile = join(root, "auth");
	const password = randomBytes(12).toString("base64url");
	await createAdminAuth(authFile).setup(password);
	const middleware = createAdminMiddleware(
		join(root, "src/content"),
		root,
		{
			projectRoot: root,
			configDir: join(root, "src/config"),
			dataDir: join(root, "src/data"),
			contentDir: join(root, "src/content"),
			isThemeRepo: true,
		},
		{ authFile },
	);
	const server = createServer(
		(req, res) => void middleware(req, res, () => res.end()),
	);
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
	let cookie = "";
	let token = "";
	const upload = (body: Buffer, headers: Record<string, string> = {}) =>
		fetch(origin + "/__admin/api/upload-image", {
			method: "POST",
			headers: {
				Origin: origin,
				Cookie: cookie,
				"X-Shirone-Admin": token,
				"Content-Type": "image/png",
				...headers,
			},
			body: new Uint8Array(body),
		});
	try {
		const bytes = await fixture();
		assert.equal((await upload(bytes)).status, 401);
		const login = await fetch(origin + "/__admin/api/auth/login", {
			method: "POST",
			headers: { Origin: origin, "Content-Type": "application/json" },
			body: JSON.stringify({ password }),
		});
		assert.equal(login.status, 200);
		cookie = login.headers.get("set-cookie")!.split(";")[0];
		assert.equal((await upload(bytes)).status, 403);
		token = (
			await (
				await fetch(origin + "/__admin/api/session", {
					headers: { Cookie: cookie },
				})
			).json()
		).token;
		assert.equal(
			(await upload(bytes, { Origin: "https://other.example" })).status,
			403,
		);
		const saved = await upload(bytes);
		assert.equal(saved.status, 200);
		const result = await saved.json();
		const preview = await fetch(
			origin + "/__admin/api/image?path=" + encodeURIComponent(result.path),
			{ headers: { Cookie: cookie } },
		);
		assert.equal(preview.status, 200);
		assert.equal(preview.headers.get("content-type"), "image/webp");
		assert.equal(
			(await sharp(Buffer.from(await preview.arrayBuffer())).metadata()).width,
			3,
		);
		assert.equal((await upload(Buffer.from("invalid"))).status, 400);
	} finally {
		server.close();
		await once(server, "close");
		await rm(root, { recursive: true, force: true });
	}
});
