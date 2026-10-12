import {
	type CollectionEntry,
	getEntry as staticGetEntry,
	render as staticRender,
} from "astro:content";
import { pathToFileURL } from "node:url";
import { contentDir } from "virtual:shirone-runtime-paths";
import {
	createComponent,
	render as htmlTemplate,
	unescapeHTML,
} from "astro/runtime/server/index.js";
import { momentSchema, postSchema } from "../integration/collections";
import { getSourceMarkdownSyntaxSnapshot } from "../utils/markdown-source-syntaxes.mjs";
import { type RuntimeEntry, readRuntimeEntries } from "./files";
import { runtimeMarkdownProcessor } from "./markdown";
import { currentRuntimeState } from "./settings-server";

export type { CollectionEntry } from "astro:content";
export * from "astro:content";

type CollectionName = "posts" | "spec" | "series" | "moments";
const rawEntries = new WeakMap<object, RuntimeEntry>();
export async function getCollection<C extends CollectionName>(
	collection: C,
	filter?: (entry: CollectionEntry<C>) => boolean,
): Promise<CollectionEntry<C>[]> {
	const entries = await readRuntimeEntries(contentDir, collection);
	const result = entries.map((raw) => {
		const data = { ...raw.data };
		for (const key of ["published", "publishedAt", "updated", "updatedAt"])
			if (data[key] !== undefined) data[key] = new Date(String(data[key]));
		const parsed =
			collection === "posts"
				? postSchema.parse(data)
				: collection === "moments"
					? momentSchema.parse(data)
					: collection === "series"
						? { status: "ongoing", defaultCategory: "", ...data }
						: data;
		if (
			collection === "posts" &&
			data.encrypted &&
			!String(data.password ?? "").trim()
		)
			throw new Error("Encrypted posts require a password");
		const entry = {
			id: raw.id,
			collection,
			data: parsed,
			body: raw.body,
			filePath: raw.filePath,
		} as CollectionEntry<C>;
		rawEntries.set(entry, raw);
		return entry;
	});
	return filter ? result.filter(filter) : result;
}

export async function getEntry<C extends CollectionName>(
	collection: C,
	id: string,
): Promise<CollectionEntry<C> | undefined> {
	return (await getCollection(collection)).find((entry) => entry.id === id);
}

const rendered = new Map<string, ReturnType<typeof renderMarkdown>>();
let renderer:
	| ReturnType<typeof runtimeMarkdownProcessor.createRenderer>
	| undefined;
async function renderMarkdown(
	raw: RuntimeEntry,
	data: Record<string, unknown>,
): Promise<Awaited<ReturnType<typeof staticRender>>> {
	renderer ??= runtimeMarkdownProcessor.createRenderer({
		syntaxHighlight: false,
	});
	const result = await (await renderer).render(raw.body, {
		fileURL: pathToFileURL(raw.filePath),
		frontmatter: data,
	});
	const metadata = result.metadata as {
		headings?: { depth: number; slug: string; text: string }[];
		frontmatter?: Record<string, unknown>;
	};
	const frontmatter = (metadata.frontmatter ?? result.metadata) as Record<
		string,
		unknown
	>;
	const { code } = result;
	return {
		Content: createComponent(() => htmlTemplate`${unescapeHTML(code)}`),
		headings: metadata.headings ?? [],
		remarkPluginFrontmatter: {
			...frontmatter,
			markdownSyntaxes:
				frontmatter.markdownSyntaxes ??
				getSourceMarkdownSyntaxSnapshot(raw.body),
		},
	};
}

export async function render(
	entry: CollectionEntry<CollectionName>,
): Promise<Awaited<ReturnType<typeof staticRender>>> {
	const raw =
		rawEntries.get(entry) ??
		(await readRuntimeEntries(contentDir, entry.collection)).find(
			(item) => item.id === entry.id,
		);
	if (!raw) throw new Error("Content is unavailable");
	const key = `${raw.filePath}:${raw.fingerprint}:${currentRuntimeState().revision}`;
	if (raw.format === "mdx") {
		const built = await staticGetEntry(entry.collection, entry.id);
		if (built && built.body?.trim() === raw.body.trim())
			return staticRender(built);
		if (!rendered.has(key)) {
			if (rendered.size >= 128)
				rendered.delete(rendered.keys().next().value as string);
			rendered.set(
				key,
				import("./mdx").then((module) =>
					module.renderRuntimeMdx(raw, entry.data as Record<string, unknown>),
				),
			);
		}
		try {
			return (await rendered.get(key)) as Awaited<
				ReturnType<typeof staticRender>
			>;
		} catch (error) {
			rendered.delete(key);
			throw error;
		}
	}
	if (!rendered.has(key)) {
		if (rendered.size >= 128)
			rendered.delete(rendered.keys().next().value as string);
		rendered.set(
			key,
			renderMarkdown(raw, entry.data as Record<string, unknown>),
		);
	}
	try {
		return (await rendered.get(key)) as Awaited<
			ReturnType<typeof staticRender>
		>;
	} catch (error) {
		rendered.delete(key);
		throw error;
	}
}
