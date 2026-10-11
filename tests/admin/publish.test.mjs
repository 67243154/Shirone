import assert from "node:assert/strict";
import { mkdir, mkdtemp, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createPublisher } from "../../scripts/admin/publish.mjs";

test("publication serializes builds and leaves the live release intact on failure", { skip: process.platform === "win32" }, async () => {
 const root = await mkdtemp(join(tmpdir(), "shirone-publish-"));
 let fail = false;
 let active = 0;
 let maximum = 0;
 const publish = createPublisher({
  projectRoot: root, publicRoot: root,
  runBuild: async (release) => {
   maximum = Math.max(maximum, ++active);
   try {
    await new Promise((done) => setTimeout(done, 15));
    if (fail) throw Error("build failed");
    await mkdir(join(release, "admin"));
    await mkdir(join(release, "pagefind"));
    await writeFile(join(release, "index.html"), "published");
    await writeFile(join(release, "admin", "index.html"), "admin");
    await writeFile(join(release, "pagefind", "pagefind.js"), "index");
   } finally { active--; }
  },
 });
 try {
  await Promise.all([publish(), publish()]);
  assert.equal(maximum, 1);
  const before = await readlink(join(root, "current"));
  fail = true;
  await assert.rejects(publish());
  assert.equal(await readlink(join(root, "current")), before);
  fail = false;
  await publish();
  assert.notEqual(await readlink(join(root, "current")), before);
 } finally { await rm(root, { recursive: true, force: true }); }
});
