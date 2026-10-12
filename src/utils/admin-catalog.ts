/** Explicit local editing allowlist; never accepts arbitrary filesystem paths. */
export interface AdminDocumentDefinition {
	id: string;
	group: "settings" | "appearance" | "features" | "data" | "advanced";
	title: string;
	file: string;
	kind: "config" | "data" | "content";
}

export const adminDocuments: readonly AdminDocumentDefinition[] = [
	...[
		"site",
		"profile",
		"navBar",
		"announcement",
		"license",
		"permalink",
		"i18n",
	].map((id) => ({
		id,
		group: "settings" as const,
		title: `adminDomain${id[0].toUpperCase()}${id.slice(1)}`,
		file: `${id}Config.ts`,
		kind: "config" as const,
	})),
	...[
		"sidebar",
		"fab",
		"postList",
		"article",
		"font",
		"expressiveCode",
		"imageBloom",
		"footer",
		"runtimeAppearance",
	].map((id) => ({
		id,
		group: "appearance" as const,
		title: `adminDomain${id[0].toUpperCase()}${id.slice(1)}`,
		file: `${id}Config.ts`,
		kind: "config" as const,
	})),
	...[
		"comment",
		"umami",
		"music",
		"contextMenu",
		"llms",
		"series",
		"about",
		"friends",
		"moments",
		"albums",
		"compass",
		"skills",
		"projects",
		"timeline",
		"devices",
		"games",
		"anime",
	].map((id) => ({
		id,
		group: "features" as const,
		title: `adminDomain${id[0].toUpperCase()}${id.slice(1)}`,
		file: `${id}Config.ts`,
		kind: "config" as const,
	})),
	...[
		"friends",
		"projects",
		"skills",
		"devices",
		"games",
		"anime",
		"music",
		"timeline",
		"compass",
	].map((id) => ({
		id: `data-${id}`,
		group: "data" as const,
		title: `adminDomain${id[0].toUpperCase()}${id.slice(1)}`,
		file: `${id}.ts`,
		kind: "data" as const,
	})),
	{
		id: "about-body",
		group: "data",
		title: "adminAboutBody",
		file: "spec/about.md",
		kind: "content",
	},
	{
		id: "footer-html",
		group: "appearance",
		title: "adminFooterHtml",
		file: "FooterConfig.html",
		kind: "config",
	},
	{
		id: "admin",
		group: "advanced",
		title: "adminDomainAdmin",
		file: "adminConfig.ts",
		kind: "config",
	},
	{
		id: "integrations",
		group: "advanced",
		title: "adminDomainIntegrations",
		file: "integrationsConfig.ts",
		kind: "config",
	},
	{
		id: "sitemap",
		group: "advanced",
		title: "adminDomainSitemap",
		file: "sitemapFilter.ts",
		kind: "config",
	},
];
