<script lang="ts">
import Button from "@components/atoms/action/Button.svelte";
import Switch from "@components/atoms/selection/Switch.svelte";
import AdminImagePreview from "@components/molecules/AdminImagePreview.svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { adminFieldLabel, adminOptionLabel } from "@/utils/admin-field-labels";
import { adminImageValues } from "@/utils/admin-images";

let {
	value = $bindable("[]"),
	locale = "zh_CN",
	label,
	disabled = false,
}: {
	value?: string;
	locale?: string;
	label: string;
	disabled?: boolean;
} = $props();
const t = (key: I18nKey): string => i18n(key, locale);
const items = $derived(JSON.parse(value) as unknown[]);
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
function nested(event: Event, index: number, key: string) {
	const input = event.currentTarget as HTMLTextAreaElement;
	try {
		update(index, key, JSON.parse(input.value));
		input.setCustomValidity("");
	} catch {
		input.setCustomValidity(t(I18nKey.adminJsonInvalid));
		input.reportValidity();
	}
}
</script>

<div class="admin-array-editor">
 {#each items as item, index}
  <details class="admin-array-item" open={items.length <= 3}>
   <summary>{index + 1}. {item && typeof item === "object" ? String((item as Record<string, unknown>).title ?? (item as Record<string, unknown>).name ?? (item as Record<string, unknown>).id ?? adminFieldLabel(label, locale)) : String(item || adminFieldLabel(label, locale))}</summary>
   <div class="admin-config-fields">
    {#if item && typeof item === "object" && !Array.isArray(item)}
     {#each Object.entries(item) as [key, entry]}
      <div class="admin-config-field">
       {#if typeof entry === "boolean"}<div class="admin-toggle"><span>{adminFieldLabel(key, locale)}</span><Switch bind:checked={() => entry as boolean, (checked) => update(index, key, checked)} label={adminFieldLabel(key, locale)} {disabled} /></div><span class="admin-value-label">{t(entry ? I18nKey.adminEnabled : I18nKey.adminDisabled)}</span>
       {:else}<label><span>{adminFieldLabel(key, locale)}</span>
       {#if typeof entry === "number"}<input type="number" value={entry} oninput={(event) => update(index, key, event.currentTarget.valueAsNumber)} {disabled} step="any" />
       {:else if typeof entry === "string"}<input value={entry} oninput={(event) => update(index, key, event.currentTarget.value)} {disabled} />{#if adminOptionLabel(entry, locale) !== entry}<span class="admin-helper">{t(I18nKey.adminCurrentValue)}：{adminOptionLabel(entry, locale)}</span>{/if}
       {:else}<textarea rows="3" value={JSON.stringify(entry, null, 2)} onchange={(event) => nested(event, index, key)} {disabled}></textarea>{/if}</label>{/if}
       {#each adminImageValues(entry, `${label}.${key}`) as image}<AdminImagePreview value={image} {locale} />{/each}
      </div>
     {/each}
    {:else}
     <label class="admin-config-field"><span>{adminFieldLabel(label, locale)} {index + 1}</span><input value={String(item ?? "")} oninput={(event) => update(index, null, typeof item === "number" ? Number(event.currentTarget.value) : event.currentTarget.value)} {disabled} /></label>
     {#each adminImageValues(item, label) as image}<AdminImagePreview value={image} {locale} />{/each}
    {/if}
   </div>
   <Button variant="text" label={t(I18nKey.adminRemoveItem)} {disabled} onclick={() => remove(index)} />
  </details>
 {/each}
 <Button variant="tonal" label={t(I18nKey.adminAddItem)} {disabled} onclick={add} />
</div>
