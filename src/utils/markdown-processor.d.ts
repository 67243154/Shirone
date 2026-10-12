/** markdown-processor.mjs 的类型面（实现文件为 .mjs，astro.config 与 content-utils 共用） */
export declare const siteRemarkPlugins: import("@astrojs/markdown-remark").RemarkPlugins;
export declare const siteRehypePlugins: import("@astrojs/markdown-remark").RehypePlugins;

export interface SiteMarkdownRenderResult {
	code: string;
	metadata: Record<string, unknown>;
}

export interface SiteMarkdownRenderer {
	render(
		content: string,
		renderOpts?: {
			fileURL?: URL;
			frontmatter?: Record<string, unknown>;
		},
	): Promise<SiteMarkdownRenderResult>;
}

export declare const siteMarkdownProcessor: {
	name: "unified";
	options: {
		remarkPlugins: unknown[];
		rehypePlugins: unknown[];
	};
	createRenderer(
		shared?: Record<string, unknown>,
	): Promise<SiteMarkdownRenderer>;
};
