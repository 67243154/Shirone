import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { unified } from "@astrojs/markdown-remark";
import ts from "typescript";
import { AdminDocumentError } from "../integration/vite/admin-documents.ts";
import {
	siteRehypePlugins,
	siteRemarkPlugins,
} from "../utils/markdown-processor.mjs";

/** Runtime MDX may reuse deployed imports; adding executable components is a deployment change. */
export function createRuntimePostValidator(root: string) {
	const renderer = unified({
		remarkPlugins:
			siteRemarkPlugins as unknown as import("@astrojs/markdown-remark").RemarkPlugins,
		rehypePlugins:
			siteRehypePlugins as unknown as import("@astrojs/markdown-remark").RehypePlugins,
	}).createMdxRenderer!(
		{ syntaxHighlight: false },
		{
			srcDir: pathToFileURL(`${root}/src/`),
			optimize: false,
			sourcemap: false,
		},
	);
	const imports = (code: string): Set<string> => {
		const tree = ts.createSourceFile(
			"post.js",
			code,
			ts.ScriptTarget.Latest,
			true,
		);
		return new Set(
			tree.statements.flatMap((statement) => {
				if (
					(ts.isImportDeclaration(statement) ||
						ts.isExportDeclaration(statement)) &&
					statement.moduleSpecifier &&
					ts.isStringLiteral(statement.moduleSpecifier)
				)
					return [statement.moduleSpecifier.text];
				return [];
			}),
		);
	};
	return async (
		file: string,
		body: string,
		previous: string,
	): Promise<void> => {
		if (!file.endsWith(".mdx") || body === previous) return;
		try {
			const compiler = await renderer;
			const location = join(root, "src/content/posts", file);
			const baseline = imports(
				(await compiler.process(previous, location, {})).code,
			);
			const next = imports((await compiler.process(body, location, {})).code);
			if ([...next].some((specifier) => !baseline.has(specifier)))
				throw new AdminDocumentError("unsupportedMdx", 400);
		} catch (error) {
			if (error instanceof AdminDocumentError) throw error;
			throw new AdminDocumentError("validation", 400, String(error));
		}
	};
}
