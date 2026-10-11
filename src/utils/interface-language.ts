import { siteConfig } from "@/config/siteConfig";
import I18nKey from "@/i18n/i18nKey";
import { getTranslation, i18n } from "@/i18n/translation";

type Locale = "zh_CN" | "en";
const storageKey = "shirone-ui-language";
const ignored = [
	"script",
	"style",
	"svg",
	"pre",
	"code",
	"textarea",
	"[contenteditable]",
	".markdown-content",
	"#banner-wrapper",
	".m3-blog-postcard__title",
	".m3-blog-postcard__desc",
	".m3-blog-postcard__tags",
	"[rel=me]",
	"[data-language-menu]",
	"[data-admin-workspace]",
].join(",");

// Bind SSR interface strings to the existing dictionaries, preserving placeholders.
// Records retain the original value so repeated switches never accumulate changes.
function createTranslator() {
	const keys = Object.keys(getTranslation(siteConfig.lang)) as I18nKey[];
	const entries = keys.flatMap((key) =>
		[siteConfig.lang, "en"].map((locale) => {
			const source = i18n(key, locale);
			const names: string[] = [];
			const pattern = source
				.split(/(\{\w+\})/)
				.map((part) => {
					if (/^\{\w+\}$/.test(part)) {
						names.push(part);
						return "(.+?)";
					}
					return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				})
				.join("");
			return { key, source, names, pattern: new RegExp(`^${pattern}$`) };
		}),
	);
	const cache = new Map<
		string,
		{ key: I18nKey; values: string[]; names: string[] } | null
	>();
	return (text: string, locale: Locale) => {
		const trimmed = text.trim();
		if (!trimmed) return text;
		const count = /^(\d[\d,.]*)\s+(.+)$/.exec(trimmed);
		if (count) {
			const units = [
				I18nKey.wordCount,
				I18nKey.wordsCount,
				I18nKey.minuteCount,
				I18nKey.minutesCount,
				I18nKey.postCount,
				I18nKey.postsCount,
			];
			const unit = entries.find(
				(entry) => units.includes(entry.key) && entry.source === count[2],
			);
			if (unit) {
				const index = units.indexOf(unit.key);
				const key =
					units[index - (index % 2) + (Number(count[1]) === 1 ? 0 : 1)];
				return text.replace(trimmed, `${count[1]} ${i18n(key, locale)}`);
			}
		}
		for (const sourceLocale of [siteConfig.lang, "en"]) {
			for (const mode of [
				I18nKey.musicModeSequence,
				I18nKey.musicModeRepeatOne,
				I18nKey.musicModeShuffle,
			]) {
				if (
					trimmed ===
					`${i18n(I18nKey.musicPlaybackMode, sourceLocale)}: ${i18n(mode, sourceLocale)}`
				) {
					return text.replace(
						trimmed,
						`${i18n(I18nKey.musicPlaybackMode, locale)}: ${i18n(mode, locale)}`,
					);
				}
			}
		}
		if (!cache.has(trimmed)) {
			// Prefer exact entries before parameterized entries.
			const exact = entries.find((entry) => entry.source === trimmed);
			if (exact) cache.set(trimmed, { key: exact.key, values: [], names: [] });
			else {
				let match = null;
				for (const entry of entries) {
					if (!entry.names.length) continue;
					const result = entry.pattern.exec(trimmed);
					if (result) {
						match = {
							key: entry.key,
							values: result.slice(1),
							names: entry.names,
						};
						break;
					}
				}
				cache.set(trimmed, match);
			}
		}
		const match = cache.get(trimmed);
		if (!match) return text;
		let result = i18n(match.key, locale);
		match.names.forEach((name, index) => {
			result = result.replaceAll(name, match.values[index]);
		});
		return text.replace(trimmed, result);
	};
}

export function initializeInterfaceLanguage(): void {
	if (document.documentElement.dataset.languageSwitchBound) return;
	document.documentElement.dataset.languageSwitchBound = "true";
	let locale: Locale = "zh_CN";
	try {
		if (localStorage.getItem(storageKey) === "en") locale = "en";
	} catch {
		/* Storage may be unavailable; the switch still works. */
	}
	const translate = createTranslator();
	type RecordValue = { source: string; rendered: string };
	const textRecords = new WeakMap<Text, RecordValue>();
	const attributeRecords = new WeakMap<Element, Map<string, RecordValue>>();
	const attributes = ["aria-label", "title", "placeholder", "alt"];
	let pendingFrame = 0;
	const observer = new MutationObserver((mutations) => {
		const hasInterfaceChange = mutations.some(({ target }) => {
			const element = target instanceof Element ? target : target.parentElement;
			return !element?.closest(ignored);
		});
		if (!hasInterfaceChange || pendingFrame) return;
		pendingFrame = requestAnimationFrame(() => {
			pendingFrame = 0;
			sync();
		});
	});

	function sync() {
		observer.disconnect();
		document.documentElement.dataset.uiLanguage = locale;
		document.documentElement.lang = locale === "zh_CN" ? "zh-CN" : "en";
		const walker = document.createTreeWalker(
			document.body,
			NodeFilter.SHOW_TEXT,
		);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const text = node as Text;
			if (text.parentElement?.closest(ignored)) continue;
			const current = text.data;
			let record = textRecords.get(text);
			if (!record || current !== record.rendered)
				record = { source: current, rendered: current };
			const next = translate(record.source, locale);
			if (current !== next) text.data = next;
			record.rendered = next;
			textRecords.set(text, record);
		}
		for (const element of document.querySelectorAll(
			"[aria-label], [title], [placeholder], [alt]",
		)) {
			if (element.closest(ignored) || element.id === "language-switch")
				continue;
			let records = attributeRecords.get(element);
			if (!records) {
				records = new Map();
				attributeRecords.set(element, records);
			}
			for (const attribute of attributes) {
				const current = element.getAttribute(attribute);
				if (current === null) continue;
				let record = records.get(attribute);
				if (!record || current !== record.rendered)
					record = { source: current, rendered: current };
				const next = translate(record.source, locale);
				if (current !== next) element.setAttribute(attribute, next);
				record.rendered = next;
				records.set(attribute, record);
			}
		}
		const button = document.getElementById("language-switch");
		const label = i18n(I18nKey.languageSwitch, locale);
		button?.setAttribute("aria-label", label);
		button?.setAttribute("title", label);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: attributes,
		});
	}

	document.addEventListener("site:language-select", (event) => {
		const selected = (event as CustomEvent<{ locale: Locale }>).detail?.locale;
		if (selected !== "zh_CN" && selected !== "en") return;
		locale = selected;
		try {
			localStorage.setItem(storageKey, locale);
		} catch {
			/* Keep the in-memory preference. */
		}
		sync();
		document.dispatchEvent(
			new CustomEvent("site:language-change", { detail: { locale } }),
		);
	});
	document.addEventListener("swup:content:replace", sync);
	document.addEventListener("swup:page:view", sync);
	window.addEventListener("storage", (event) => {
		if (event.key !== storageKey) return;
		locale = event.newValue === "en" ? "en" : "zh_CN";
		sync();
		document.dispatchEvent(
			new CustomEvent("site:language-change", { detail: { locale } }),
		);
	});
	sync();
	document.dispatchEvent(
		new CustomEvent("site:language-change", { detail: { locale } }),
	);
}
