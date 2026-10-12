/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

declare module "virtual:shirone-runtime-paths" {
	export const projectRoot: string;
	export const contentDir: string;
}

declare namespace App {
	interface Locals {
		runtimeState?: import("./runtime/settings-shared").RuntimeState;
		runtimeRevision?: string;
	}
}

declare module "virtual:shirone-music-sidebar" {
	const component:
		| typeof import("@components/organisms/music/MusicSidebar.astro").default
		| null;
	export default component;
}

declare module "*scripts/anime/providers/bangumi.mjs" {
	export function fetchBangumiData(config: unknown): Promise<{
		provider: "bangumi";
		accountRef: string;
		rawItems: unknown[];
	}>;
}

declare module "*scripts/anime/providers/bilibili.mjs" {
	export function fetchBilibiliData(config: unknown): Promise<{
		provider: "bilibili";
		accountRef: string;
		rawItems: unknown[];
	}>;
}
