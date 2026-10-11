<script lang="ts">
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { adminImageUrl } from "@/utils/admin-images";

let {
	value,
	locale,
	post = "",
}: { value: string; locale: string; post?: string } = $props();
let failed = $state(false);
const src = $derived(adminImageUrl(value, post));
$effect(() => {
	void src;
	failed = false;
});
</script>

{#if value.trim()}
 <div class="admin-image-preview">
  {#if src && !failed}
   <img {src} alt={i18n(I18nKey.adminImagePreview, locale)} loading="lazy" referrerpolicy="no-referrer" onerror={() => { failed = true; }} />
  {:else}<p class="admin-helper">{i18n(I18nKey.adminImageFailed, locale)}</p>{/if}
 </div>
{/if}
