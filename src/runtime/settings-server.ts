import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	createRuntimeExport,
	emptyRuntimeState,
	type RuntimeState,
} from "./settings-shared.ts";

const context = new AsyncLocalStorage<RuntimeState>();
const cache = new Map<string, { signature: string; state: RuntimeState }>();
export function readRuntimeState(root: string): RuntimeState {
	const file = join(root, ".shirones", "runtime", "settings.json");
	let info: import("node:fs").Stats;
	try {
		info = statSync(file);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		cache.delete(file);
		return emptyRuntimeState();
	}
	const signature = `${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
	const saved = cache.get(file);
	if (saved?.signature === signature) return saved.state;
	const state = JSON.parse(readFileSync(file, "utf8")) as RuntimeState;
	if (
		state.schema !== 1 ||
		typeof state.revision !== "string" ||
		!state.modules ||
		typeof state.modules !== "object"
	)
		throw new Error("Invalid runtime settings");
	cache.set(file, { signature, state });
	return state;
}
export const runtimeExport: ReturnType<typeof createRuntimeExport> =
	createRuntimeExport(() => context.getStore() ?? emptyRuntimeState());
export const currentRuntimeState = (): RuntimeState =>
	context.getStore() ?? emptyRuntimeState();
export function withRuntimeState<T>(state: RuntimeState, next: () => T): T {
	return context.run(state, next);
}
