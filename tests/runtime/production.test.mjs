import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createAdminAuth } from "../../src/integration/vite/admin-auth.ts";

test("production SSR reads saved articles/configuration without rebuilding or restarting", {
	timeout: 120000,
}, async () => {
	const root = resolve(".");
	const temporary = await mkdtemp(join(root, ".shirones/runtime-test-"));
	const credential = join(temporary, "auth");
	const password = randomBytes(12).toString("base64url");
	await createAdminAuth(credential).setup(password);
	const stateFile = join(root, ".shirones/runtime/settings.json");
	let previousState;
	try {
		previousState = await readFile(stateFile);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	const entry = join(root, ".shirones/dynamic-dist/server/entry.mjs");
	const before = createHash("sha256")
		.update(await readFile(entry))
		.digest("hex");
	const port = 4336;
	const origin = `http://127.0.0.1:${port}`;
	let output = "";
	const launch = () => {
		const child = spawn(
			process.execPath,
			[join(root, ".shirones/dynamic-server.mjs")],
			{
				cwd: root,
				env: {
					...process.env,
					SHIRONE_RUNTIME_PROJECT: root,
					SHIRONE_RUNTIME_PORT: String(port),
					SHIRONE_ADMIN_AUTH_FILE: credential,
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		child.stdout.on("data", (chunk) => (output += chunk));
		child.stderr.on("data", (chunk) => (output += chunk));
		return child;
	};
	let server = launch();
	let cookie = "";
	let token = "";
	const request = (path, data) =>
		fetch(`${origin}/__admin/api/${path}`, {
			method: data ? "POST" : "GET",
			headers: {
				Cookie: cookie,
				"X-Shirone-Admin": token,
				...(data ? { "Content-Type": "application/json", Origin: origin } : {}),
			},
			...(data ? { body: JSON.stringify(data) } : {}),
		});
	const file = `runtime-check-${Date.now()}.md`;
	const postFile = join(root, "src/content/posts", file);
	const marker = "runtime-dynamic-verification-67243154";
	const mdxFile = join(root, "src/content/posts/mdx-showcase.mdx");
	const mdxOriginal = await readFile(mdxFile);
	try {
		await new Promise((done, reject) => {
			const timer = setTimeout(
				() => reject(Error("Server startup timeout")),
				10000,
			);
			server.stdout.once("data", () => {
				clearTimeout(timer);
				done();
			});
			server.once("exit", () => reject(Error("Server stopped: " + output)));
		});
		assert.equal((await request("posts")).status, 401);
		const login = await request("auth/login", { password });
		assert.equal(login.status, 200);
		cookie = login.headers.get("set-cookie").split(";")[0];
		token = (await (await request("session")).json()).token;
		const started = performance.now();
		const saved = await request("post", {
			file,
			create: true,
			title: marker,
			published: "2026-10-12",
			description: marker,
			category: "Runtime check",
			tags: [marker],
			image: "",
			draft: false,
			pinned: true,
			body: `## ${marker}\n\nLive body.\n\n:::tip\nKept markdown extension.\n:::\n\n\`\`\`js\nconsole.log("dynamic");\n\`\`\`\n`,
		});
		assert.equal(saved.status, 200, await saved.clone().text());
		console.log(`Article save: ${Math.round(performance.now() - started)} ms`);
		assert.ok(performance.now() - started < 1000);
		const detail = await fetch(`${origin}/posts/${file.slice(0, -3)}/`);
		assert.equal(detail.status, 200);
		const html = await detail.text();
		assert.match(html, /Live body/);
		assert.match(html, /admonition/);
		assert.match(html, /expressive-code/);
		assert.match(html, new RegExp(`<title>.*${marker}`));
		const home = await (await fetch(origin + "/")).text();
		assert.match(home, new RegExp(marker));
		const found = await (
			await fetch(origin + `/__content/search/?q=${marker}`)
		).json();
		assert.ok(found.results.some((item) => item.meta.title === marker));
		assert.match(
			await (await fetch(origin + "/rss.xml")).text(),
			new RegExp(marker),
		);
		assert.match(
			await (await fetch(origin + "/categories/")).text(),
			/Runtime check/,
		);
		assert.match(
			await (await fetch(origin + "/tags/")).text(),
			new RegExp(marker),
		);
		const image = await fetch(
			origin + "/__content/assets/?path=assets%2Fimages%2Fdemo-avatar.webp",
		);
		assert.equal(image.status, 200);
		assert.match(image.headers.get("content-type"), /^image\//);
		assert.equal(
			(
				await fetch(
					origin +
						"/__content/assets/?path=assets%2F..%2Fconfig%2FsiteConfig.ts",
				)
			).status,
			404,
		);
		const current = await (await request("post?file=" + file)).json();
		assert.equal(
			(
				await request("post", {
					...current,
					create: false,
					draft: true,
					body: "Secret unpublished body",
				})
			).status,
			200,
		);
		assert.equal(
			(await fetch(`${origin}/posts/${file.slice(0, -3)}/`)).status,
			404,
		);
		assert.equal(
			(await (await fetch(origin + `/__content/search/?q=${marker}`)).json())
				.results.length,
			0,
		);
		assert.doesNotMatch(
			await (await fetch(origin + "/rss.xml")).text(),
			new RegExp(marker),
		);
		const config = await (await request("document?id=site")).json();
		const title = config.fields.find(
			(field) => field.path === "siteConfig.title",
		);
		assert.ok(title);
		const configStart = performance.now();
		const configSave = await request("document", {
			id: "site",
			version: config.version,
			fields: [{ id: title.id, value: "Live runtime title" }],
		});
		assert.equal(configSave.status, 200, await configSave.clone().text());
		console.log(
			`Configuration save including validation: ${Math.round(performance.now() - configStart)} ms`,
		);
		const second = await (await request("document?id=site")).json();
		const nextTitle = second.fields.find(
			(field) => field.path === "siteConfig.title",
		);
		const warmStart = performance.now();
		assert.equal(
			(
				await request("document", {
					id: "site",
					version: second.version,
					fields: [{ id: nextTitle.id, value: "Live runtime title" }],
				})
			).status,
			200,
		);
		console.log(
			`Repeated configuration save: ${Math.round(performance.now() - warmStart)} ms`,
		);
		const newHome = await (await fetch(origin + "/")).text();
		assert.match(newHome, /<title>Live runtime title/);
		assert.match(
			newHome,
			/property="og:site_name" content="Live runtime title"/,
		);
		const appearance = await (
			await request("document?id=runtimeAppearance")
		).json();
		const size = appearance.fields.find((field) =>
			field.path.endsWith(".bodyFontSize"),
		);
		assert.ok(size);
		const appearanceSave = await request("document", {
			id: "runtimeAppearance",
			version: appearance.version,
			fields: [{ id: size.id, value: 18 }],
		});
		assert.equal(
			appearanceSave.status,
			200,
			await appearanceSave.clone().text(),
		);
		assert.match(
			await (await fetch(origin + "/")).text(),
			/--runtime-body-size:18px/,
		);
		const mdx = await (await request("post?file=mdx-showcase.mdx")).json();
		const nav = await (await request("document?id=navBar")).json();
		const homeName = nav.fields.find(
			(field) => field.path === "LinkPresets.Home.name",
		);
		assert.ok(homeName);
		const navSave = await request("document", {
			id: "navBar",
			version: nav.version,
			fields: [{ id: homeName.id, value: "动态首页入口" }],
		});
		assert.equal(navSave.status, 200, await navSave.clone().text());
		assert.match(await (await fetch(origin + "/")).text(), /动态首页入口/);
		const banner = await (await request("document?id=site")).json();
		const subtitles = banner.fields.find(
			(field) => field.path === "siteConfig.banner.homeText.subtitle",
		);
		assert.ok(subtitles);
		assert.equal(
			(
				await request("document", {
					id: "site",
					version: banner.version,
					fields: [
						{ id: subtitles.id, value: JSON.stringify(["动态横幅验证"]) },
					],
				})
			).status,
			200,
		);
		assert.match(await (await fetch(origin + "/")).text(), /动态横幅验证/);
		const profile = await (await request("document?id=profile")).json();
		const avatar = profile.fields.find(
			(field) => field.path === "profileConfig.avatar",
		);
		assert.ok(avatar);
		assert.equal(
			(
				await request("document", {
					id: "profile",
					version: profile.version,
					fields: [
						{ id: avatar.id, value: "assets/images/banner/desktop/1.webp" },
					],
				})
			).status,
			200,
		);
		assert.match(
			await (await fetch(origin + "/")).text(),
			/__content\/assets\/\?path=assets%2Fimages%2Fbanner%2Fdesktop%2F1.webp/,
		);
		const mdxSaved = await request("post", {
			...mdx,
			create: false,
			body:
				mdx.body +
				"\n\n## Runtime MDX verification\n\nMDX body updated live.\n",
		});
		assert.equal(mdxSaved.status, 200, await mdxSaved.clone().text());
		const mdxPage = await fetch(origin + "/posts/mdx-showcase/", {
			signal: AbortSignal.timeout(20000),
		});
		assert.equal(mdxPage.status, 200, "Runtime MDX request failed");
		const mdxHtml = await mdxPage.text();
		assert.match(mdxHtml, /MDX body updated live/);
		assert.match(mdxHtml, /astro-island/);
		const latestMdx = await (
			await request("post?file=mdx-showcase.mdx")
		).json();
		const refused = await request("post", {
			...latestMdx,
			create: false,
			body:
				'import NewComponent from "@components/new.svelte";\n\n' +
				latestMdx.body,
		});
		assert.equal(refused.status, 400);
		assert.equal((await refused.json()).code, "unsupportedMdx");
		assert.equal(
			(await (await request("post?file=mdx-showcase.mdx")).json()).version,
			latestMdx.version,
		);
		server.kill();
		await once(server, "exit");
		server = launch();
		await once(server.stdout, "data");
		const afterRestart = await (await fetch(origin + "/")).text();
		assert.match(afterRestart, /<title>Live runtime title/);
		assert.match(afterRestart, /--runtime-body-size:18px/);
		assert.equal(
			createHash("sha256")
				.update(await readFile(entry))
				.digest("hex"),
			before,
		);
		assert.equal(server.exitCode, null);
		assert.doesNotMatch(output, /\[build\]|Pagefind|astro build/);
		console.log(
			"Production saves updated HTML, metadata, search and appearance with unchanged build and server PID.",
		);
	} catch (error) {
		console.error(output.slice(-4000));
		throw error;
	} finally {
		if (server.exitCode === null) {
			server.kill();
			await once(server, "exit");
		}
		await rm(postFile, { force: true });
		await rm(join(root, ".shirones/runtime/backups/posts", file), {
			force: true,
		});
		await writeFile(mdxFile, mdxOriginal);
		if (previousState) await writeFile(stateFile, previousState);
		else await rm(stateFile, { force: true });
		await rm(temporary, { recursive: true, force: true });
	}
});
