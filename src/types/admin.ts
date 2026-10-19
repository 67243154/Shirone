export interface AdminPost {
	file: string;
	version: string;
	title: string;
	published: string;
	description: string;
	category: string;
	tags: string[];
	image: string;
	draft: boolean;
	pinned: boolean;
	body?: string;
	encrypted?: boolean;
	hasPassword?: boolean;
	passwordHint?: string;
	/** Available only in authenticated single-article responses, never lists. */
	password?: string;
}

export interface AdminPostBatch {
	action: "delete" | "draft" | "publish";
	posts: { file: string; version: string }[];
}

export interface AdminSave {
	file: string;
	version?: string;
	create: boolean;
	title: string;
	published: string;
	description: string;
	category: string;
	tags: string[];
	image: string;
	draft: boolean;
	pinned: boolean;
	body: string;
	encrypted?: boolean;
	hasPassword?: boolean;
	/** An empty value retains the existing password. */
	password?: string;
	passwordHint?: string;
}

export interface AdminField {
	id: string;
	path: string;
	comment: string;
	kind: "string" | "number" | "boolean" | "json";
	value: string | number | boolean;
	readonly?: boolean;
}

export interface AdminDocument {
	id: string;
	file: string;
	version: string;
	source: string;
	fields: AdminField[];
	readonly: boolean;
	mode?: "runtime" | "deployment";
}
