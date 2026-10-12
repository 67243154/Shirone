import {
	createRuntimeExport,
	emptyRuntimeState,
	type RuntimeState,
} from "./settings-shared";

let cachedText = "";
let cachedState = emptyRuntimeState();
export function currentRuntimeState(): RuntimeState {
	if (typeof document === "undefined") return cachedState;
	const text =
		document.getElementById("shirone-runtime-state")?.textContent ?? "";
	if (text && text !== cachedText) {
		cachedState = JSON.parse(text) as RuntimeState;
		cachedText = text;
	}
	return cachedState;
}
export const runtimeExport: ReturnType<typeof createRuntimeExport> =
	createRuntimeExport(currentRuntimeState);
