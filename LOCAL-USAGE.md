# 本地简历编辑与 PDF 导出

## 安装和启动

本地功能使用 Node.js 22.12+ 和 `pnpm@9.4.0`。在项目根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm start
```

打开 http://localhost:3000/local ，或者在简历列表中点击“本地简历”。本地启动会复用已经编译好的程序，首次启动或源码、依赖变化时自动重新编译。修改 `resumes/` 中的正文、样式或照片无需重新编译。

需要后台运行服务时，在项目根目录执行：

```bash
mkdir -p logs
tmux new-session -d -s ohmycv-local 'pnpm start --host 127.0.0.1 --port 3000 > logs/ohmycv-local.log 2>&1'
```

查看日志：`logs/ohmycv-local.log`。停止服务：`tmux kill-session -t ohmycv-local`。

可以执行 `pnpm build:local` 提前完成编译。程序源码开发仍可使用 `pnpm dev --host 127.0.0.1 --port 3000`，以便修改代码后自动更新。源码编译结果位于 `site/.output-local/`，修改时间与文件大小记录位于 `.cache/local-build.json`；并发启动会共用编译锁。

## 本地文件

将简历保存到以下位置：

| 文件 | 内容 |
| --- | --- |
| `resumes/resume.md` | 简历正文和 YAML 页眉 |
| `resumes/resume.css` | 自定义排版样式 |
| `resumes/resume.ohmycv.json` | 简历名称、页面设置及完整导入备份 |

首次准备文件时，可以在普通编辑器中导出 Markdown、复制 CSS，并在简历列表中使用“另存为”导出 JSON。本地模式使用 JSON 中第一份简历的名称和 `styles`，请保留目标简历对应的条目。

`resumes/` 和 `output/` 默认由 Git 忽略，本地简历、照片及导出文件会保留在工作目录。

## 编辑与自动更新

`/local` 页面提供 Markdown / CSS 编辑器、实时预览和排版工具栏。停止编辑约 0.5 秒后，会自动将正文、CSS、简历名称和页面设置保存到本地文件，同时更新 JSON 备份。保存期间继续编辑的内容会接着保存；临时保存失败会自动重试。点击“保存”或按 `Ctrl+S` 仍可立即保存。

使用 Codex 修改本地文件后，页面约每秒自动读取一次，无需重新导入。网页中存在待保存的修改时，自动读取会保留编辑内容；如果文件也发生变化，页面会提示冲突并暂停自动保存。可以导出 Markdown 备份当前正文，再选择“使用文件内容”。页面切换前会立即保存；保存失败或存在冲突时，会提示尚未保存的修改。

页眉中使用 `university-logo`、`resume-photo` 类名的独立图片会与个人信息分开排版。编辑器默认折叠下列区域中的图片代码：

```html
<!-- #region university-logo -->
<img class="university-logo" src="..." alt="学校标志">
<!-- #endregion -->
```

个人照片使用 `resume-photo` 作为区域名称和图片类名。

## 后台导出 PDF

```bash
pnpm export:pdf
pnpm export:pdf output/pdf/resume-custom.pdf
```

默认保存到 `output/pdf/resume.pdf`。命令读取本地文件，复用运行中的服务；服务未启动时，会复用编译结果启动临时服务，并在导出结束后关闭。临时服务日志保存在 `logs/pdf-export-server.log`。

网页“导出为 PDF”按钮会在后台生成并直接下载当前编辑内容，包含未保存的修改。导出操作不会覆盖简历源文件。

后台使用 Puppeteer 和无界面的 Chrome / Chromium，复用现有渲染与分页逻辑。需要在运行服务的机器上安装 Chrome / Chromium，程序会检查常见安装位置；`puppeteer-core` 不会下载浏览器。

可选环境变量：

| 变量 | 用途 |
| --- | --- |
| `RESUME_PDF_CHROME_PATH` | 指定 Chrome / Chromium 可执行文件位置 |
| `RESUME_PDF_SERVER_URL` | 指定已运行的本地 HTTP 服务，例如 `http://127.0.0.1:3000` |
| `RESUME_PDF_NO_SANDBOX=1` | 在运行环境确实需要时关闭 Chromium 沙盒 |

使用现有服务时，浏览器相关变量需要设置在服务进程中。Google Fonts 在线字体选择需要在 `site/.env` 中配置 `NUXT_PUBLIC_GOOGLE_FONTS_KEY`；内置字体可以直接使用。

部署为纯静态网站后，普通简历编辑与原有浏览器打印导出仍可使用。本地文件接口和后台 PDF 导出接口在 `pnpm start` 本地服务及开发服务中启用，普通静态构建默认关闭这些功能。
