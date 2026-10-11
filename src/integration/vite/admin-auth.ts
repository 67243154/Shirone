import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const lifetime = 8 * 60 * 60 * 1000;
export const adminCookie = "shirone_admin_session";
const hashToken = (token: string): string =>
	createHash("sha256").update(token).digest("hex");
interface Credential {
	version: 1;
	salt: string;
	hash: string;
}
export interface AdminAuth {
	configured: () => Promise<boolean>;
	authenticated: (token: string) => boolean;
	logout: (token: string) => void;
	setup: (password: unknown) => Promise<string>;
	login: (password: unknown) => Promise<string>;
}
export class AdminAuthError extends Error {
	code: string;
	status: number;
	constructor(code: string, status: number) {
		super(code);
		this.code = code;
		this.status = status;
	}
}

export function createAdminAuth(
	file: string,
	now: () => number = Date.now,
): AdminAuth {
	const sessions = new Map<string, number>();
	let failures = 0;
	let blockedUntil = 0;
	let pending: Promise<unknown> = Promise.resolve();
	let queued = 0;
	async function credentials(): Promise<Credential | null> {
		try {
			const data = JSON.parse(await readFile(file, "utf8")) as Credential;
			if (
				data.version !== 1 ||
				!/^[a-f0-9]{64}$/.test(data.salt) ||
				!/^[a-f0-9]{128}$/.test(data.hash)
			)
				throw new Error("credential");
			return data;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
			throw new AdminAuthError("authUnavailable", 503);
		}
	}
	function exclusive<T>(task: () => Promise<T>): Promise<T> {
		if (queued >= 2)
			return Promise.reject(new AdminAuthError("rateLimit", 429));
		queued++;
		const result = pending.then(task).finally(() => {
			queued--;
		});
		pending = result.catch(() => {});
		return result;
	}
	function password(value: unknown): asserts value is string {
		if (
			typeof value !== "string" ||
			value.length < 6 ||
			value.length > 20 ||
			value.trim().length < 6
		)
			throw new AdminAuthError("passwordInvalid", 400);
	}
	async function digest(value: string, salt: string): Promise<Buffer> {
		return new Promise((resolve, reject) =>
			scrypt(
				value,
				Buffer.from(salt, "hex"),
				64,
				{ N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
				(error, hash) => (error ? reject(error) : resolve(hash)),
			),
		);
	}
	function throttle() {
		if (now() < blockedUntil) throw new AdminAuthError("rateLimit", 429);
		if (blockedUntil) {
			failures = 0;
			blockedUntil = 0;
		}
	}
	function issue(): string {
		for (const [key, expiry] of sessions)
			if (expiry <= now()) sessions.delete(key);
		if (sessions.size >= 16) {
			const oldest = sessions.keys().next().value;
			if (oldest !== undefined) sessions.delete(oldest);
		}
		const token = randomBytes(32).toString("hex");
		sessions.set(hashToken(token), now() + lifetime);
		return token;
	}
	function authenticated(token: string): boolean {
		if (!/^[a-f0-9]{64}$/.test(token)) return false;
		const key = hashToken(token);
		const expiry = sessions.get(key);
		if (!expiry || expiry <= now()) {
			sessions.delete(key);
			return false;
		}
		return true;
	}
	return {
		configured: async (): Promise<boolean> => !!(await credentials()),
		authenticated,
		logout: (token: string): void => {
			sessions.delete(hashToken(token));
		},
		setup: (value: unknown): Promise<string> =>
			exclusive(async () => {
				throttle();
				password(value);
				if (await credentials())
					throw new AdminAuthError("alreadyConfigured", 409);
				const salt = randomBytes(32).toString("hex");
				const hash = (await digest(value, salt)).toString("hex");
				try {
					await writeFile(file, JSON.stringify({ version: 1, salt, hash }), {
						flag: "wx",
						mode: 0o600,
					});
				} catch (error) {
					throw new AdminAuthError(
						(error as NodeJS.ErrnoException).code === "EEXIST"
							? "alreadyConfigured"
							: "authUnavailable",
						(error as NodeJS.ErrnoException).code === "EEXIST" ? 409 : 503,
					);
				}
				return issue();
			}),
		login: (value: unknown): Promise<string> =>
			exclusive(async () => {
				throttle();
				password(value);
				const credential = await credentials();
				if (!credential) throw new AdminAuthError("setupRequired", 409);
				const actual = await digest(value, credential.salt);
				if (!timingSafeEqual(actual, Buffer.from(credential.hash, "hex"))) {
					if (++failures >= 5) blockedUntil = now() + 10 * 60 * 1000;
					throw new AdminAuthError("credentials", 401);
				}
				failures = 0;
				blockedUntil = 0;
				return issue();
			}),
	};
}

export function adminSessionCookie(token: string, secure = false): string {
	return `${adminCookie}=${token}; HttpOnly; SameSite=Strict; Path=/__admin/; Max-Age=${token ? lifetime / 1000 : 0}${secure ? "; Secure" : ""}`;
}
export function adminSessionToken(cookie: string | undefined): string {
	return (
		cookie
			?.split(";")
			.map((item) => item.trim())
			.find((item) => item.startsWith(`${adminCookie}=`))
			?.slice(adminCookie.length + 1) ?? ""
	);
}
