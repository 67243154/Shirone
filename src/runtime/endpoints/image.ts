import { contentDir, projectRoot } from "virtual:shirone-runtime-paths";
import type { APIContext } from "astro";
import { readAdminImage } from "../../integration/vite/admin-images";
import { readRuntimeEntries } from "../files";

export async function GET({ url }: APIContext): Promise<Response> {
	const post = url.searchParams.get("post") ?? "";
	const path = url.searchParams.get("path") ?? "";
	const entry = (await readRuntimeEntries(contentDir, "posts")).find(
		(item) => item.id === post,
	);
	if (
		!entry ||
		!path ||
		path.includes("..") ||
		!(entry.body.includes(path) || entry.data.image === path)
	)
		return new Response(null, { status: 404 });
	try {
		const image = await readAdminImage(
			projectRoot,
			contentDir,
			path,
			entry.filePath.slice(contentDir.length + "/posts/".length),
		);
		return new Response(new Uint8Array(image.body), {
			headers: {
				"Content-Type": image.type,
				"Cache-Control": "public,max-age=0,must-revalidate",
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch {
		return new Response(null, { status: 404 });
	}
}
