import { defineMiddleware } from "astro:middleware";
import { createHash } from "node:crypto";
import { contentDir, projectRoot } from "virtual:shirone-runtime-paths";
import { readRuntimeEntries } from "./files";
import { readRuntimeState, withRuntimeState } from "./settings-server";

export const onRequest: import("astro").MiddlewareHandler = defineMiddleware(
	async (context, next) => {
		const state = readRuntimeState(projectRoot);
		const entries = context.url.pathname.startsWith("/__content/")
			? []
			: (
					await Promise.all(
						["posts", "moments", "spec", "series"].map((collection) =>
							readRuntimeEntries(contentDir, collection),
						),
					)
				).flat();
		// SSR data is passed only to the page that renders it, never duplicated in the global client snapshot.
		context.locals.runtimeState = {
			schema: 1,
			revision: state.revision,
			modules: Object.fromEntries(
				Object.entries(state.modules).filter(([id]) => !id.startsWith("data-")),
			),
		};
		context.locals.runtimeRevision = `${state.revision}-${createHash("sha256")
			.update(
				entries
					.map((entry) => `${entry.id}:${entry.fingerprint}`)
					.sort()
					.join("|"),
			)
			.digest("hex")
			.slice(0, 16)}`;
		// Includes and cross-article links must also expire when another source changes.
		const response = await withRuntimeState(
			{ ...state, revision: context.locals.runtimeRevision },
			next,
		);
		if (!response.headers.has("Cache-Control"))
			response.headers.set("Cache-Control", "no-store");
		return response;
	},
);
