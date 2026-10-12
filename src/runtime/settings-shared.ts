export interface RuntimeState {
	schema: 1;
	revision: string;
	modules: Record<string, Record<string, unknown>>;
	documents?: Record<string, { patches: Record<string, unknown> }>;
}

export const emptyRuntimeState = (): RuntimeState => ({
	schema: 1,
	revision: "initial",
	modules: {},
});

export function mergeRuntime(base: unknown, patch: unknown): unknown {
	if (patch === undefined) return base;
	if (
		!base ||
		!patch ||
		typeof base !== "object" ||
		typeof patch !== "object" ||
		Array.isArray(base) ||
		Array.isArray(patch)
	)
		return patch;
	const result = { ...base } as Record<string, unknown>;
	for (const [key, value] of Object.entries(patch)) {
		if (["__proto__", "constructor", "prototype"].includes(key))
			throw new Error("Invalid configuration key");
		result[key] = mergeRuntime(result[key], value);
	}
	return result;
}

/** Stable module exports whose properties read the current request snapshot. */
export function createRuntimeExport(read: () => RuntimeState) {
	return function runtimeExport<T>(
		id: string,
		key: string,
		fallback: T,
		derive?: () => T,
	): T {
		if (!fallback || typeof fallback !== "object") return fallback;
		const value = () =>
			mergeRuntime(
				derive ? derive() : fallback,
				read().modules[id]?.[key],
			) as Record<PropertyKey, unknown>;
		return new Proxy(Array.isArray(fallback) ? [] : {}, {
			get(_target, property) {
				const current = value();
				const item = current[property];
				return typeof item === "function" && property !== "constructor"
					? item.bind(current)
					: item;
			},
			has(_target, property) {
				return property in value();
			},
			ownKeys() {
				return Reflect.ownKeys(value());
			},
			getOwnPropertyDescriptor(target, property) {
				const descriptor = Reflect.getOwnPropertyDescriptor(value(), property);
				if (property === "length" && Array.isArray(target))
					return {
						...Reflect.getOwnPropertyDescriptor(target, property),
						value: value().length,
					};
				return descriptor ? { ...descriptor, configurable: true } : undefined;
			},
		}) as T;
	};
}
