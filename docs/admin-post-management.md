# 后台文章管理

## 目标与范围

在现有已认证后台中增加分类下拉筛选、逐篇选择、全选当前筛选结果、单篇删除，以及批量删除 / 转为草稿 / 发布。保留搜索、编辑和当前 M3E 风格；支持手机与键盘操作。

`/admin/` 末尾是正斜杠，符合现有 Astro 页面路由约定，不更改整站路由规则。

## 数据与接口

- `POST /__admin/api/posts/batch`，请求 `{ action: "delete" | "draft" | "publish", posts: [{ file, version }] }`，最多 200 篇且不得重复。
- 沿用会话、同源及 CSRF 校验。所有路径和版本先检查；任意冲突返回 409，操作前不修改任何文章。执行失败回滚已操作文件。
- 保留 Markdown / MDX 正文、未知 frontmatter、密码与永久链接字段；状态操作只改 `draft`。
- 操作前创建独立备份，删除通过移动原文件实现，备份存放在非公开 `.shirones/runtime/backups/posts` 下。接口不返回正文或密码。
- 每批仅触发一次既有保存后的发布逻辑。动态模式下下一次请求直接生效，静态模式仍使用原发布流程。
- 筛选变化清空选择，全选只选择当前筛选结果；搜索、分类、草稿状态交集生效。删除弹窗明确篇数与备份提示。

## 实现顺序与边界

共享类型 → 文件存储与接口 → 复用 Select / Checkbox / Button 的后台工具栏 → 本地验证 → 备份并部署服务器。
不删除真实文章作为测试，不读取真实密码或覆盖运行时设置；不添加数据库或依赖。

## 验证

`node --experimental-strip-types --test tests/admin/post-management.test.ts`：嵌套路径、越界、软链接、重复、版本冲突、备份、失败回滚、MDX 字段保留。
`node node_modules/astro/bin/astro.mjs check`：零错误。
`node node_modules/@playwright/test/cli.js test tests/site/admin-post-management.spec.ts --config playwright.runtime.config.ts --workers 1`：测试文章的筛选、选择、批量状态、确认取消和删除，手机排版、无障碍。生产 SSR 构建验证真实动态行为。

业务状态使用 Svelte runes，例如 `const visible = $derived(posts.filter(...))`；新文案进入全部十种语言，样式仅使用既有语义令牌。
