# 后台图片上传

文章封面、头像、横幅、音乐封面以及列表/嵌套对象中的图片属性，均提供“上传图片”和预览。图片路径默认收起；展开“使用图片链接或路径（高级）”可继续使用已有文件或外部链接。

选择文件后只更新当前表单，点击保存后才正式应用。上传期间保存和栏目切换被禁用。图片列表末尾可直接多选上传并追加，也可添加空条目后分别上传。

每个文件最大 20 MB，支持 PNG/JPEG/WebP/AVIF/GIF。后端验证真实格式及像素上限，重新编码 WebP，保留动画，不原样存储 SVG/HTML 或用户文件名。现有 SVG 图片链接仍可使用。接口使用原登录会话、写入令牌和同源校验。

文件存储在 `public/uploads/admin/<内容哈希>.webp`，相同内容复用文件，不覆盖原图片。此目录是用户数据，已从 Git 排除，部署/备份时必须保留。上传成功但未保存的图片会保留，可再次选择或通过高级路径复用。动态服务直接读取该目录，新图片不依赖构建；文件名带内容哈希，可长期缓存。

服务器反向代理的后台请求体上限设为 20 MB。更新上传界面和接口本身属于代码部署；上传图片及后续保存属于运行时操作。

验证：`node --experimental-strip-types --test tests/admin/uploads.test.ts`、`node node_modules/@playwright/test/cli.js test tests/site/admin-upload.spec.ts --config playwright.runtime.config.ts`、`pnpm.cmd exec astro check`、`pnpm.cmd type-check`、`pnpm.cmd check:package-manifest`。
