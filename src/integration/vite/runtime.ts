import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";
import type { Plugin } from "vite";
import { deploymentDocuments } from "../../runtime/settings-store.ts";
import { adminDocuments } from "../../utils/admin-catalog.ts";
import type { ResolvedShironesPaths } from "../types.ts";

/** Opt-in adapters; the ordinary static/npm graph never loads these modules. */
export function shironesRuntime(paths: ResolvedShironesPaths): Plugin {
	const normalize = (value: string) =>
		resolve(value).replaceAll("\\", "/").toLowerCase();
	const files = new Map(
		adminDocuments
			.filter(
				(item) =>
					item.file.endsWith(".ts") && !deploymentDocuments.has(item.id),
			)
			.map((item) => [
				normalize(
					join(
						item.kind === "data" ? paths.dataDir : paths.configDir,
						item.file,
					),
				),
				item.id,
			]),
	);
	const prefix = "\0shirone-runtime:";
	return {
		name: "shirone-runtime",
		enforce: "pre",
		async resolveId(source, importer, options) {
			if (source.startsWith(prefix)) return source;
			if (source === "virtual:shirone-runtime-paths") return `${prefix}paths`;
			if (source.includes("?shirone-default")) return undefined;
			if (!importer || importer.includes(prefix)) return undefined;
			const result = await this.resolve(source, importer, {
				...options,
				skipSelf: true,
			});
			const id = result?.id.split("?")[0];
			if (!id || !files.has(normalize(id))) return undefined;
			const server = options?.ssr || this.environment?.name !== "client";
			return `${prefix}${server ? "server" : "client"}:${id}`;
		},
		load(id) {
			if (id.includes("?shirone-default-")) {
				const file = id.split("?")[0];
				const domain = files.get(normalize(file));
				if (!domain) return undefined;
				const mode = id.endsWith("-client") ? "client" : "server";
				let source = readFileSync(file, "utf8");
				const tree = ts.createSourceFile(
					file,
					source,
					ts.ScriptTarget.Latest,
					true,
				);
				const edits: { start: number; end: number; name: string }[] = [];
				for (const statement of tree.statements)
					if (
						ts.isVariableStatement(statement) &&
						ts
							.getModifiers(statement)
							?.some(
								(modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
							)
					)
						for (const declaration of statement.declarationList.declarations)
							if (ts.isIdentifier(declaration.name) && declaration.initializer)
								edits.push({
									start: declaration.initializer.getStart(tree),
									end: declaration.initializer.end,
									name: declaration.name.text,
								});
				for (const edit of edits.sort((a, b) => b.start - a.start))
					source =
						source.slice(0, edit.start) +
						`__runtimeExport(${JSON.stringify(domain)},${JSON.stringify(edit.name)},(${source.slice(edit.start, edit.end)}))` +
						source.slice(edit.end);
				return `import {runtimeExport as __runtimeExport} from ${JSON.stringify(join(paths.packageSrc, "runtime", `settings-${mode}.ts`))};\n${source}`;
			}
			if (id === `${prefix}paths`)
				return `export const projectRoot=${JSON.stringify(paths.projectRoot)}; export const contentDir=${JSON.stringify(paths.contentDir)};`;
			if (!id.startsWith(prefix)) return undefined;
			const [mode, ...rest] = id.slice(prefix.length).split(":");
			const file = rest.join(":");
			const domain = files.get(normalize(file));
			if (!domain) return undefined;
			const tree = ts.createSourceFile(
				file,
				readFileSync(file, "utf8"),
				ts.ScriptTarget.Latest,
				true,
			);
			const names: string[] = [];
			for (const statement of tree.statements) {
				if (
					!ts.canHaveModifiers(statement) ||
					!ts
						.getModifiers(statement)
						?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
				)
					continue;
				if (ts.isVariableStatement(statement))
					for (const declaration of statement.declarationList.declarations)
						if (ts.isIdentifier(declaration.name))
							names.push(declaration.name.text);
				if (ts.isFunctionDeclaration(statement) && statement.name)
					names.push(statement.name.text);
			}
			return (
				`import * as defaults from ${JSON.stringify(`${file}?shirone-default-${mode}`)};\nimport {runtimeExport} from ${JSON.stringify(join(paths.packageSrc, "runtime", `settings-${mode}.ts`))};\n` +
				names
					.map(
						(name) =>
							`export const ${name}=runtimeExport(${JSON.stringify(domain)},${JSON.stringify(name)},defaults.${name});`,
					)
					.join("\n")
			);
		},
		transform(code, id) {
			if (
				!id
					.replaceAll("\\", "/")
					.includes(paths.packageSrc.replaceAll("\\", "/")) ||
				/[/\\](runtime|integration)[/\\]/.test(id) ||
				id.includes("content.config")
			)
				return undefined;
			if (code.includes('"astro:content"') || code.includes("'astro:content'"))
				return code.replace(
					/(["'])astro:content\1/g,
					JSON.stringify(join(paths.packageSrc, "runtime", "content.ts")),
				);
			return undefined;
		},
	};
}
