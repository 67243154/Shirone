<script lang="ts">
import Button from "@components/atoms/action/Button.svelte";
import Switch from "@components/atoms/selection/Switch.svelte";
import AdminImageField from "@components/molecules/AdminImageField.svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { adminFieldLabel, adminOptionLabel } from "@/utils/admin-field-labels";
import { isAdminImageField } from "@/utils/admin-images";
import AdminValueEditor from "./AdminValueEditor.svelte";

let {
	value = $bindable<unknown>(""),
	path,
	locale,
	disabled = false,
	uploadImage,
}: {
	value?: unknown;
	path: string;
	locale: string;
	disabled?: boolean;
	uploadImage: (file: File) => Promise<string>;
} = $props();
const label = $derived(adminFieldLabel(path, locale));
const object = $derived(
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null,
);
const array = $derived(Array.isArray(value) ? value : null);
let template = $state<unknown>(null);
$effect(() => {
	if (template === null && array?.length)
		template = structuredClone($state.snapshot(array)[0]);
});
function blank(example: unknown): unknown {
	if (Array.isArray(example)) return [];
	if (example && typeof example === "object")
		return Object.fromEntries(
			Object.entries(example).map(([key, item]) => [key, blank(item)]),
		);
	return typeof example === "number"
		? 0
		: typeof example === "boolean"
			? false
			: "";
}
</script>

<div class="admin-config-field" data-field-path={path}>
 {#if (typeof value === "string" || value === null) && isAdminImageField(path, value)}
  <span>{label}</span><AdminImageField bind:value={() => String(value ?? ""),(next) => { value = next; }} {label} {locale} {disabled} {uploadImage} />
 {:else if typeof value === "boolean"}
  <div class="admin-toggle"><span>{label}</span><Switch bind:checked={value} {label} {disabled} /></div>
 {:else if typeof value === "number"}
  <label><span>{label}</span><input type="number" step="any" bind:value {disabled} /></label>
 {:else if typeof value === "string"}
  <label><span>{label}</span><input bind:value {disabled} /></label>
  {#if adminOptionLabel(value, locale, path) !== value}<span class="admin-helper">{i18n(I18nKey.adminCurrentValue,locale)}：{adminOptionLabel(value,locale,path)}</span>{/if}
 {:else if array}
  <span>{label}</span>
  <div class="admin-array-editor">
   {#each array as item,index (index)}
    <details class="admin-array-item" open>
     <summary>{index+1}. {item && typeof item === "object" ? String(item.title ?? item.name ?? label) : isAdminImageField(path,item) ? label : String(item || label)}</summary>
     <AdminValueEditor {locale} {disabled} {uploadImage} path={`${path}[${index}]`} bind:value={() => item,(next) => { value = array?.map((entry,i) => i === index ? next : entry); }} />
     <Button variant="text" label={i18n(I18nKey.adminRemoveItem,locale)} {disabled} onclick={() => { value = array?.filter((_,i) => i !== index); }} />
    </details>
   {/each}
   <Button variant="tonal" label={i18n(I18nKey.adminAddItem,locale)} {disabled} onclick={() => { value = [...(array ?? []),blank(template ?? "")]; }} />
  </div>
 {:else if object}
  <div class="admin-nested-fields" role="group" aria-label={label}>
   <h3 class="admin-field-title">{label}</h3>
   {#each Object.entries(object) as [key,entry] (key)}
    <AdminValueEditor {locale} {disabled} {uploadImage} path={`${path}.${key}`} bind:value={() => entry, (next) => { value = { ...object, [key]: next }; }} />
   {/each}
  </div>
 {:else}<span>{label}</span>{/if}
</div>
