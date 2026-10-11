import assert from "node:assert/strict";
import { mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { generateIconCollections } from "../../src/integration/vite/icon/collections.ts";

test("saving text without changing icons does not rewrite the collection", async () => {
	const root = await mkdtemp(join(tmpdir(), "shirone-admin-icons-"));
	try {
		const source = join(root, "article.md");
		const outputPath = join(root, "generated", "icons.ts");
		await writeFile(source, "material-symbols:add-rounded\nFirst draft.");
		const count = generateIconCollections({ roots: [root], outputPath });
		assert.equal(count, 1);
		await utimes(outputPath, new Date(1000), new Date(1000));
		await writeFile(
			source,
			"material-symbols:add-rounded\nUpdated article text.",
		);
		generateIconCollections({ roots: [root], outputPath });
		assert.equal((await stat(outputPath)).mtimeMs, 1000);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
