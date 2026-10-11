import { access } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { createAdminMiddleware } from "../../src/integration/vite/admin.ts";
import { createPublisher } from "./publish.mjs";

const required = (name) => {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required`);
	return value;
};
const projectRoot = resolve(required("SHIRONE_ADMIN_PROJECT"));
const authFile = resolve(required("SHIRONE_ADMIN_AUTH_FILE"));
await access(authFile); // Provision through SSH; never expose remote password setup.
const contentDir = join(projectRoot, "src", "content");
const publish = createPublisher({
	projectRoot,
	publicRoot: required("SHIRONE_ADMIN_PUBLIC_ROOT"),
	pnpm: required("SHIRONE_ADMIN_PNPM"),
});
const middleware = createAdminMiddleware(
	contentDir,
	projectRoot,
	{
		projectRoot,
		contentDir,
		configDir: join(projectRoot, "src", "config"),
		dataDir: join(projectRoot, "src", "data"),
		isThemeRepo: true,
	},
	{
		origin: required("SHIRONE_ADMIN_ORIGIN"),
		authFile,
		afterSave: publish,
	},
);
const server = createServer((request, response) => {
	void middleware(request, response, () => {
		response.writeHead(404, { "Content-Type": "application/json" });
		response.end('{"code":"notFound"}');
	}).catch(() => {
		if (!response.headersSent) response.writeHead(500);
		response.end('{"code":"unavailable"}');
	});
});
server.requestTimeout = 540000;
server.headersTimeout = 15000;
server.listen(
	Number(process.env.SHIRONE_ADMIN_PORT ?? "4324"),
	"127.0.0.1",
	() => {
		console.log("Shirone authenticated admin API listening on loopback");
	},
);
for (const signal of ["SIGTERM", "SIGINT"])
	process.on(signal, () => server.close(() => process.exit(0)));
