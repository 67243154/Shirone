import { createHash } from "node:crypto";
import { lstat, readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { slug } from "github-slugger";
import { parseDocument } from "yaml";

export interface RuntimeEntry {
	id: string;
	collection: string;
	body: string;
	data: Record<string, unknown>;
	filePath: string;
	fingerprint: string;
	format: "md" | "mdx";
}
const cached = new Map<string, { signature: string; entry: RuntimeEntry }>();

export async function readRuntimeEntries(
	contentDir: string,
	collection: string,
): Promise<RuntimeEntry[]> {
	if (!["posts", "spec", "moments", "series"].includes(collection))
		throw new Error("Unknown runtime collection");
	const root = join(contentDir, collection);
	try {
		if ((await lstat(root)).isSymbolicLink())
			throw new Error("Linked content roots are refused");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	const entries: RuntimeEntry[] = [];
	async function walk(directory: string): Promise<void> {
		for (const item of await readdir(directory, { withFileTypes: true })) {
			if (item.isSymbolicLink()) continue;
			const file = join(directory, item.name);
			if (item.isDirectory()) {
				await walk(file);
				continue;
			}
			if (!/\.(md|mdx)$/.test(item.name)) continue;
			const info = await stat(file);
			if (info.size > 1024 * 1024)
				throw new Error("Content exceeds size limit");
			const signature = `${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
			let entry =
				cached.get(file)?.signature === signature
					? cached.get(file)?.entry
					: undefined;
			if (!entry) {
				const source = await readFile(file, "utf8");
				const match =
					/^(?:\uFEFF)?---\r?\n((?:[\s\S]*?\r?\n)?)---(?:\r?\n|$)/.exec(source);
				const document = parseDocument(match?.[1] ?? "");
				if (document.errors.length) throw new Error("Invalid YAML metadata");
				const data = (document.toJSON() ?? {}) as Record<string, unknown>;
				if (!data || typeof data !== "object" || Array.isArray(data))
					throw new Error("Invalid content metadata");
				const id =
					typeof data.slug === "string"
						? data.slug
						: relative(root, file)
								.replaceAll("\\", "/")
								.replace(/\.(md|mdx)$/, "")
								.split("/")
								.map((segment) => slug(segment))
								.join("/")
								.replace(/\/index$/, "");
				entry = {
					id,
					collection,
					data,
					body: source.slice(match?.[0].length ?? 0),
					filePath: file,
					format: item.name.endsWith(".mdx") ? "mdx" : "md",
					fingerprint: createHash("sha256").update(source).digest("hex"),
				};
				cached.set(file, { signature, entry });
			}
			// Never share mutable metadata/previous-next links across requests.
			entries.push(structuredClone(entry));
		}
	}
	await walk(root);
	return entries.filter((entry) => entry.data.draft !== true);
}
