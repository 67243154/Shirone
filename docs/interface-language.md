# Interface language switch

The site renders Simplified Chinese by default. The top-right Translate icon
opens a menu below the button, styled with the same Menu atom as the theme
selector. Its native-language options select Simplified Chinese or English and remember
the choice in localStorage. It reuses the existing i18n keys, dictionaries and
user overrides. Article bodies, titles, descriptions and personal profile
content remain in their authored language.

Static UI output is bound to existing dictionary entries in the browser;
newly hydrated controls and Swup page replacements are synchronized too.
The server-rendered Chinese interface remains usable without JavaScript.
Language switching does not change URLs, content sources or search indexes.

Validation: pnpm.cmd check, pnpm.cmd type-check, pnpm.cmd build;
language-switch, icons and homepage accessibility browser checks.
