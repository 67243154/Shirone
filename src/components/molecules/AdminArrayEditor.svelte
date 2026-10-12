<script lang="ts">
import Button from "@components/atoms/action/Button.svelte";
import AdminValueEditor from "@components/molecules/AdminValueEditor.svelte";
import AdminImageField from "@components/molecules/AdminImageField.svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { adminFieldLabel } from "@/utils/admin-field-labels";
import { isAdminImageField } from "@/utils/admin-images";

let {
	value = $bindable("[]"),
	locale = "zh_CN",
	label,
	disabled = false,
	uploadImage,
}: {
	value?: string;
	locale?: string;
	label: string;
	disabled?: boolean;
	uploadImage: (file: File) => Promise<string>;
} = $props();
const t = (key: I18nKey): string => i18n(key, locale);
const items = $derived(JSON.parse(value) as unknown[]);
const imageList = $derived(
	isAdminImageField(label) &&
		items.every((item) => typeof item === "string" || item === null),
);
function initializeExpansion(details: HTMLDetailsElement) {
	// Set the default once; subsequent toggles belong to the user, not JSON edits.
	details.open = items.length <= 3;
}
let template = $state<unknown>(null);
$effect(() => {
	if (template === null && items.length)
		template = structuredClone($state.snapshot(items)[0]);
});
function update(index: number, key: string | null, next: unknown) {
	const copy = structuredClone(items);
	if (key === null) copy[index] = next;
	else (copy[index] as Record<string, unknown>)[key] = next;
	value = JSON.stringify(copy, null, 2);
}
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
function add() {
	value = JSON.stringify(
		[...items, blank(template ?? items[0] ?? "")],
		null,
		2,
	);
}
function remove(index: number) {
	value = JSON.stringify(
		items.filter((_, i) => i !== index),
		null,
		2,
	);
}
async function appendImage(file: File): Promise<string> {
	const path = await uploadImage(file);
	value = JSON.stringify([...items, path], null, 2);
	return "";
}
</script>

<div class="admin-array-editor">
 <!-- Keep row identity independent of the JSON value being edited. -->
 {#each items as item, index (index)}
  <details class="admin-array-item" use:initializeExpansion>
   <summary>{index + 1}. {item && typeof item === "object" ? String((item as Record<string, unknown>).title ?? (item as Record<string, unknown>).name ?? (item as Record<string, unknown>).id ?? adminFieldLabel(label, locale)) : isAdminImageField(label,item) ? adminFieldLabel(label,locale) : String(item || adminFieldLabel(label, locale))}</summary>
   <div class="admin-config-fields">
    {#if typeof item === "object" && item !== null && !Array.isArray(item)}
     {#each Object.entries(item) as [key, entry] (key)}
      <AdminValueEditor path={`${label}[${index}].${key}`} {locale} {disabled} {uploadImage} bind:value={() => entry, (next) => update(index,key,next)} />
     {/each}
    {:else}
     <AdminValueEditor path={`${label}[${index}]`} {locale} {disabled} {uploadImage} bind:value={() => item, (next) => update(index,null,next)} />
    {/if}
   </div>
   <Button variant="text" label={t(I18nKey.adminRemoveItem)} {disabled} onclick={() => remove(index)} />
  </details>
 {/each}
 {#if imageList}<AdminImageField label={`${adminFieldLabel(label,locale)} · ${t(I18nKey.adminAddItem)}`} {locale} {disabled} uploadImage={appendImage} allowPath={false} multiple />{/if}
 <Button variant="tonal" label={t(I18nKey.adminAddItem)} {disabled} onclick={add} />
</div>
