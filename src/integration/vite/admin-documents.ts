import { createHash, randomBytes } from "node:crypto";
import {
	lstat,
	readFile,
	realpath,
	rename,
	unlink,
	writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import ts from "typescript";
import type { AdminDocument, AdminField } from "../../types/admin.ts";
import { adminDocuments } from "../../utils/admin-catalog.ts";

export class AdminDocumentError extends Error {
	code: string;
	status: number;
	details: string;
	constructor(code: string, status = 400, details = "") {
		super(code);
		this.code = code;
		this.status = status;
		this.details = details;
	}
}
const hash = (source: string): string =>
	createHash("sha256").update(source).digest("hex");
type Region = AdminField & { start: number; end: number };

/** Read literals only. Calls, identifiers and executable expressions stay in source mode. */
function literal(node: ts.Expression): unknown {
	if (ts.isStringLiteralLike(node)) return node.text;
	if (ts.isNumericLiteral(node)) return Number(node.text);
	if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
	if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
	if (node.kind === ts.SyntaxKind.NullKeyword) return null;
	if (
		ts.isPrefixUnaryExpression(node) &&
		ts.isNumericLiteral(node.operand) &&
		node.operator === ts.SyntaxKind.MinusToken
	)
		return -Number(node.operand.text);
	if (ts.isArrayLiteralExpression(node)) {
		const values = node.elements.map((n) =>
			ts.isExpression(n) ? literal(n) : undefined,
		);
		return values.some((v) => v === undefined) ? undefined : values;
	}
	if (ts.isObjectLiteralExpression(node)) {
		const result: Record<string, unknown> = Object.create(null);
		for (const property of node.properties) {
			if (
				!ts.isPropertyAssignment(property) ||
				!property.name ||
				ts.isComputedPropertyName(property.name)
			)
				return undefined;
			const value = literal(property.initializer);
			if (value === undefined) return undefined;
			result[property.name.getText().replace(/^["']|["']$/g, "")] = value;
		}
		return result;
	}
	return undefined;
}

function regions(source: string, file: string): Region[] {
	if (!file.endsWith(".ts")) return [];
	const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
	const result: Region[] = [];
	function walk(node: ts.Expression, path: string, comment = "") {
		const value = literal(node);
		if (
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean" ||
			Array.isArray(value)
		) {
			const kind = Array.isArray(value)
				? "json"
				: (typeof value as "string" | "number" | "boolean");
			result.push({
				id: String(result.length),
				path,
				comment,
				kind,
				value:
					kind === "json"
						? JSON.stringify(value, null, 2)
						: (value as string | number | boolean),
				start: node.getStart(tree),
				end: node.end,
			});
			return;
		}
		if (ts.isObjectLiteralExpression(node)) {
			for (const property of node.properties) {
				if (
					!ts.isPropertyAssignment(property) ||
					ts.isComputedPropertyName(property.name)
				)
					continue;
				const name = property.name.getText(tree).replace(/^["']|["']$/g, "");
				const before = source.slice(
					property.getFullStart(),
					property.getStart(tree),
				);
				const after = source.slice(
					property.end,
					source.indexOf("\n", property.end) < 0
						? source.length
						: source.indexOf("\n", property.end),
				);
				const comments = [
					...(before.match(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g) ?? []),
					...(after.match(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g) ?? []),
				]
					.map((s) =>
						s.replace(/^\/\*\*?|\*\/$|^\/\/\s*|^\s*\*\s?/gm, "").trim(),
					)
					.join(" ");
				walk(property.initializer, `${path}.${name}`, comments);
			}
		} else if (ts.isArrayLiteralExpression(node)) {
			node.elements.forEach((child, index) => {
				if (ts.isExpression(child)) walk(child, `${path}[${index}]`, comment);
			});
		} else if (
			ts.isCallExpression(node) &&
			node.expression.getText(tree) === "withUserConfig" &&
			node.arguments[1]
		) {
			walk(node.arguments[1], path, comment);
		} else if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node))
			walk(node.expression, path, comment);
	}
	for (const statement of tree.statements) {
		if (ts.isVariableStatement(statement))
			for (const declaration of statement.declarationList.declarations) {
				if (declaration.initializer)
					walk(declaration.initializer, declaration.name.getText(tree));
			}
	}
	return result;
}

export interface AdminDocumentPaths {
	projectRoot: string;
	configDir: string;
	dataDir: string;
	contentDir: string;
	isThemeRepo: boolean;
}

/** Config and data source edits preserve comments/imports and use the existing TS contracts. */
export function createAdminDocumentStore(paths: AdminDocumentPaths): {
	list(): Promise<string[]>;
	read(id: string): Promise<AdminDocument>;
	save(input: {
		id: string;
		version: string;
		source?: string;
		fields?: { id: string; value: unknown }[];
	}): Promise<AdminDocument>;
} {
	let pending: Promise<unknown> = Promise.resolve();
	async function target(id: string): Promise<string> {
		const entry = adminDocuments.find((item) => item.id === id);
		if (!entry) throw new AdminDocumentError("path");
		const root = resolve(
			entry.kind === "config"
				? paths.configDir
				: entry.kind === "data"
					? paths.dataDir
					: paths.contentDir,
		);
		const path = resolve(root, entry.file);
		let segment = root;
		if ((await lstat(root)).isSymbolicLink())
			throw new AdminDocumentError("path");
		for (const part of relative(root, path).split(/[\\/]/)) {
			segment = join(segment, part);
			if ((await lstat(segment)).isSymbolicLink())
				throw new AdminDocumentError("path");
		}
		const suffix = relative(await realpath(root), await realpath(path));
		if (suffix.startsWith("..") || isAbsolute(suffix))
			throw new AdminDocumentError("path");
		return path;
	}
	function shape(id: string, source: string): AdminDocument {
		const entry = adminDocuments.find((item) => item.id === id);
		if (!entry) throw new AdminDocumentError("notFound", 404);
		return {
			id,
			file: entry.file,
			source,
			version: hash(source),
			fields: regions(source, entry.file).map(
				({ start: _start, end: _end, ...field }) => field,
			),
			readonly: id === "integrations" && !paths.isThemeRepo,
		};
	}
	function validate(path: string, source: string): void {
		if (!path.endsWith(".ts")) return;
		const configFile = ts.findConfigFile(
			paths.projectRoot,
			ts.sys.fileExists,
			"tsconfig.json",
		);
		if (!configFile)
			throw new AdminDocumentError("validation", 400, "tsconfig.json missing");
		const config = ts.readConfigFile(configFile, ts.sys.readFile);
		const parsed = ts.parseJsonConfigFileContent(
			config.config,
			ts.sys,
			paths.projectRoot,
		);
		// Generated Astro content declarations reference the entire site. They are
		// unnecessary for config/data contracts and make each save compile all pages.
		const options = {
			...parsed.options,
			types: parsed.options.types ?? [],
			noEmit: true,
			isolatedDeclarations: false,
			skipLibCheck: true,
		};
		const host = ts.createCompilerHost(options);
		const read = host.readFile;
		host.readFile = (file) =>
			resolve(file).toLowerCase() === path.toLowerCase() ? source : read(file);
		const ambient = ["node", "astro/client"].flatMap((name) => {
			const reference = ts.resolveTypeReferenceDirective(
				name,
				join(paths.projectRoot, "__admin__.ts"),
				options,
				ts.sys,
			).resolvedTypeReferenceDirective;
			return reference?.resolvedFileName ? [reference.resolvedFileName] : [];
		});
		const program = ts.createProgram([path, ...ambient], options, host);
		const tree = program.getSourceFile(path);
		if (!tree) throw new AdminDocumentError("validation");
		const issues = [
			...program.getSyntacticDiagnostics(tree),
			...program.getSemanticDiagnostics(tree),
		].filter((d) => d.category === ts.DiagnosticCategory.Error);
		if (issues.length)
			throw new AdminDocumentError(
				"validation",
				400,
				issues
					.slice(0, 8)
					.map((d) => {
						const point = tree.getLineAndCharacterOfPosition(d.start ?? 0);
						return `${point.line + 1}:${point.character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
					})
					.join("\n"),
			);
	}
	return {
		async list() {
			const available: string[] = [];
			for (const entry of adminDocuments) {
				try {
					await target(entry.id);
					available.push(entry.id);
				} catch {
					/* Not scaffolded in this project. */
				}
			}
			return available;
		},
		async read(id) {
			const path = await target(id);
			return shape(id, await readFile(path, "utf8"));
		},
		async save(input) {
			const task = async (): Promise<AdminDocument> => {
				const path = await target(input.id);
				if (input.id === "integrations" && !paths.isThemeRepo)
					throw new AdminDocumentError("readonly", 403);
				const original = await readFile(path, "utf8");
				if (
					typeof input.version !== "string" ||
					hash(original) !== input.version
				)
					throw new AdminDocumentError("conflict", 409);
				if ((typeof input.source === "string") === Array.isArray(input.fields))
					throw new AdminDocumentError("validation");
				let source = input.source ?? original;
				if (input.fields) {
					const known = regions(original, path);
					const patches: { start: number; end: number; value: string }[] = [];
					const ids = new Set<string>();
					for (const field of input.fields) {
						const region = known.find((r) => r.id === field.id);
						if (!region || ids.has(field.id))
							throw new AdminDocumentError("validation");
						ids.add(field.id);
						if (field.value === region.value) continue;
						if (region.kind === "json") {
							if (typeof field.value !== "string")
								throw new AdminDocumentError("validation");
							try {
								const value = JSON.parse(field.value);
								if (!Array.isArray(value)) throw new Error();
								patches.push({
									...region,
									value: JSON.stringify(value, null, 2),
								});
							} catch {
								throw new AdminDocumentError("validation");
							}
						} else {
							if (
								typeof field.value !== region.kind ||
								(region.kind === "number" && !Number.isFinite(field.value))
							)
								throw new AdminDocumentError("validation");
							patches.push({ ...region, value: JSON.stringify(field.value) });
						}
					}
					for (const patch of patches.sort((a, b) => b.start - a.start))
						source =
							source.slice(0, patch.start) +
							patch.value +
							source.slice(patch.end);
				}
				if (Buffer.byteLength(source) > 1024 * 1024)
					throw new AdminDocumentError("size", 413);
				if (source === original) return shape(input.id, source);
				validate(path, source);
				const temp = `${path}.${randomBytes(6).toString("hex")}.admin-tmp`;
				try {
					await writeFile(temp, source, { encoding: "utf8", flag: "wx" });
					await target(input.id);
					if (hash(await readFile(path, "utf8")) !== input.version)
						throw new AdminDocumentError("conflict", 409);
					await rename(temp, path);
				} finally {
					await unlink(temp).catch(() => {});
				}
				return shape(input.id, source);
			};
			const result = pending.then(task);
			pending = result.catch(() => {});
			return result;
		},
	};
}
