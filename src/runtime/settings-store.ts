import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { build } from "esbuild";
import {
	AdminDocumentError,
	type AdminDocumentPaths,
	createAdminDocumentStore,
	regions,
} from "../integration/vite/admin-documents.ts";
import { adminDocuments } from "../utils/admin-catalog.ts";
import { readRuntimeState } from "./settings-server.ts";
import type { RuntimeState } from "./settings-shared.ts";

export const deploymentDocuments: Set<string> = new Set([
	"font",
	"expressiveCode",
	"integrations",
	"admin",
	"sitemap",
]);
export const isRuntimeDocument = (id: string): boolean =>
	!deploymentDocuments.has(id);

/** Recreate an effective source view from safe, typed literal overrides. */
export function applyFieldOverrides(
	source: string,
	file: string,
	patches: Record<string, unknown> = {},
): string {
	let effective = source;
	for (const region of regions(source, file).sort(
		(a, b) => b.start - a.start,
	)) {
		if (!Object.hasOwn(patches, region.path)) continue;
		effective =
			effective.slice(0, region.start) +
			JSON.stringify(patches[region.path], null, 2) +
			effective.slice(region.end);
	}
	return effective;
}

function sourcePath(
	paths: AdminDocumentPaths,
	item: (typeof adminDocuments)[number],
): string {
	return join(
		item.kind === "data"
			? paths.dataDir
			: item.kind === "content"
				? paths.contentDir
				: paths.configDir,
		item.file,
	);
}

/** Only trusted theme code is evaluated; the editor contributes validated literals. */
async function compileSettings(
	paths: AdminDocumentPaths,
	state: RuntimeState,
): Promise<RuntimeState["modules"]> {
	const items = adminDocuments.filter(
		(item) =>
			isRuntimeDocument(item.id) &&
			item.file.endsWith(".ts") &&
			existsSync(sourcePath(paths, item)),
	);
	const byPath = new Map(
		items.map((item) => [
			resolve(sourcePath(paths, item)).replaceAll("\\", "/").toLowerCase(),
			item,
		]),
	);
	const entry =
		items
			.map(
				(item, index) =>
					`import * as m${index} from ${JSON.stringify(sourcePath(paths, item))};`,
			)
			.join("\n") +
		`\nexport const snapshot = {${items.map((item, index) => `${JSON.stringify(item.id)}:m${index}`).join(",")}};`;
	const result = await build({
		stdin: { contents: entry, resolveDir: paths.projectRoot, loader: "ts" },
		bundle: true,
		write: false,
		platform: "node",
		format: "cjs",
		packages: "external",
		define: { "import.meta.env": JSON.stringify({ BASE_URL: "/" }) },
		plugins: [
			{
				name: "runtime-literal-settings",
				setup(plugin) {
					plugin.onResolve({ filter: /^@\// }, (args) => ({
						path:
							join(paths.projectRoot, "src", args.path.slice(2)) +
							(args.path.endsWith(".ts") ? "" : ".ts"),
					}));
					plugin.onLoad({ filter: /\.ts$/ }, async (args) => {
						const item = byPath.get(
							resolve(args.path).replaceAll("\\", "/").toLowerCase(),
						);
						if (!item) return undefined;
						return {
							contents: applyFieldOverrides(
								await readFile(args.path, "utf8"),
								args.path,
								state.documents?.[item.id]?.patches,
							),
							loader: "ts",
							resolveDir: dirname(args.path),
						};
					});
				},
			},
		],
	});
	const module: { exports: { snapshot?: unknown } } = { exports: {} };
	const require = createRequire(join(paths.projectRoot, "package.json"));
	new Function("require", "module", "exports", result.outputFiles[0].text)(
		require,
		module,
		module.exports,
	);
	return JSON.parse(
		JSON.stringify(module.exports.snapshot),
	) as RuntimeState["modules"];
}

export function createRuntimeDocumentStore(
	paths: AdminDocumentPaths,
): ReturnType<typeof createAdminDocumentStore> {
	const directory = join(paths.projectRoot, ".shirones", "runtime");
	return createAdminDocumentStore(paths, {
		async readSource(id, source) {
			const item = adminDocuments.find((entry) => entry.id === id);
			return item && isRuntimeDocument(id)
				? applyFieldOverrides(
						source,
						item.file,
						readRuntimeState(paths.projectRoot).documents?.[id]?.patches,
					)
				: source;
		},
		decorate(document) {
			return {
				...document,
				fields: document.fields.map((field) => ({
					...field,
					readonly:
						document.id === "site" &&
						["siteConfig.site", "siteConfig.base"].includes(field.path),
				})),
				mode: isRuntimeDocument(document.id) ? "runtime" : "deployment",
			};
		},
		async writeSource(id, baseline, source) {
			await mkdir(join(directory, "backups"), { recursive: true, mode: 0o700 });
			await writeFile(join(directory, "backups", `${id}.source`), baseline, {
				flag: "wx",
				mode: 0o600,
			}).catch((error) => {
				if (error.code !== "EEXIST") throw error;
			});
			const item = adminDocuments.find((entry) => entry.id === id);
			if (!item || !isRuntimeDocument(id) || !item.file.endsWith(".ts"))
				return false;
			const before = readRuntimeState(paths.projectRoot);
			const patches: Record<string, unknown> = {};
			for (const field of regions(source, item.file)) {
				if (id === "runtimeAppearance") {
					const limits: Record<string, [number, number]> = {
						bodyFontSize: [12, 24],
						titleFontScale: [0.75, 1.5],
						cornerRadius: [0, 48],
					};
					const key = field.path.split(".").at(-1) ?? "";
					if (
						limits[key] &&
						(typeof field.value !== "number" ||
							field.value < limits[key][0] ||
							field.value > limits[key][1])
					)
						throw new AdminDocumentError("validation", 400);
					if (
						key === "backgroundColor" &&
						!/^#[0-9a-f]{6}$/i.test(String(field.value))
					)
						throw new AdminDocumentError("validation", 400);
				}
				if (
					id === "site" &&
					["siteConfig.site", "siteConfig.base"].includes(field.path)
				) {
					const previous = regions(baseline, item.file).find(
						(entry) => entry.path === field.path,
					);
					if (previous?.value !== field.value)
						throw new AdminDocumentError("deploymentRequired", 400);
				}
				const value =
					field.kind === "json" ? JSON.parse(String(field.value)) : field.value;
				const check = (value: unknown, depth = 0): void => {
					if (depth > 32) throw new AdminDocumentError("validation", 400);
					if (value && typeof value === "object")
						for (const [key, nested] of Object.entries(value)) {
							if (["__proto__", "prototype", "constructor"].includes(key))
								throw new AdminDocumentError("validation", 400);
							check(nested, depth + 1);
						}
				};
				check(value);
				patches[field.path] = value;
			}
			const next: RuntimeState = {
				...before,
				revision: randomBytes(16).toString("hex"),
				documents: { ...before.documents, [id]: { patches } },
			};
			try {
				next.modules = await compileSettings(paths, next);
			} catch (error) {
				throw new AdminDocumentError("validation", 400, String(error));
			}
			if (readRuntimeState(paths.projectRoot).revision !== before.revision)
				throw new AdminDocumentError("conflict", 409);
			const temporary = join(
				directory,
				`settings-${randomBytes(6).toString("hex")}.tmp`,
			);
			try {
				await writeFile(temporary, JSON.stringify(next), {
					flag: "wx",
					mode: 0o600,
				});
				await rename(temporary, join(directory, "settings.json"));
			} finally {
				await unlink(temporary).catch(() => {});
			}
			return true;
		},
	});
}
