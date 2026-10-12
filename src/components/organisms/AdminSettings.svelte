<script lang="ts">
import Button from "@components/atoms/action/Button.svelte";
import Switch from "@components/atoms/selection/Switch.svelte";
import AdminArrayEditor from "@components/molecules/AdminArrayEditor.svelte";
import AdminImageField from "@components/molecules/AdminImageField.svelte";
import { onMount } from "svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import type { AdminDocument } from "@/types/admin";
import { adminDocuments } from "@/utils/admin-catalog";
import {
	adminFieldChoices,
	adminFieldLabel,
	adminOptionLabel,
} from "@/utils/admin-field-labels";
import { isAdminImageField } from "@/utils/admin-images";

let {
	group,
	locale,
	local,
	remote = false,
	dynamic = false,
	api,
	uploadImage,
	uploading = false,
	dirty = $bindable(false),
	saving = $bindable(false),
}: {
	group: string;
	locale: string;
	local: boolean;
	remote?: boolean;
	dynamic?: boolean;
	api: <T>(path: string, data?: unknown) => Promise<T>;
	uploadImage: (file: File) => Promise<string>;
	uploading?: boolean;
	dirty?: boolean;
	saving?: boolean;
} = $props();
const t = (key: I18nKey): string => i18n(key, locale);
let available = $state<string[]>([]);
let document = $state<AdminDocument | null>(null);
let initial = $state("");
let sourceMode = $state(false);
let loading = $state(local);
let issue = $state("");
let details = $state("");
let message = $state("");
let search = $state("");
let active = true;
const titleKey = $derived(
	{
		settings: I18nKey.adminSettings,
		appearance: I18nKey.adminAppearance,
		features: I18nKey.adminFeatures,
		data: I18nKey.adminData,
		advanced: I18nKey.adminAdvanced,
	}[group] ?? I18nKey.adminSettings,
);
const entries = $derived(
	adminDocuments.filter(
		(item) =>
			item.group === group &&
			`${t(item.title as I18nKey)} ${item.file}`
				.toLowerCase()
				.includes(search.toLowerCase()),
	),
);
const snapshot = () =>
	document
		? JSON.stringify({ source: document.source, fields: document.fields })
		: "";
$effect(() => {
	dirty = snapshot() !== initial;
});
function error(code: string) {
	issue = t(
		code === "deploymentRequired"
			? I18nKey.adminDeploymentHint
			: code === "publish"
				? I18nKey.adminPublishFailed
				: code === "conflict"
					? I18nKey.adminConflict
					: code === "validation"
						? I18nKey.adminConfigInvalid
						: I18nKey.adminUnavailable,
	);
}
async function loadList() {
	loading = true;
	issue = "";
	try {
		const result = await api<{ ids: string[] }>("documents");
		if (active) available = result.ids;
	} catch (e) {
		if (active) error((e as Error).message);
	} finally {
		if (active) loading = false;
	}
}
async function open(id: string) {
	if (
		saving ||
		uploading ||
		(dirty && !window.confirm(t(I18nKey.adminUnsaved)))
	)
		return;
	loading = true;
	issue = "";
	message = "";
	details = "";
	try {
		const result = await api<AdminDocument>(
			`document?id=${encodeURIComponent(id)}`,
		);
		if (!active) return;
		document = result;
		initial = snapshot();
		sourceMode = !result.fields.length;
	} catch (e) {
		if (active) error((e as Error).message);
	} finally {
		if (active) loading = false;
	}
}
function back() {
	if (
		saving ||
		uploading ||
		(dirty && !window.confirm(t(I18nKey.adminUnsaved)))
	)
		return;
	document = null;
	initial = "";
	message = "";
	issue = "";
	details = "";
}
function mode(next: boolean) {
	if (dirty && !window.confirm(t(I18nKey.adminModeDiscard))) return;
	if (document) {
		const saved = JSON.parse(initial);
		document.source = saved.source;
		document.fields = saved.fields;
		sourceMode = next;
	}
}
async function save(event: SubmitEvent) {
	event.preventDefault();
	if (!document || document.readonly || saving || uploading) return;
	saving = true;
	issue = "";
	details = "";
	message = "";
	try {
		const result = await api<AdminDocument>("document", {
			id: document.id,
			version: document.version,
			...(sourceMode
				? { source: document.source }
				: { fields: document.fields.map(({ id, value }) => ({ id, value })) }),
		});
		if (!active) return;
		document = result;
		initial = snapshot();
		message = t(
			dynamic
				? result.mode === "deployment"
					? I18nKey.adminDeploymentSaved
					: I18nKey.adminDynamicSaved
				: remote
					? I18nKey.adminServerSaved
					: I18nKey.adminConfigSaved,
		);
	} catch (e) {
		if (active) {
			error((e as Error).message);
			details = (e as Error & { details?: string }).details ?? "";
		}
	} finally {
		if (active) saving = false;
	}
}
onMount(() => {
	if (local) void loadList();
	return () => {
		active = false;
		dirty = false;
		saving = false;
	};
});
</script>

{#if document}
 <Button variant="text" label={t(I18nKey.adminBackSections)} onclick={back} disabled={saving || uploading} />
 <form class="admin-editor" onsubmit={save}>
  <div class="admin-heading"><div><p class="admin-eyebrow">{t(titleKey)}</p><h1>{t(adminDocuments.find(item => item.id === document?.id)?.title as I18nKey)}</h1><p class="admin-helper">{document.file}</p></div><Button type="submit" disabled={!local || saving || uploading || document.readonly || loading} label={t(saving ? I18nKey.adminSaving : I18nKey.adminSaveConfig)} /></div>
  <p class="admin-mode">{t(document.readonly ? I18nKey.adminConfigReadonly : dynamic ? document.mode === "deployment" ? I18nKey.adminDeploymentHint : I18nKey.adminDynamicHint : I18nKey.adminConfigHint)}</p>
  <section class="admin-panel">
   <div class="admin-source-tabs">
    <button type="button" class="m3-state-layer" aria-pressed={!sourceMode} disabled={!document.fields.length || saving || uploading} onclick={() => mode(false)}>{t(I18nKey.adminFormMode)}</button>
    <button type="button" class="m3-state-layer" aria-pressed={sourceMode} disabled={saving || uploading || (dynamic && document.mode === "runtime" && document.file.endsWith(".ts"))} onclick={() => mode(true)}>{t(I18nKey.adminAdvancedSource)}</button>
   </div>
   {#if sourceMode}
    <label class="admin-config-field"><span>{t(I18nKey.adminAdvancedSource)}</span><textarea class="admin-body admin-config-source" rows="24" spellcheck="false" bind:value={document.source} disabled={document.readonly || saving}></textarea></label>
   {:else}
    <p class="admin-helper admin-config-intro">{t(dynamic && document.mode === "runtime" ? I18nKey.adminDynamicFieldsHint : I18nKey.adminFieldsHint)}</p>
    <div class="admin-config-fields">
     {#each document.fields as field (field.id)}
      <div class:admin-field-wide={field.kind === "json"} class="admin-config-field" data-field-path={field.path}>
       {#if field.kind === "boolean"}
        <div class="admin-toggle"><span>{adminFieldLabel(field.path, locale)}</span><Switch bind:checked={field.value as boolean} label={adminFieldLabel(field.path, locale)} disabled={saving || uploading || document.readonly || field.readonly} /></div>
        <span class="admin-value-label">{t(field.value ? I18nKey.adminEnabled : I18nKey.adminDisabled)}</span>
       {:else if field.kind === "json"}
        <h2 class="admin-field-title">{adminFieldLabel(field.path, locale)}</h2><AdminArrayEditor bind:value={field.value as string} {locale} label={field.path} {uploadImage} disabled={saving || uploading || document.readonly || field.readonly} />
       {:else}
        {#if field.kind === "string" && isAdminImageField(field.path,field.value)}
         <span>{adminFieldLabel(field.path,locale)}</span><AdminImageField bind:value={field.value as string} label={adminFieldLabel(field.path,locale)} {locale} {uploadImage} disabled={saving || uploading || document.readonly || field.readonly} />
        {:else}
        <label for={`config-field-${field.id}`}>{adminFieldLabel(field.path, locale)}</label>
        {#if field.kind === "number"}<input id={`config-field-${field.id}`} type="number" step="any" bind:value={field.value as number} disabled={saving || uploading || document.readonly || field.readonly} />
        {:else if adminFieldChoices(field.path, String(field.value)).length}
         <select id={`config-field-${field.id}`} bind:value={field.value as string} disabled={saving || uploading || document.readonly || field.readonly}>{#each adminFieldChoices(field.path, String(field.value)) as option}<option value={option}>{adminOptionLabel(option, locale, field.path)}</option>{/each}</select>
         <p class="admin-helper">{t(I18nKey.adminCurrentValue)}：{adminOptionLabel(String(field.value), locale, field.path)} <code>({field.value})</code></p>
        {:else}<textarea id={`config-field-${field.id}`} rows={String(field.value).includes("\n") ? 4 : 1} bind:value={field.value as string} disabled={saving || uploading || document.readonly || field.readonly}></textarea>{#if adminOptionLabel(String(field.value), locale, field.path) !== String(field.value)}<p class="admin-helper">{t(I18nKey.adminCurrentValue)}：{adminOptionLabel(String(field.value), locale, field.path)}</p>{/if}{/if}
        {/if}
       {/if}
       <p class="admin-helper admin-technical">{t(I18nKey.adminTechnicalKey)}：<code>{field.path}</code></p>
       {#if field.comment}<p class="admin-helper">{field.comment}</p>{/if}
      </div>
     {/each}
    </div>
   {/if}
  </section>
 </form>
{:else}
 <div class="admin-heading"><div><p class="admin-eyebrow">{t(I18nKey.adminTitle)}</p><h1>{t(titleKey)}</h1><p class="admin-subtitle">{t(I18nKey.adminSettingsSubtitle)}</p></div></div>
 <label class="admin-config-search"><span>{t(I18nKey.adminSearchSettings)}</span><input bind:value={search} placeholder={t(I18nKey.adminSearchSettings)} /></label>
 {#if !local}<p class="admin-mode">{t(I18nKey.adminOnlineHint)}</p>{/if}
 {#if loading}<p role="status" class="admin-empty">{t(I18nKey.adminLoading)}</p>{/if}
 <div class="admin-config-cards">{#each entries as item}
  <button class="admin-panel admin-config-card m3-state-layer" disabled={!local || loading || !available.includes(item.id)} onclick={() => void open(item.id)}><span class="admin-stat-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></svg></span><h2>{t(item.title as I18nKey)}</h2><p>{item.file}</p><span class="admin-helper">{!local || !available.includes(item.id) ? t(I18nKey.adminNotScaffolded) : t(I18nKey.adminConfigure)}</span></button>
 {/each}</div>
{/if}
{#if issue}<div class="admin-feedback admin-error" role="alert">{issue}{#if details}<pre class="admin-diagnostics">{details}</pre>{/if}<Button variant="text" label={t(I18nKey.adminRefresh)} disabled={saving || loading} onclick={() => document ? void open(document.id) : void loadList()} /></div>{/if}
{#if message}<p role="status" class="admin-feedback">{message}</p>{/if}
