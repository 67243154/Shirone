import { createHash } from "node:crypto";
import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { AdminDocumentError } from "./admin-documents.ts";

export const MAX_IMAGE_UPLOAD_BYTES: number = 20 * 1024 * 1024;

async function directory(root: string): Promise<string> {
	const project = await realpath(root);
	let current = project;
	for (const part of ["public", "uploads", "admin"]) {
		current = join(current, part);
		await mkdir(current, { mode: 0o755 }).catch((error) => {
			if (error.code !== "EEXIST") throw error;
		});
		const info = await lstat(current);
		if (
			!info.isDirectory() ||
			info.isSymbolicLink() ||
			(await realpath(current)) !== resolve(current)
		)
			throw new AdminDocumentError("uploadInvalid", 400);
	}
	return current;
}

export async function saveAdminUpload(
	root: string,
	bytes: Buffer,
): Promise<{ path: string; width: number; height: number }> {
	if (bytes.length > MAX_IMAGE_UPLOAD_BYTES)
		throw new AdminDocumentError("uploadSize", 413);
	if (!bytes.length) throw new AdminDocumentError("uploadInvalid", 400);
	const signature = bytes.toString("ascii", 0, 12);
	const raster =
		bytes
			.subarray(0, 8)
			.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
		(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
		signature.startsWith("GIF87a") ||
		signature.startsWith("GIF89a") ||
		(signature.startsWith("RIFF") && signature.slice(8, 12) === "WEBP") ||
		(signature.slice(4, 8) === "ftyp" &&
			/avif|avis/.test(bytes.toString("ascii", 8, 64)));
	if (!raster) throw new AdminDocumentError("uploadInvalid", 400);
	let image: Buffer;
	let width: number;
	let height: number;
	try {
		const decoder = sharp(bytes, {
			animated: true,
			limitInputPixels: 40_000_000,
		});
		const metadata = await decoder.metadata();
		if (
			!metadata.format ||
			!["png", "jpeg", "webp", "gif", "avif", "heif"].includes(metadata.format)
		)
			throw new Error("Unsupported image format");
		width = metadata.width ?? 0;
		height = metadata.pageHeight ?? metadata.height ?? 0;
		if (!width || !height || (metadata.pages ?? 1) > 256)
			throw new Error("Invalid image dimensions");
		image = await decoder.rotate().webp({ quality: 90 }).toBuffer();
		if (image.length > MAX_IMAGE_UPLOAD_BYTES)
			throw new AdminDocumentError("uploadSize", 413);
	} catch (error) {
		if (error instanceof AdminDocumentError) throw error;
		throw new AdminDocumentError("uploadInvalid", 400);
	}
	const target = await directory(root);
	const name = `${createHash("sha256").update(image).digest("hex")}.webp`;
	await writeFile(join(target, name), image, { flag: "wx", mode: 0o644 }).catch(
		async (error) => {
			if (error.code !== "EEXIST") throw error;
			const existing = await lstat(join(target, name));
			if (!existing.isFile() || existing.isSymbolicLink())
				throw new AdminDocumentError("uploadInvalid", 400);
		},
	);
	return { path: `/uploads/admin/${name}`, width, height };
}

export async function readAdminUpload(
	request: IncomingMessage,
	root: string,
): Promise<{ path: string; width: number; height: number }> {
	if (Number(request.headers["content-length"]) > MAX_IMAGE_UPLOAD_BYTES) {
		request.resume();
		throw new AdminDocumentError("uploadSize", 413);
	}
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of request) {
		const bytes = Buffer.from(chunk);
		size += bytes.length;
		if (size > MAX_IMAGE_UPLOAD_BYTES) {
			request.resume();
			throw new AdminDocumentError("uploadSize", 413);
		}
		chunks.push(bytes);
	}
	return saveAdminUpload(root, Buffer.concat(chunks, size));
}
