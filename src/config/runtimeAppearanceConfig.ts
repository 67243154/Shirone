/** Runtime parameters for existing geometry; new layouts still require code changes. */
export const runtimeAppearanceConfig: {
	bodyFontSize: number;
	titleFontScale: number;
	cornerRadius: number;
	background: "theme" | "solid";
	backgroundColor: string;
} = {
	bodyFontSize: 16,
	titleFontScale: 1,
	cornerRadius: 16,
	background: "theme",
	backgroundColor: "#f8f5fb",
};
