import * as assets from "astro:assets";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "virtual:shirone-runtime-paths";
import * as jsxRuntime from "astro/jsx-runtime";
import {
	createComponent,
	Renderer,
	renderJSX,
} from "astro/runtime/server/index.js";
import ts from "typescript";
import { getSourceMarkdownSyntaxSnapshot } from "../utils/markdown-source-syntaxes.mjs";
import type { RuntimeEntry } from "./files";
import { runtimeMarkdownProcessor } from "./markdown";

const components = import.meta.glob("../components/**/*.{astro,svelte}", {
	eager: true,
});
const images = import.meta.glob("../**/*.{png,jpg,jpeg,webp,avif,svg,gif}", {
	eager: true,
});
let renderer: ReturnType<
	NonNullable<typeof runtimeMarkdownProcessor.createMdxRenderer>
>;
export async function renderRuntimeMdx(
	entry: RuntimeEntry,
	data: Record<string, unknown>,
): Promise<Awaited<ReturnType<typeof import("astro:content").render>>> {
	renderer ??= runtimeMarkdownProcessor.createMdxRenderer!(
		{ syntaxHighlight: false },
		{
			srcDir: pathToFileURL(`${projectRoot}/src/`),
			optimize: false,
			sourcemap: false,
		},
	);
	const compiled = await (await renderer).process(
		entry.body,
		entry.filePath,
		data,
	);
	const code = ts.transpileModule(compiled.code, {
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.CommonJS,
			esModuleInterop: false,
		},
	}).outputText;
	const module: { exports: Record<string, unknown> } = { exports: {} };
	const require = (specifier: string): unknown => {
		if (specifier === "astro/jsx-runtime") return jsxRuntime;
		if (specifier === "astro:assets") return assets;
		const key = specifier.startsWith("@components/")
			? `../components/${specifier.slice(12)}`
			: specifier.startsWith("@assets/")
				? `../assets/${specifier.slice(8)}`
				: `../${path.relative(path.join(projectRoot, "src"), path.resolve(path.dirname(entry.filePath), specifier)).replaceAll("\\", "/")}`;
		const value = components[key] ?? images[key];
		if (!value)
			throw new Error(
				`Unsupported runtime MDX import ${specifier}; register it with a deployment build.`,
			);
		if (
			specifier.startsWith("@components/") &&
			typeof (value as { default?: unknown }).default !== "function"
		)
			throw new Error(`Unsupported MDX component export: ${specifier}`);
		return value;
	};
	new Function("require", "module", "exports", code)(
		require,
		module,
		module.exports,
	);
	const MDXContent = module.exports.default as (
		props: Record<string, unknown>,
	) => unknown;
	Object.defineProperty(MDXContent, Renderer, { value: "astro:jsx" });
	Object.defineProperty(MDXContent, Symbol.for("mdx-component"), {
		value: true,
	});
	return {
		Content: createComponent((result, props) =>
			renderJSX(
				result,
				jsxRuntime.jsx(MDXContent, {
					...props,
					components: {
						Fragment: jsxRuntime.Fragment,
						...((props.components ?? {}) as Record<string, unknown>),
					},
				}),
			),
		),
		headings:
			typeof module.exports.getHeadings === "function"
				? (
						module.exports.getHeadings as () => {
							depth: number;
							slug: string;
							text: string;
						}[]
					)()
				: [],
		remarkPluginFrontmatter: {
			...data,
			markdownSyntaxes: getSourceMarkdownSyntaxSnapshot(entry.body),
		},
	};
}
