# Local content administration

`/admin/` is a custom Shirone/M3E writing workspace, not a third-party CMS skin.
It lists real Markdown and MDX posts, searches titles/categories/tags, edits
frontmatter and source, creates Markdown posts, saves drafts, and previews safe
basic Markdown. Unknown frontmatter and MDX source are preserved.

The workspace also manages every documented configuration module in
`src/config/README.md`, with these sections:

- Site settings: site/theme, profile/social links, navigation, announcements,
  license, permalink and language configuration.
- Appearance/layout: sidebar, floating actions, post list, article/share options,
  fonts, code themes, image bloom, footer settings and footer HTML.
- Features/pages: comments, analytics, music, context menu, AI indexes, series,
  about, friends, moments, albums, compass, skills, projects, timeline, devices,
  games and anime.
- Content data: all nine `src/data/*.ts` entity lists and the about page Markdown.
- Advanced: admin switch, build integrations and sitemap filtering.

Literal fields are edited with switches/text/number inputs. Literal arrays have
add/remove controls and item fields; nested values can use JSON. Expressions,
imports, optional properties absent from defaults, and complex navigation
structures use the advanced source editor. Switching modes with pending changes
requires explicit discard. Existing source comments and imports are retained
when fields are unchanged. Changed array blocks are serialized as JSON literals.
Form fields use specific Chinese names by default, with technical keys displayed
as secondary details. Switches show their current enabled/disabled status;
common enum fields use localized select options while retaining original stored
values. Units and bounds appear in names where relevant (milliseconds, hue,
volume and TOC depth). English labels follow the interface language switch.

The explicit allowlist cannot edit arbitrary files. Config and data saves are
checked in memory against the project's existing TypeScript contracts before
writing, with diagnostics returned to the editor. Version checks reject stale
changes. In npm mode the resolved user config/data directories are used;
`integrationsConfig.ts` is read-only because that copy is not the integration's
active source. Config changes may restart Astro, and build integration changes
require a dev-server restart. Refresh after reload; rebuild/deploy for production.
Disabling the admin switch also disables further local editing after restart.

By default the API exists only in `astro dev`, requires a loopback client and host,
same-origin requests, an authenticated session and a per-server editing token. It never
commits or pushes to GitHub. Ordinary static production builds emit only the workspace shell: no
article sources, draft titles or write API. For this source checkout, the standalone service in `scripts/admin/server.mjs`
reuses the same stores and authentication. See `deploy/README.md` for the explicit
production opt-in, HTTPS proxy, private credentials and automatic publication.

`src/config/adminConfig.ts` enables this workspace for this fork. Set `enable`
to false to disable the route and local API. The plugin uses the integration's
resolved content directory in both repository and npm-package modes. External
content-repository mode is refused to avoid editing disposable synced files.

Saving verifies the original file fingerprint and refuses stale writes. New
posts use an explicit filename slug and exclusive creation. Requests are bounded
to 1 MiB, Markdown paths stay inside `posts/`, and symlinks are rejected.
Existing publication fields, aliases, series and encryption settings are retained.
There is no file delete action or asset uploader; image fields accept existing
image paths or URLs. Moments and album assets remain in their existing content
directories; their page configuration is editable here.

Image fields in article editors, configuration forms and data lists display
responsive thumbnails that update when their paths change. Source assets are
relative to `src/`, leading-slash paths use `public/`, and article-relative paths
resolve beside the post. Remote HTTP(S) images load directly in the browser.
Invalid images show a localized failure message. The dev-only image endpoint
requires the login cookie and shares the loopback/same-origin checks; image elements
do not need the editing token. It serves only image extensions within source, public or post roots,
rejects symlink escapes, and limits individual files to 20 MiB.

Run `pnpm.cmd dev --host 127.0.0.1 --port 4321`, then open `/admin/`.
On first use, set a password of 6–20 characters in the setup form. Node scrypt
(`N=131072, r=8, p=1`) derives a 64-byte hash with a random 32-byte salt; only
the salt/hash/version are stored in `.env.shirone-admin-auth` at the project root.
This file is ignored by Git and denied by Vite's default `.env.*` rule even when
the admin feature is disabled. Login uses
constant-time hash comparison. Passwords are never stored in browser storage or
client configuration. Sessions use random HttpOnly, SameSite=Strict cookies and
server memory, expire after eight hours and are revoked on logout or server restart.
Five failed attempts block further logins for ten minutes; expensive hash operations
are serialized. The cookie uses local HTTP because this service is loopback-only;
this is not a remotely deployable authentication service.
To reset a forgotten password, stop the dev server, remove only your project-root
`.env.shirone-admin-auth`, restart, and set a new password. Deleting this file is
a local-owner recovery action and should never be exposed as an unauthenticated API.
After changing admin configuration, restart the dev server. Saved local posts
are picked up by Astro; commit and deploy separately when ready.
Navigation between the blog and admin uses a full document load because they
have different shells; the blog retains Swup for its normal routes.

Validation: `pnpm.cmd check`, `pnpm.cmd type-check`,
`node --experimental-strip-types --test tests/admin/*.test.ts`, focused admin
Playwright interactions and light/dark accessibility scans, and `pnpm.cmd build`.
Run the local workspace browser tests with
`pnpm.cmd exec playwright test tests/site/admin*.spec.ts --config playwright.admin.config.ts`.
These tests start an isolated foreground server on port 4323 using
`.env.shirone-admin-test-auth`; setup refuses stale fixtures and teardown removes
the test credential file. The user's real password file and port 4321 are untouched.

Design research: Decap CMS and Keystatic suit Git-backed Markdown but their
interfaces did not match the requested Shirone style. Neither is installed.

The workspace also fixes Windows path comparisons and avoids rewriting unchanged
icon collections so saving text does not repeatedly reload the writing island.
The MCU 0.4.0 package's extensionless ESM imports are corrected with a reproducible
pnpm patch under `patches/` for server rendering after clean installs.
Chinese and English admin copy is localized; secondary locales use English admin
copy until dedicated translations are added.
