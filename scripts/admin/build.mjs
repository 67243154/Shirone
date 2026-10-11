import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../../", import.meta.url));
await build({
	absWorkingDir: root,
	entryPoints: ["scripts/admin/server.mjs"],
	outfile: ".shirones/admin-server.mjs",
	bundle: true,
	platform: "node",
	format: "esm",
	packages: "external",
	target: "node24",
});
