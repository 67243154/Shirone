<script lang="ts">
import Button from "@components/atoms/action/Button.svelte";
import AdminImagePreview from "@components/molecules/AdminImagePreview.svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";

let {
	value = $bindable(""),
	label,
	locale,
	post = "",
	disabled = false,
	uploadImage,
	allowPath = true,
	multiple = false,
}: {
	value?: string;
	label: string;
	locale: string;
	post?: string;
	disabled?: boolean;
	uploadImage: (file: File) => Promise<string>;
	allowPath?: boolean;
	multiple?: boolean;
} = $props();
const t = (key: I18nKey): string => i18n(key, locale);
let chooser: HTMLInputElement;
let uploading = $state(false);
let previewRevision = $state(0);
let issue = $state("");
async function select(event: Event): Promise<void> {
	const input = event.currentTarget as HTMLInputElement;
	const files = Array.from(input.files ?? []);
	if (!files.length) return;
	issue = "";
	if (files.some((file) => file.size > 20 * 1024 * 1024)) {
		issue = t(I18nKey.adminUploadSize);
		input.value = "";
		return;
	}
	uploading = true;
	try {
		for (const file of files) {
			value = await uploadImage(file);
			previewRevision += 1;
		}
	} catch (error) {
		const code = (error as Error).message;
		issue = t(
			code === "uploadSize"
				? I18nKey.adminUploadSize
				: code === "uploadInvalid"
					? I18nKey.adminUploadInvalid
					: I18nKey.adminUploadFailed,
		);
	} finally {
		uploading = false;
		input.value = "";
	}
}
</script>

<div class="admin-image-field" role="group" aria-label={label}>
 {#key previewRevision}<AdminImagePreview {value} {locale} {post} />{/key}
 <div class="admin-image-upload">
  <input type="file" bind:this={chooser} {multiple} aria-label={t(I18nKey.adminUploadImage)} accept="image/png,image/jpeg,image/webp,image/avif,image/gif" onchange={(event) => void select(event)} disabled={disabled || uploading} />
  <Button variant="tonal" icon="material-symbols:upload-rounded" label={t(uploading ? I18nKey.adminUploadingImage : I18nKey.adminUploadImage)} disabled={disabled || uploading} onclick={() => chooser.click()} />
  {#if value}<Button variant="text" label={t(I18nKey.adminRemoveImage)} disabled={disabled || uploading} onclick={() => { value = ""; issue = ""; }} />{/if}
 </div>
 <p class="admin-helper">{t(I18nKey.adminUploadHint)}</p>
 {#if allowPath}<details class="admin-image-path">
  <summary>{t(I18nKey.adminImagePathOptions)}</summary>
  <label><span>{t(I18nKey.adminImagePath)}</span><input bind:value disabled={disabled || uploading} /></label>
 </details>{/if}
 {#if uploading}<p class="admin-helper" role="status">{t(I18nKey.adminUploadingImage)}</p>{/if}
 {#if issue}<p class="admin-feedback admin-error" role="alert">{issue}</p>{/if}
</div>

<style>
.admin-image-field { display: grid; gap: var(--m3e-space-2); }
.admin-image-upload { display: flex; flex-wrap: wrap; align-items: center; gap: var(--m3e-space-2); }
.admin-image-upload input[type="file"] { display: none; }
.admin-image-path summary { cursor: pointer; color: var(--primary); font: var(--m3e-type-label-large); padding-block: var(--m3e-space-2); }
.admin-image-path label { display: grid; gap: var(--m3e-space-2); }
</style>
