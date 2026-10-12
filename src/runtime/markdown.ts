import { dirname, relative, resolve } from "node:path";
import { projectRoot } from "virtual:shirone-runtime-paths";
import { unified } from "@astrojs/markdown-remark";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import rehypeExpressiveCode from "rehype-expressive-code";
import { visit } from "unist-util-visit";
import { expressiveCodeConfig } from "../config/expressiveCodeConfig";
import { expressiveCodeShared } from "../config/integrationsConfig";
import {
	siteRehypePlugins,
	siteRemarkPlugins,
} from "../utils/markdown-processor.mjs";

function runtimeImages() {
	return (tree: unknown, file: { path?: string }) => {
		visit(tree as never, "image", (node: { url: string }) => {
			if (!file.path || /^(?:\/|https?:|data:)/i.test(node.url)) return;
			const path = relative(
				resolve(projectRoot, "src"),
				resolve(dirname(file.path), node.url),
			).replaceAll("\\", "/");
			node.url = `/__content/assets/?path=${encodeURIComponent(path)}`;
		});
	};
}

export const runtimeMarkdownProcessor: ReturnType<typeof unified> = unified({
	remarkPlugins: [
		...siteRemarkPlugins,
		runtimeImages,
	] as unknown as import("@astrojs/markdown-remark").RemarkPlugins,
	rehypePlugins: [
		...siteRehypePlugins,
		[
			rehypeExpressiveCode,
			{
				...expressiveCodeShared,
				themes: [
					expressiveCodeConfig.darkTheme,
					expressiveCodeConfig.lightTheme,
				],
				plugins: [pluginLineNumbers(), pluginCollapsibleSections()],
			},
		],
	] as unknown as import("@astrojs/markdown-remark").RehypePlugins,
});
