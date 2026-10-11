# Local admin password authentication

## Objective and acceptance
Protect the existing local authoring workspace with server-side authentication.
First use requires setting a password (6–20 characters); subsequent visits require
login. Anonymous requests cannot read posts, configuration, previews or images.
No plaintext password, client-side password verifier, or reusable session is shipped
in HTML/JS, configuration, localStorage or Git. Logout and server restart invalidate
sessions; failed attempts are throttled. Production remains a static shell without
an authoring API.

## Implementation
Use Node crypto scrypt with a random salt, constant-time hash comparison and a
project-owned ignored credential file. Random HttpOnly/SameSite=Strict cookies identify
in-memory sessions with an eight-hour absolute lifetime. Preserve existing loopback,
same-origin and editing-token guards. Only auth status, first setup and login are
anonymous endpoints. Serialize password operations and cap sessions/attempts.
The workspace renders a localized M3E login/setup form until authenticated.

## Structure and conventions
`src/integration/vite/admin-auth.ts` owns hashing, credentials, sessions and limits;
`admin.ts` owns HTTP guards. `AdminWorkspace.svelte` owns auth lifecycle and UI;
all user-facing strings go into ten locale modules. Use existing Svelte runes,
semantic tokens and no new dependencies. Example: `await auth.login(password)`.

## Validation commands
`node --experimental-strip-types --test tests/admin/auth.test.ts`
`node node_modules/@playwright/test/cli.js test tests/site/admin-auth.spec.ts --config playwright.admin.config.ts`
`pnpm.cmd check` and `node scripts/check-package-manifest.mjs`.
Unit tests cover hashing/persistence, incorrect passwords, throttling, session expiry
and revocation. Browser tests use an isolated credential file and port, verify API
denials, setup/login/logout, cookies, UI and accessibility. Never overwrite a real
credential file or commit credentials. No remote deployment or dependencies are
part of this change. User supplies their actual password in the setup form.
