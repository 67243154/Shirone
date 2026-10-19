<script lang="ts">
import Button from "@components/atoms/action/Button.svelte";
import TextField from "@components/atoms/input/TextField.svelte";
import Switch from "@components/atoms/selection/Switch.svelte";
import Checkbox from "@components/atoms/selection/Checkbox.svelte";
import Select from "@components/atoms/input/Select.svelte";
import Dialog from "@components/atoms/overlay/Dialog.svelte";
import AdminImageField from "@components/molecules/AdminImageField.svelte";
import AdminSettings from "@components/organisms/AdminSettings.svelte";
import { url } from "@utils/url-utils";
import { onMount, tick } from "svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import type { AdminPost, AdminPostBatch, AdminSave } from "@/types/admin";
import { adminStyles } from "./admin.styles";

let {
	local = false,
	remote = false,
	dynamic = false,
}: { local?: boolean; remote?: boolean; dynamic?: boolean } = $props();
let locale = $state("zh_CN");
const t = (key: I18nKey): string => i18n(key, locale);
let posts = $state<AdminPost[]>([]);
let query = $state("");
let filter = $state("all");
let category = $state("all");
let selected = $state<string[]>([]);
let deleteOpen = $state(false);
let deleteTargets = $state<AdminPost[]>([]);
const categoryItems = $derived([
	{ value: "all", label: t(I18nKey.adminAllCategories) },
	{ value: "uncategorized", label: t(I18nKey.uncategorized) },
	...Array.from(new Set(posts.map((post) => post.category).filter(Boolean)))
		.sort((a, b) => a.localeCompare(b))
		.map((value) => ({ value: `category:${value}`, label: value })),
]);
$effect(() => {
	query;
	filter;
	category;
	group;
	selected = [];
	deleteOpen = false;
});
let group = $state("posts");
let settingsDirty = $state(false);
let settingsSaving = $state(false);
let imageUploads = $state(0);
let loading = $state(local);
let saving = $state(false);
let message = $state("");
let error = $state<I18nKey | null>(null);
let form = $state<AdminSave | null>(null);
let original = $state("");
let originalPassword = $state("");
let tagInput = $state("");
let preview = $state(false);
let previewHtml = $state("");
let previewLoading = $state(false);
let authenticated = $state(!local);
let authChecking = $state(local);
let configured = $state(true);
let password = $state("");
let confirmPassword = $state("");
let authBusy = $state(false);
let authIssue = $state<I18nKey | null>(null);
let token = "";
let active = true;
let loadGeneration = 0;
let previewGeneration = 0;
let editorTitle: HTMLInputElement;
const dirty = $derived(
	settingsDirty ||
		(form !== null &&
			JSON.stringify({
				...form,
				tags: tagInput
					.split(/[,，]/)
					.map((tag) => tag.trim())
					.filter(Boolean),
			}) !== original),
);
const visible = $derived(
	posts.filter(
		(post) =>
			(filter === "all" || (filter === "draft" ? post.draft : !post.draft)) &&
			(category === "all" ||
				(category === "uncategorized"
					? !post.category
					: `category:${post.category}` === category)) &&
			`${post.title} ${post.category} ${post.tags.join(" ")}`
				.toLowerCase()
				.includes(query.toLowerCase()),
	),
);
const draftCount = $derived(posts.filter((post) => post.draft).length);
const selectionState = $derived(
	selected.length === 0
		? false
		: visible.every((post) => selected.includes(post.file))
			? true
			: null,
);

function selectPost(file: string, checked: boolean | null) {
	if (checked && selected.length < 200)
		selected = [...selected.filter((value) => value !== file), file];
	else selected = selected.filter((value) => value !== file);
}
function requestDelete(targets: AdminPost[]) {
	if (saving || !targets.length) return;
	deleteTargets = targets;
	deleteOpen = true;
}
async function manage(
	action: AdminPostBatch["action"],
	targets = posts.filter((post) => selected.includes(post.file)),
) {
	if (saving || !targets.length) return;
	deleteOpen = false;
	saving = true;
	error = null;
	message = "";
	try {
		const result = await api<{ count: number }>("posts/batch", {
			action,
			posts: targets.map(({ file, version }) => ({ file, version })),
		});
		if (!active) return;
		selected = [];
		await refresh();
		message = t(
			action === "delete" ? I18nKey.adminDeleted : I18nKey.adminBatchSaved,
		).replace("{count}", String(result.count));
	} catch (issue) {
		if (active) error = errorKey((issue as Error).message);
	} finally {
		if (active) saving = false;
	}
}

function errorKey(code: string): I18nKey {
	if (code === "encryptionPasswordRequired")
		return I18nKey.adminEncryptPasswordRequired;
	if (code === "encryptionPasswordInvalid")
		return I18nKey.adminEncryptPasswordInvalid;
	if (code === "conflict") return I18nKey.adminConflict;
	if (code === "exists") return I18nKey.adminExists;
	if (code === "external") return I18nKey.adminExternal;
	if (code === "publish") return I18nKey.adminPublishFailed;
	if (code === "deploymentRequired") return I18nKey.adminDeploymentHint;
	if (code === "unsupportedMdx") return I18nKey.adminUnsupportedMdx;
	if (["validation", "slug", "path", "size"].includes(code))
		return I18nKey.adminInvalid;
	return I18nKey.adminUnavailable;
}
async function api<T>(path: string, data?: unknown): Promise<T> {
	if (!path.startsWith("auth/") && path !== "session" && !token)
		token = (await api<{ token: string }>("session")).token;
	const binary = data instanceof Blob;
	const response = await fetch(`/__admin/api/${path}`, {
		method: data ? "POST" : "GET",
		headers: {
			"X-Shirone-Admin": token,
			...(data
				? {
						"Content-Type": binary
							? (data as Blob).type || "application/octet-stream"
							: "application/json",
					}
				: {}),
		},
		...(data ? { body: binary ? (data as Blob) : JSON.stringify(data) } : {}),
		signal: AbortSignal.timeout(
			path === "upload-image" && data
				? 120000
				: remote && data
					? 540000
					: path === "document" && data
						? 45000
						: 15000,
		),
	});
	const result = await response.json();
	if (result.code === "unauthorized") {
		authenticated = false;
		token = "";
		posts = [];
		form = null;
		original = "";
		group = "posts";
		settingsDirty = false;
		authIssue = I18nKey.adminAuthExpired;
	}
	if (!response.ok)
		throw Object.assign(new Error(result.code ?? "unavailable"), {
			details: result.details,
		});
	return result as T;
}
async function uploadImage(file: File): Promise<string> {
	imageUploads += 1;
	try {
		return (await api<{ path: string }>("upload-image", file)).path;
	} finally {
		imageUploads -= 1;
	}
}
async function checkAuth() {
	authChecking = true;
	try {
		const status = await api<{ configured: boolean; authenticated: boolean }>(
			"auth/status",
		);
		if (!active) return;
		configured = status.configured;
		authenticated = status.authenticated;
		if (authenticated) await refresh();
	} catch {
		if (active) authIssue = I18nKey.adminUnavailable;
	} finally {
		if (active) authChecking = false;
	}
}
async function authenticate(event: SubmitEvent) {
	event.preventDefault();
	if (authBusy) return;
	authIssue = null;
	if (!configured && password !== confirmPassword) {
		authIssue = I18nKey.adminAuthMismatch;
		return;
	}
	authBusy = true;
	try {
		await api(`auth/${configured ? "login" : "setup"}`, { password });
		if (!active) return;
		authenticated = true;
		configured = true;
		token = "";
		password = "";
		confirmPassword = "";
		await refresh();
	} catch (issue) {
		if (active)
			authIssue =
				{
					credentials: I18nKey.adminAuthWrong,
					rateLimit: I18nKey.adminAuthRateLimit,
					passwordInvalid: I18nKey.adminAuthHint,
					alreadyConfigured: I18nKey.adminAuthConfigured,
				}[(issue as Error).message] ?? I18nKey.adminUnavailable;
		if ((issue as Error).message === "alreadyConfigured") configured = true;
	} finally {
		password = "";
		confirmPassword = "";
		authBusy = false;
	}
}
async function logout() {
	if (
		saving ||
		settingsSaving ||
		(dirty && !window.confirm(t(I18nKey.adminUnsaved)))
	)
		return;
	try {
		await api("auth/logout", {});
		token = "";
		posts = [];
		form = null;
		original = "";
		group = "posts";
		settingsDirty = false;
		authenticated = false;
		error = null;
		message = "";
		authIssue = null;
	} catch {
		error = I18nKey.adminUnavailable;
	}
}
async function refresh() {
	const generation = ++loadGeneration;
	loading = true;
	error = null;
	try {
		if (!token) token = (await api<{ token: string }>("session")).token;
		const result = await api<{ posts: AdminPost[] }>("posts");
		if (active && generation === loadGeneration) {
			posts = result.posts;
			if (
				category.startsWith("category:") &&
				!posts.some((post) => `category:${post.category}` === category)
			)
				category = "all";
		}
	} catch (issue) {
		if (active && generation === loadGeneration)
			error = errorKey((issue as Error).message);
	} finally {
		if (active && generation === loadGeneration) loading = false;
	}
}
async function open(post?: AdminPost) {
	if (saving) return;
	if (dirty && !window.confirm(t(I18nKey.adminUnsaved))) return;
	error = null;
	message = "";
	preview = false;
	previewHtml = "";
	++previewGeneration;
	try {
		const value: AdminSave = post
			? {
					...(await api<AdminPost & { body: string }>(
						`post?file=${encodeURIComponent(post.file)}`,
					)),
					create: false,
				}
			: {
					create: true,
					file: "",
					title: "",
					published: new Date().toLocaleDateString("en-CA"),
					description: "",
					category: "",
					tags: [],
					image: "",
					draft: true,
					pinned: false,
					body: "",
					encrypted: false,
					hasPassword: false,
					password: "",
					passwordHint: "",
				};
		if (!active) return;
		form = value;
		originalPassword = value.password ?? "";
		tagInput = value.tags.join(", ");
		original = JSON.stringify(value);
		await tick();
		editorTitle?.focus();
	} catch (issue) {
		error = errorKey((issue as Error).message);
	}
}
function back() {
	if (saving || imageUploads > 0) return;
	if (dirty && !window.confirm(t(I18nKey.adminUnsaved))) return;
	form = null;
	message = "";
	error = null;
	++previewGeneration;
}
async function save(event: SubmitEvent) {
	event.preventDefault();
	if (!form || saving || imageUploads > 0) return;
	saving = true;
	error = null;
	message = "";
	try {
		const data = {
			...form,
			password: form.encrypted ? form.password : "",
			tags: tagInput
				.split(/[,，]/)
				.map((tag) => tag.trim())
				.filter(Boolean),
			...(form.create ? { file: `${form.file.replace(/\.md$/, "")}.md` } : {}),
		};
		const saved = await api<AdminPost & { body: string }>("post", data);
		if (!active) return;
		form = { ...saved, create: false };
		originalPassword = saved.password ?? "";
		tagInput = saved.tags.join(", ");
		original = JSON.stringify(form);
		message = t(
			dynamic
				? I18nKey.adminDynamicSaved
				: remote
					? I18nKey.adminServerSaved
					: I18nKey.adminSaved,
		);
		await refresh();
	} catch (issue) {
		if (active) error = errorKey((issue as Error).message);
	} finally {
		if (active) saving = false;
	}
}
async function showPreview() {
	if (!form) return;
	preview = true;
	previewLoading = true;
	const generation = ++previewGeneration;
	try {
		const result = await api<{ html: string }>("preview", { body: form.body });
		if (active && generation === previewGeneration) previewHtml = result.html;
	} catch (issue) {
		if (active && generation === previewGeneration)
			error = errorKey((issue as Error).message);
	} finally {
		if (active && generation === previewGeneration) previewLoading = false;
	}
}
onMount(() => {
	const syncLanguage = () => {
		locale = document.documentElement.dataset.uiLanguage ?? "zh_CN";
	};
	syncLanguage();
	document.addEventListener("site:language-change", syncLanguage);
	const unload = (event: BeforeUnloadEvent) => {
		if (dirty) {
			event.preventDefault();
			event.returnValue = "";
		}
	};
	window.addEventListener("beforeunload", unload);
	if (local) void checkAuth();
	return () => {
		active = false;
		document.removeEventListener("site:language-change", syncLanguage);
		window.removeEventListener("beforeunload", unload);
	};
});
</script>

<svelte:head>{@html `<style data-admin-styles>${adminStyles}</style>`}</svelte:head>

{#snippet symbol(name: string)}
 <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  {#if name === "add"}<path d="M12 5v14M5 12h14" />
  {:else if name === "edit"}<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" />
  {:else if name === "draft"}<path d="M8 3h8l4 4v14H4V3h4M15 3v5h5M8 12h8M8 16h5" />
  {:else if name === "published"}<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>
  {:else if name === "settings"}<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>
  {:else if name === "delete"}<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/>
  {:else}<path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" />{/if}
 </svg>
{/snippet}

{#if local && !authenticated}
 <main class="admin-auth" data-admin-workspace id="admin-main" data-pagefind-ignore>
  <section class="admin-panel admin-auth-card">
   <p class="admin-eyebrow">{t(I18nKey.adminTitle)}</p>
   {#if authChecking}<h1>{t(I18nKey.adminAuthLogin)}</h1><p role="status">{t(I18nKey.adminLoading)}</p>
   {:else}
    <h1>{t(configured ? I18nKey.adminAuthLogin : I18nKey.adminAuthSetup)}</h1>
    <p class="admin-helper">{t(configured ? I18nKey.adminAuthLoginHint : I18nKey.adminAuthHint)}</p>
    <form class="admin-auth-form" onsubmit={authenticate}>
     <label for="admin-password">{t(I18nKey.adminAuthPassword)}</label>
     <input id="admin-password" type="password" autocomplete={configured ? "current-password" : "new-password"} bind:value={password} minlength="6" maxlength="20" required disabled={authBusy} />
     {#if !configured}<label for="admin-password-confirm">{t(I18nKey.adminAuthConfirm)}</label><input id="admin-password-confirm" type="password" autocomplete="new-password" bind:value={confirmPassword} minlength="6" maxlength="20" required disabled={authBusy} />{/if}
     <Button type="submit" disabled={authBusy} label={t(authBusy ? I18nKey.adminAuthVerifying : configured ? I18nKey.adminAuthLogin : I18nKey.adminAuthSetup)} />
    </form>
   {/if}
   {#if authIssue}<p role="alert" class="admin-feedback admin-error">{t(authIssue)}</p>{#if authIssue === I18nKey.adminUnavailable}<Button variant="text" label={t(I18nKey.retry)} onclick={() => void checkAuth()} />{/if}{/if}
  </section>
 </main>
{:else}
<div class="admin-workspace" data-admin-workspace>
 <aside class="admin-sidebar">
  <p class="admin-eyebrow">{t(I18nKey.adminOverview)}</p>
  <nav aria-label={t(I18nKey.adminTitle)}>
   {#each [["all", I18nKey.adminPosts, posts.length, "posts"], ["draft", I18nKey.adminDrafts, draftCount, "draft"], ["published", I18nKey.adminPublished, posts.length - draftCount, "published"]] as item}
    <button class="admin-nav-item m3-state-layer" disabled={saving || settingsSaving || imageUploads > 0} class:active={group === "posts" && filter === item[0] && !form} aria-pressed={group === "posts" && filter === item[0] && !form}
     onclick={() => { if (dirty && !window.confirm(t(I18nKey.adminUnsaved))) return; group = "posts"; form = null; filter = String(item[0]); error = null; message = ""; }}>
     {@render symbol(String(item[3]))}<span>{t(item[1] as I18nKey)}</span><span class="admin-count">{local ? item[2] : "—"}</span>
    </button>
   {/each}
   {#each [["settings", I18nKey.adminSettings], ["appearance", I18nKey.adminAppearance], ["features", I18nKey.adminFeatures], ["data", I18nKey.adminData], ["advanced", I18nKey.adminAdvanced]] as item}
    <button class="admin-nav-item m3-state-layer" disabled={saving || settingsSaving || imageUploads > 0} class:active={group === item[0]} aria-pressed={group === item[0]} onclick={() => { if (dirty && !window.confirm(t(I18nKey.adminUnsaved))) return; form = null; group = String(item[0]); error = null; message = ""; }}>
     {@render symbol("settings")}<span>{t(item[1] as I18nKey)}</span>
    </button>
   {/each}
  </nav>
  <a class="admin-return m3-state-layer" data-no-swup href={url("/")}>{t(I18nKey.adminReturn)}<span aria-hidden="true">↗</span></a>
 </aside>
 <main class="admin-main" id="admin-main" data-pagefind-ignore>
  {#if local}<div class="admin-auth-actions"><Button variant="text" label={t(I18nKey.adminAuthLogout)} disabled={saving || settingsSaving || imageUploads > 0} onclick={() => void logout()} /></div>{/if}
  {#if group !== "posts"}
   {#key group}<AdminSettings {group} {locale} {local} {remote} {dynamic} {api} {uploadImage} uploading={imageUploads > 0} bind:dirty={settingsDirty} bind:saving={settingsSaving} />{/key}
  {:else if form}
   <Button variant="text" label={t(I18nKey.adminBack)} onclick={back} />
   <form onsubmit={save} class="admin-editor">
    <div class="admin-heading"><div><p class="admin-eyebrow">{t(I18nKey.adminOverview)}</p><h1>{t(form.create ? I18nKey.adminNewPost : I18nKey.adminEdit)}</h1></div>
     <Button type="submit" disabled={saving || imageUploads > 0} label={t(saving ? I18nKey.adminSaving : I18nKey.adminSave)} />
    </div>
    <div class="admin-editor-grid">
     <section class="admin-panel admin-writing">
      <label for="post-title">{t(I18nKey.adminPostTitle)}</label>
      <input id="post-title" class="admin-title-input" bind:this={editorTitle} bind:value={form.title} required maxlength="300" />
      <label for="post-description">{t(I18nKey.adminDescription)}</label>
      <textarea id="post-description" rows="2" bind:value={form.description}></textarea>
      <div class="admin-source-tabs"><button type="button" class="m3-state-layer" aria-pressed={!preview} onclick={() => { preview = false; ++previewGeneration; }}>{t(I18nKey.adminSource)}</button>
       <button type="button" class="m3-state-layer" aria-pressed={preview} onclick={showPreview}>{t(I18nKey.adminPreview)}</button></div>
      {#if preview}<div class="admin-preview" aria-live="polite">{#if previewLoading}{t(I18nKey.adminLoading)}{:else}{@html previewHtml}{/if}</div>
      {:else}<label class="admin-sr-only" for="post-body">{t(I18nKey.adminBody)}</label><textarea id="post-body" class="admin-body" bind:value={form.body} spellcheck="false"></textarea>{/if}
      <p class="admin-helper">{t(I18nKey.adminMdxHint)}</p>
     </section>
     <section class="admin-panel admin-metadata" aria-labelledby="metadata-heading">
      <h2 id="metadata-heading">{t(I18nKey.adminMetadata)}</h2>
      {#if form.create}<label for="post-slug">{t(I18nKey.adminSlug)}</label><input id="post-slug" bind:value={form.file} pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
      {:else}<p class="admin-helper">{t(I18nKey.adminFile)}</p><code>{form.file}</code>{/if}
      <label for="post-date">{t(I18nKey.publishedAt)}</label><input id="post-date" type="date" required bind:value={form.published} />
      <label for="post-category">{t(I18nKey.adminCategory)}</label><input id="post-category" bind:value={form.category} />
      <label for="post-tags">{t(I18nKey.tags)}</label><input id="post-tags" bind:value={tagInput} />
      <span>{t(I18nKey.adminImage)}</span><AdminImageField bind:value={form.image} label={t(I18nKey.adminImage)} {locale} post={form.file} {uploadImage} disabled={saving || imageUploads > 0} />
      <div class="admin-toggle"><span>{t(I18nKey.adminDraft)}</span><Switch bind:checked={form.draft} label={t(I18nKey.adminDraft)} /></div>
      <div class="admin-toggle"><span>{t(I18nKey.adminPinned)}</span><Switch bind:checked={form.pinned} label={t(I18nKey.adminPinned)} /></div>
      <div class="admin-toggle"><span>{t(I18nKey.adminEncryptPost)}</span><Switch bind:checked={form.encrypted} label={t(I18nKey.adminEncryptPost)} disabled={saving} /></div>
      {#if form.encrypted}
       {#if form.hasPassword}<p class="admin-helper" role="status">{t(I18nKey.adminEncryptPasswordSaved)}</p>{/if}
       <label for="post-encryption-password">{t(I18nKey.adminEncryptPassword)}</label>
       <input id="post-encryption-password" type="text" autocomplete="off" spellcheck="false" bind:value={form.password} minlength={form.hasPassword && form.password === originalPassword ? undefined : 6} maxlength={form.hasPassword && form.password === originalPassword ? undefined : 20} required={!form.hasPassword} placeholder={form.hasPassword ? t(I18nKey.adminEncryptPasswordKeep) : ""} disabled={saving} />
       <label for="post-password-hint">{t(I18nKey.adminEncryptPasswordHint)}</label>
       <input id="post-password-hint" bind:value={form.passwordHint} maxlength="300" disabled={saving} />
      {/if}
      <p class="admin-helper">{t(I18nKey.adminEncryptHelp)}</p>
     </section>
    </div>
   </form>
  {:else}
   <div class="admin-heading"><div><p class="admin-eyebrow">{t(I18nKey.adminOverview)}</p><h1>{t(I18nKey.adminTitle)}</h1><p class="admin-subtitle">{t(I18nKey.adminSubtitle)}</p></div>
    <Button disabled={!local || loading || !!error} onclick={() => void open()}>{@render symbol("add")}{t(I18nKey.adminNewPost)}</Button>
   </div>
   <p class="admin-mode">{@render symbol(local ? "edit" : "draft")}{t(dynamic ? I18nKey.adminDynamicHint : remote ? I18nKey.adminServerHint : local ? I18nKey.adminLocalHint : I18nKey.adminOnlineHint)}</p>
   <section class="admin-stats" aria-label={t(I18nKey.adminOverview)}>
    {#each [[I18nKey.adminPosts, posts.length, "posts"], [I18nKey.adminPublished, posts.length - draftCount, "published"], [I18nKey.adminDrafts, draftCount, "draft"]] as item}
     <div class="admin-stat"><span class="admin-stat-icon">{@render symbol(String(item[2]))}</span><div><p>{t(item[0] as I18nKey)}</p><strong>{local ? item[1] : "—"}</strong></div></div>
    {/each}
   </section>
   {#if local}
    <section class="admin-panel admin-posts" aria-labelledby="articles-heading">
     <div class="admin-list-heading"><h2 id="articles-heading">{t(filter === "draft" ? I18nKey.adminDrafts : filter === "published" ? I18nKey.adminPublished : I18nKey.adminPosts)}</h2>
      <div class="admin-search"><TextField hideLabel label={t(I18nKey.adminSearch)} placeholder={t(I18nKey.adminSearch)} bind:value={query} /></div>
      <div class="admin-category-filter"><Select label={t(I18nKey.adminCategoryFilter)} items={categoryItems} bind:value={category} disabled={loading || saving} /></div>
      <Button variant="text" disabled={loading || saving} label={t(I18nKey.adminRefresh)} onclick={() => { selected = []; void refresh(); }} />
     </div>
     <div class="admin-batch-toolbar">
      <Checkbox triState label={t(I18nKey.adminSelectAll)} disabled={loading || saving || !visible.length || visible.length > 200} bind:checked={() => selectionState, (checked) => { selected = checked ? visible.map((post) => post.file) : []; }} />
      <span class="admin-helper" aria-live="polite">{t(I18nKey.adminSelectedCount).replace("{count}", String(selected.length))}</span>
      <Button variant="tonal" disabled={!selected.length || saving || loading} label={t(I18nKey.adminBatchDraft)} onclick={() => void manage("draft")} />
      <Button variant="tonal" disabled={!selected.length || saving || loading} label={t(I18nKey.adminBatchPublish)} onclick={() => void manage("publish")} />
      <Button variant="text" disabled={!selected.length || saving || loading} label={t(I18nKey.adminBatchDelete)} onclick={() => requestDelete(posts.filter((post) => selected.includes(post.file)))} />
      {#if visible.length > 200}<span class="admin-helper">{t(I18nKey.adminBatchLimit)}</span>{/if}
     </div>
     {#if loading}<p role="status" class="admin-empty">{t(I18nKey.adminLoading)}</p>
     {:else if !visible.length}<p class="admin-empty">{t(I18nKey.adminEmpty)}</p>
     {:else}<ul class="admin-article-list">{#each visible as post (post.file)}
      <li><Checkbox label={`${t(I18nKey.adminSelectPost)}: ${post.title}`} disabled={saving || (!selected.includes(post.file) && selected.length >= 200)} bind:checked={() => selected.includes(post.file), (checked) => selectPost(post.file, checked)} /><span class="admin-article-icon">{@render symbol(post.draft ? "draft" : "posts")}</span>
       <div class="admin-article-info"><button class="admin-article-title" onclick={() => void open(post)}>{post.title}</button><p><time datetime={post.published}>{post.published}</time>{#if post.category}<span>·</span>{post.category}{/if}</p></div>
       <span class="admin-status" class:draft={post.draft}>{t(post.draft ? I18nKey.adminDrafts : I18nKey.adminPublished)}</span>
       <div class="admin-article-actions"><Button variant="text" disabled={saving} ariaLabel={`${t(I18nKey.adminEdit)}: ${post.title}`} onclick={() => void open(post)}>{@render symbol("edit")}</Button>
       <Button variant="text" disabled={saving} ariaLabel={`${t(I18nKey.adminDelete)}: ${post.title}`} onclick={() => requestDelete([post])}>{@render symbol("delete")}</Button></div>
      </li>
     {/each}</ul>{/if}
    </section>
   {/if}
  {/if}
  {#if error}<div role="alert" class="admin-feedback admin-error">{t(error)}{#if !form && local}<Button variant="text" label={t(I18nKey.retry)} onclick={() => void refresh()} />{/if}</div>{/if}
  {#if message}<p role="status" class="admin-feedback">{message}</p>{/if}
  <noscript><p>{t(I18nKey.adminNoJavaScript)}</p></noscript>
 </main>
</div>

{/if}

<Dialog bind:open={deleteOpen} title={t(I18nKey.adminDeleteConfirmTitle)} showCloseButton={false}>
 <p>{t(I18nKey.adminDeleteConfirm).replace("{count}", String(deleteTargets.length))}</p>
 {#snippet actions()}
  <Button variant="text" label={t(I18nKey.cancel)} onclick={() => { deleteOpen = false; }} />
  <Button label={t(I18nKey.adminDelete)} onclick={() => void manage("delete", deleteTargets)} />
 {/snippet}
</Dialog>
