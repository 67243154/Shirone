/** Public image route only; executable source and authoring files are never served. */
export function runtimeImageUrl(source: string, basePath = ""): string {
	if (!source || /^(?:\/|https?:|data:)/i.test(source)) return source;
	const joined = source.startsWith("assets/")
		? source
		: `${basePath.replace(/^\/+/, "").replace(/\/?$/, "/")}${source}`.replace(
				/^\//,
				"",
			);
	const segments: string[] = [];
	for (const segment of joined.split("/")) {
		if (!segment || segment === ".") continue;
		if (segment === "..") segments.pop();
		else segments.push(segment);
	}
	const path = segments.join("/");
	return `/__content/assets/?path=${encodeURIComponent(path)}`;
}
