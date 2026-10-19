import type { FooterConfig } from "@/types/footerConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 页脚自定义 HTML 注入配置。
 * 开启后将读取 src/config/FooterConfig.html 文件内容并注入到页脚版权信息上方。
 * 关闭时（enable: false）零额外 DOM 占位、零文件读取开销。
 */
export const footerConfig: FooterConfig = withUserConfig("footer", {
	enable: false,
	/** 版权名称：暂留空，后续填写自己的名称 */
	copyrightName: "",
	/** 备案信息：先显示占位，待取得实际信息后填写 */
	registration: {
		/** 显示备案信息栏 */
		enable: true,
		/** 工信部 ICP 备案号（完整文字） */
		icpNumber: "",
		/** 公安备案号（完整文字，链接自动提取数字编号） */
		policeNumber: "",
		/** 公安备案徽标图片：可在后台上传，暂留空显示占位 */
		image: "",
	},
});
