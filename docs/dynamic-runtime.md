# 本地动态运行模式

本模式使用 Node HTTP 服务和 Astro SSR。页面标题、正文和 metadata 由服务器输出；JS/CSS 仍是构建产物。后台保存文章或日常配置时不执行 Astro/Pagefind 构建。

## 启动

在模板项目根目录执行：

```powershell
pnpm.cmd runtime:build
pnpm.cmd runtime:start
```

默认地址是 `http://127.0.0.1:4326/`，后台是 `/admin/`。可通过 `SHIRONE_RUNTIME_PORT` 设置本地端口。`runtime:dev` 仅用于开发，验收动态保存请使用 `runtime:build` 后的 `runtime:start`。本次未更新远程服务器。

动态模式必须显式启用 `SHIRONE_DYNAMIC=1`（以上命令已经设置）。普通 `pnpm.cmd build` 保留原静态模板工作流；npm 模式仍保留原工作流。本地运行命令目前面向此模板仓库，不是 npm 内容仓的独立部署工具。

## 保存和持久化

- 文章继续保存在 `src/content/posts` 的 Markdown/MDX 文件中；保留原有 frontmatter、加密字段和注释，写入采用临时文件替换与内容版本检查。
- 日常配置、展示栏目数据和动态外观参数保存在 `.shirones/runtime/settings.json`，经过原有 TypeScript 类型校验、允许值/范围校验后原子写入。不会把用户输入当作 TypeScript 配置源码执行。
- 原配置仍是默认值。首次修改会在 `.shirones/runtime/backups` 备份原文件；运行时配置通过字面量覆盖导入既有配置。备份和运行时文件不公开提供下载。
- 重启时重新读取已保存的数据。文件指纹和配置版本用于缓存失效；保存成功后刷新或下一次导航会得到新内容。页面不自动推送更新。
- 草稿不进入公开集合、文章页、搜索、RSS/Atom。加密文章沿用原加密组件，搜索和订阅不会包含正文。

部署时必须保留 Markdown 源文件、配置类型及默认源码、`.shirones/runtime` 与私有密码文件，不能只上传 HTML 或构建输出。密码继续使用原 scrypt 校验与 HttpOnly/SameSite 会话，长度限制为 6–20 位。

本地构建产物包含内容根目录路径；后续部署需在目标服务器项目目录构建，不能直接把 Windows 的动态构建产物搬到 Linux 运行。

## 可直接生效的内容

文章标题、正文、分类、标签、草稿状态，以及已有配置支持的站点标题、横幅文字/图片、头像、导航、侧栏、栏目内容和主题颜色。在“外观与布局 → 动态外观参数”可设置正文基础字号、标题缩放、卡片圆角和背景底色；所有数值有范围限制。背景底色与原壁纸/横幅设置共同作用，不会自动关闭壁纸。

动态图片路径通过受限的图片端点读取；`src/assets` 图片以及已发布文章引用的本地插图支持运行时更新，不将整个源码目录暴露为静态目录。静态 JS/CSS 使用带哈希的文件名并长期缓存，动态 HTML 不缓存，源图片通过 ETag 重新验证。

## 需要构建或重启的设置

字体、字体子集、构建插件、依赖、代码高亮主题配置、站点域名/base、任意 TypeScript 高级源码、新布局/新组件/CSS 效果都属于部署设置。后台对此显示提示；动态设置的高级源码编辑被禁用。关闭动态模式构建静态站点不会自动将运行时覆盖写回原 TypeScript 文件。

Markdown 使用项目原插件链与 Expressive Code。现有 MDX 内容及已部署的组件导入继续支持；新增 MDX 组件导入会被后台拒绝并提示先构建部署，语法错误也不会写入。新增组件的客户端资源必须由部署构建生成。别名、自定义永久链接、RSS/Atom 和 Swup 导航沿用现有逻辑；动态模式关闭 Swup 页面缓存，配置版本改变时刷新持久外壳，防止导航和侧栏读取旧配置。

动态模式使用完整字体文件，避免构建时的字体子集遗漏新文章中的字符；字体资源可缓存。侧栏总字数采用运行时 Markdown 文本估算，MDX 表达式与 include 展开可能使其与静态模式统计略有差异。构建生成的 sitemap 仍属于部署产物，新增 URL 若需要立即进入 sitemap，应另行增加运行时 sitemap。

## 验证

```powershell
pnpm.cmd exec astro check
pnpm.cmd check:package-manifest
node --experimental-strip-types --test tests/runtime/store.test.ts tests/admin/documents.test.ts
node --experimental-strip-types --test tests/runtime/production.test.mjs
pnpm.cmd exec playwright test tests/site/runtime.spec.ts --config playwright.runtime.config.ts
pnpm.cmd build
```

生产测试和浏览器测试会临时保存测试数据并恢复，请依次运行，避免在测试期间手工编辑后台。

2026-10-12 本地验收：Astro 检查 0 错误；项目 TypeScript 检查、依赖清单、动态构建和静态构建通过。运行时/文档存储 4 项、原密码/图片/文章存储 5 项、生产 SSR 验收 1 项、动态浏览器验收 3 项、原首页可访问性片段 1 项全部通过。生产测试覆盖草稿隔离、搜索、分类/标签、RSS、图片、MDX、导航文字、横幅副标题、头像和重启持久化；确认保存不改构建文件、不重启服务。

文章保存约 16–50 ms；配置首次校验约 2–6 秒，同类再次保存约 7–25 ms。首次或切换配置领域仍有类型校验初始化成本，没有承诺所有配置保存都在 1 秒内返回。本地动态服务已启动在 `http://127.0.0.1:4326/`，未部署远程服务器或推送 GitHub。
