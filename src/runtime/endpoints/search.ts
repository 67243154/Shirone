import type { APIContext } from "astro";
import { getSortedPosts } from "../../utils/content-utils";
import { isEncryptedPost } from "../../utils/post-encryption";
import { getPostUrl } from "../../utils/url-utils";

const escapeExcerpt = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
export async function GET({ url }: APIContext): Promise<Response> {
	const query = (url.searchParams.get("q") ?? "")
		.trim()
		.slice(0, 100)
		.toLowerCase();
	if (!query)
		return Response.json(
			{ results: [] },
			{ headers: { "Cache-Control": "no-store" } },
		);
	const results = (await getSortedPosts())
		.flatMap((post) => {
			const encrypted = isEncryptedPost(post.data);
			const text = encrypted
				? ""
				: `${post.data.description} ${post.body ?? ""}`;
			const searchable =
				`${post.data.title} ${post.data.category} ${post.data.tags.join(" ")} ${text}`.toLowerCase();
			if (!searchable.includes(query)) return [];
			return [
				{
					url: getPostUrl(post),
					meta: { title: post.data.title },
					excerpt: escapeExcerpt(
						text
							.replace(/[#*_`>[\]]/g, "")
							.replace(/\s+/g, " ")
							.slice(0, 160),
					),
				},
			];
		})
		.slice(0, 20);
	return Response.json(
		{ results },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
