import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

/** Single byte ranges let browsers seek without downloading an entire media file. */
export async function sendStaticFile(request, response, file, info, headers) {
	if (!["GET", "HEAD"].includes(request.method)) {
		response.writeHead(405, { Allow: "GET, HEAD" });
		return response.end();
	}
	const common = {
		...headers,
		"Accept-Ranges": "bytes",
		"Last-Modified": info.mtime.toUTCString(),
	};
	let start = 0;
	let end = info.size - 1;
	let partial = false;
	const range = request.headers.range;
	const ifRange = request.headers["if-range"];
	const canRange =
		!ifRange ||
		(Number.isFinite(Date.parse(ifRange)) &&
			Math.floor(info.mtimeMs / 1000) <=
				Math.floor(Date.parse(ifRange) / 1000));
	if (request.method === "GET" && range && canRange) {
		const match = /^bytes=(\d*)-(\d*)$/.exec(range);
		if (match && (match[1] || match[2])) {
			if (!match[1]) {
				const length = Number(match[2]);
				start = Math.max(0, info.size - length);
				if (!Number.isSafeInteger(length) || length === 0) start = info.size;
			} else {
				start = Number(match[1]);
				if (match[2]) end = Math.min(Number(match[2]), end);
			}
			partial =
				Number.isSafeInteger(start) &&
				Number.isSafeInteger(end) &&
				start >= 0 &&
				start <= end &&
				start < info.size;
		}
		if (!partial) {
			response.writeHead(416, {
				...common,
				"Content-Range": `bytes */${info.size}`,
				"Content-Length": "0",
			});
			return response.end();
		}
	}
	response.writeHead(partial ? 206 : 200, {
		...common,
		"Content-Length": String(partial ? end - start + 1 : info.size),
		...(partial
			? { "Content-Range": `bytes ${start}-${end}/${info.size}` }
			: {}),
	});
	if (request.method === "HEAD" || info.size === 0) return response.end();
	try {
		await pipeline(createReadStream(file, { start, end }), response);
	} catch (error) {
		// Seeking cancels the preceding media download; this is an ordinary disconnect.
		if (request.aborted || response.destroyed) return;
		throw error;
	}
}
