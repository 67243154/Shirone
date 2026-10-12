import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { sendStaticFile } from "../../scripts/runtime/static-file.mjs";

test("static media supports complete, HEAD, bounded, open and suffix ranges", async () => {
	const directory = await mkdtemp(join(tmpdir(), "shirone-media-"));
	const file = join(directory, "track.mp3");
	const bytes = Buffer.from(
		Array.from({ length: 1024 }, (_, index) => index % 256),
	);
	await writeFile(file, bytes);
	const info = await stat(file);
	const server = createServer((request, response) => {
		sendStaticFile(request, response, file, info, {
			"Content-Type": "audio/mpeg",
		}).catch((error) => response.destroy(error));
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const url = `http://127.0.0.1:${server.address().port}/track.mp3`;
	try {
		const complete = await fetch(url);
		assert.equal(complete.headers.get("accept-ranges"), "bytes");
		assert.equal(complete.headers.get("content-type"), "audio/mpeg");
		assert.deepEqual(Buffer.from(await complete.arrayBuffer()), bytes);
		const head = await fetch(url, { method: "HEAD" });
		assert.equal(head.headers.get("content-length"), "1024");
		assert.equal((await head.arrayBuffer()).byteLength, 0);
		for (const [range, start, end] of [
			["bytes=100-199", 100, 199],
			["bytes=1000-", 1000, 1023],
			["bytes=-20", 1004, 1023],
			["bytes=1000-9999", 1000, 1023],
		]) {
			const result = await fetch(url, { headers: { Range: range } });
			assert.equal(result.status, 206);
			assert.equal(
				result.headers.get("content-range"),
				`bytes ${start}-${end}/1024`,
			);
			assert.equal(
				result.headers.get("content-length"),
				String(end - start + 1),
			);
			assert.deepEqual(
				Buffer.from(await result.arrayBuffer()),
				bytes.subarray(start, end + 1),
			);
		}
		for (const range of [
			"bytes=1024-",
			"bytes=200-100",
			"bytes=-0",
			"bytes=1-2,4-5",
		]) {
			const result = await fetch(url, { headers: { Range: range } });
			assert.equal(result.status, 416);
			assert.equal(result.headers.get("content-range"), "bytes */1024");
		}
	} finally {
		server.close();
		await once(server, "close");
		await rm(directory, { recursive: true, force: true });
	}
});
