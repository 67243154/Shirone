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
}

export interface AdminField {
	id: string;
	path: string;
	comment: string;
	kind: "string" | "number" | "boolean" | "json";
	value: string | number | boolean;
}

export interface AdminDocument {
	id: string;
	file: string;
	version: string;
	source: string;
	fields: AdminField[];
	readonly: boolean;
}
