import type { AdminConfig } from "../types/adminConfig.ts";
import { withUserConfig } from "../utils/config-overlay.ts";

// Enabled explicitly for this fork's local writing workflow.
export const adminConfig: AdminConfig = withUserConfig("admin", {
	enable: true,
});
