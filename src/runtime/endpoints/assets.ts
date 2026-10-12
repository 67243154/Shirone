import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import { contentDir, projectRoot } from "virtual:shirone-runtime-paths";
import type { APIContext } from "astro";
import { readAdminImage } from "../../integration/vite/admin-images";
import { readRuntimeEntries } from "../files";

export async function GET({ url, request }: APIContext): Promise<Response> {
	const path = url.searchParams.get("path") ?? "";
	if (path.includes("..") || path.includes("\\"))
		return new Response(null, { status: 404 });
	if (!path.startsWith("assets/")) {
		if (!path.startsWith("content/posts/"))
			return new Response(null, { status: 404 });
		const allowed = (await readRuntimeEntries(contentDir, "posts")).some(
			(entry) => {
				const sources = [
					String(entry.data.image ?? ""),
					...Array.from(
						entry.body.matchAll(/!\[[^\]]*\]\(([^\s)]+)(?:\s[^)]*)?\)/g),
						(match) => match[1],
					),
				];
				return sources.some(
					(source) =>
						source &&
						!/^(?:\/|https?:|data:)/i.test(source) &&
						relative(
							resolve(projectRoot, "src"),
							resolve(dirname(entry.filePath), source),
						).replaceAll("\\", "/") === path,
				);
			},
		);
		if (!allowed) return new Response(null, { status: 404 });
	}
	try {
		const image = await readAdminImage(projectRoot, contentDir, path, "");
		const tag = `"${createHash("sha256").update(image.body).digest("hex")}"`;
		const headers = {
			"Content-Type": image.type,
			"Cache-Control": "public,max-age=0,must-revalidate",
			ETag: tag,
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy":
				"default-src 'none'; style-src 'unsafe-inline'; sandbox",
		};
		return request.headers.get("if-none-match") === tag
			? new Response(null, { status: 304, headers })
			: new Response(new Uint8Array(image.body), { headers });
	} catch {
		return new Response(null, { status: 404 });
	}
}
