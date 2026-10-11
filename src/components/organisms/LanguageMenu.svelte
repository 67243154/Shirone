<script lang="ts">
import Menu from "@components/atoms/navigation/Menu.svelte";
import { onMount, tick } from "svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";

let open = $state(false);
let locale = $state("zh_CN");
let trigger: HTMLButtonElement;
let chinese: HTMLButtonElement;
let english: HTMLButtonElement;
const label = $derived(i18n(I18nKey.languageSwitch, locale));

onMount(() => {
	const sync = () => {
		locale = document.documentElement.dataset.uiLanguage || "zh_CN";
	};
	sync();
	document.addEventListener("site:language-change", sync);
	return () => document.removeEventListener("site:language-change", sync);
});

function select(value: string) {
	document.dispatchEvent(
		new CustomEvent("site:language-select", { detail: { locale: value } }),
	);
	open = false;
	trigger.focus();
}

async function keydown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		open = false;
		trigger.focus();
		return;
	}
	if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
	event.preventDefault();
	open = true;
	await tick();
	const menu = chinese.closest('[role="menu"]');
	await Promise.all(
		menu
			?.getAnimations()
			.map((animation) => animation.finished.catch(() => {})) ?? [],
	);
	if (!open) return;
	if (event.target === chinese) english.focus();
	else if (event.target === english) chinese.focus();
	else (locale === "en" ? english : chinese).focus();
}
</script>

<div data-language-menu class="relative z-50 flex h-10 w-10 shrink-0 items-center justify-center">
 <button id="language-switch" bind:this={trigger} aria-label={label} title={label}
  aria-haspopup="menu" aria-expanded={open} onkeydown={keydown} onclick={() => { open = !open; }}
  class="m3-state-layer relative inline-flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-full border-none text-[var(--on-surface)]"
  style="font-size:1.25rem;line-height:1; --m3e-state-color:var(--on-surface); --m3e-focus-outline:var(--on-surface);">
  <slot />
 </button>
 <Menu bind:open label={label} class="absolute top-11 right-0">
  <button bind:this={chinese} class="m3-menu-item" class:selected={locale === "zh_CN"}
   role="menuitemradio" aria-checked={locale === "zh_CN"} onkeydown={keydown} onclick={() => select("zh_CN")}>
   {i18n(I18nKey.languageName, "zh_CN")}
  </button>
  <button bind:this={english} class="m3-menu-item" class:selected={locale === "en"}
   role="menuitemradio" aria-checked={locale === "en"} onkeydown={keydown} onclick={() => select("en")}>
   {i18n(I18nKey.languageName, "en")}
  </button>
 </Menu>
</div>
