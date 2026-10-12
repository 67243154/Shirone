/** Image fields can contain source assets, public paths or remote URLs. */
export function isAdminImageField(field: string, value: unknown = ""): boolean {
	const path = field.replace(/\[\d+\]/g, "");
	return (
		/(?:^|\.)(?:image|images|avatar|cover|poster|thumbnail|backgroundImage|imgurl|logo|src|favicon|photos|pictures|screenshots|portrait|coverImage|bannerImage)$/i.test(
			path,
		) ||
		/\.src(?:\.(?:desktop|mobile|light|dark))+$/.test(path) ||
		(typeof value === "string" &&
			/\.(?:png|jpe?g|webp|avif|gif|svg|ico)(?:[?#]|$)/i.test(value))
	);
}
export function adminImageValues(value: unknown, field: string): string[] {
	if (typeof value === "string") {
		const imageField = isAdminImageField(field, value);
		return value.trim() &&
			(imageField ||
				/\.(?:png|jpe?g|webp|avif|gif|svg|ico)(?:[?#]|$)/i.test(value))
			? [value.trim()]
			: [];
	}
	if (Array.isArray(value))
		return value.flatMap((item) => adminImageValues(item, field));
	if (value && typeof value === "object")
		return Object.entries(value).flatMap(([key, item]) =>
			adminImageValues(item, `${field}.${key}`),
		);
	return [];
}

export function adminImageUrl(value: string, post = ""): string {
	if (/^https?:\/\//i.test(value)) return value;
	if (/^\/\//.test(value)) return `https:${value}`;
	if (/^[a-z][a-z\d+.-]*:/i.test(value)) return "";
	return `/__admin/api/image?path=${encodeURIComponent(value)}&post=${encodeURIComponent(post)}`;
}
