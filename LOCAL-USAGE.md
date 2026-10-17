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

## 标题间距

右侧“标题样式与间距”提供章节标题字号、横线粗细、标题与横线间距、横线下方间距，统一作用于所有章节标题。像素设置支持 0.1px 步长。修改后会重新分页，并通过自动保存写入 JSON 的 `styles.headingRuleGap` 和 `styles.headingContentGap`；网页预览和 PDF 导出使用相同设置。

旧简历未设置这两个字段时沿用原有 CSS。点击“恢复原有样式”会清除这两个覆盖值，重新使用 CSS 中的间距。

## 照片与校徽位置

右侧“图片位置”分别提供个人照片与校徽的水平、垂直偏移设置，范围为 -200–200px，步长为 0.1px。水平正值向右、负值向左，垂直正值向下、负值向上；偏移以页面内容区域左上角（校徽）或右上角（照片）为基准。还可设置照片宽度、高度及校徽宽度；校徽宽度变化时保持原有比例。

尚未调整时沿用现有 CSS 并显示实际偏移；“恢复原有设置”仅清除对应图片的位置和尺寸覆盖值。设置会自动保存至 `styles.photoOffsetX`、`styles.photoOffsetY`、`styles.logoOffsetX`、`styles.logoOffsetY`，并用于 PDF 导出。简历中缺少对应图片时，该组控件会禁用。

## 页眉、正文与精确输入

- “页眉与个人信息”：姓名字号、联系方式字号、信息区域上方留白、页眉最小高度、姓名与联系方式间距、页眉与正文间距。
- “正文与条目”：正文段后间距、列表条目间距、列表缩进、条目下方间距、条目行距。
- 已有行距、字号、章节上方间距和页边距控件增加数值输入，并与滑块实时同步。行距支持 0.01 倍，像素数值支持 0.1px；字号设置会直接作用于页面正文。

新增可选设置未配置时继续使用当前 CSS，并显示预览中的实际值。每组可以恢复原有样式。调整后会自动保存、重新分页，并用于 PDF 导出。可选参数、数值范围和对应 CSS 统一定义在 `site/src/utils/layoutSettings.ts`。

## 历史记录

在本地编辑页右侧“文件 → 历史记录”中，可以按时间查看版本，预览旧版排版并恢复。记录包含正文、CSS、简历名称和全部排版设置，并显示修改来源及修改类别。

- 自动保存与手动保存均会生成版本；内容相同的连续保存会去重。
- 服务会监听本地简历文件的变化，读取到的 Codex 或其他编辑器修改也会记录。
- 恢复前会保存当前编辑，完整保留恢复前的版本；文件有冲突时暂停恢复，避免覆盖新修改。
- 历史记录以每页 50 条加载，保存在 `resumes/.history/` 中，重启服务后仍可使用，不会上传到 Git。记录默认保留，未设置自动清理。
- 快照文件按内容去重保存，索引采用原子写入和进程间文件锁。服务首次接入时将当前简历作为初始版本，历史功能启用前的修改不会自动补录。

预览历史版本不会修改当前编辑内容。历史记录仅适用于 `/local` 的本地文件简历。

## GitHub Gist 同步

右侧“文件 → GitHub Gist 同步”可以上传和下载当前简历，包括正文、CSS、名称和全部排版设置。本地文件编辑页与普通编辑页均可使用，通过浏览器直接请求 GitHub API。

1. 点击“在 GitHub 创建 Token”。Classic Token 只需选择 `gist` 权限；Fine-grained Token 需要 Gists 读写权限。
2. 填入 Token，首次上传时将 Gist 地址留空，点击“上传到 Gist”创建 Secret Gist。后续上传更新同一个 Gist，覆盖前需要确认；公开 Gist 会明确提示公开状态。
3. 在其他设备填写 Token 和相同的 Gist 地址或 ID，点击“从 Gist 下载”。检查简历名称后，点击“确认替换当前简历”。

Gist 中使用 `resume.ohmycv.json` 保存完整简历，其他文件保持原样。下载时验证数据格式，本地文件模式先保存当前编辑并保留历史；普通编辑模式先保存当前编辑，再创建简历副本。保存失败或出现本地文件冲突时停止替换。

Token 默认仅保存在当前页面内存，关闭或刷新页面后需要重新填写。勾选“在此浏览器记住 Token”会将其以明文保存在浏览器本地；取消勾选或点击“清除同步设置”可删除保存的 Token。Token 仅发送给 `api.github.com`，不进入简历、Gist 内容、本地文件和版本历史。

Secret Gist 持有链接即可访问，请妥善保管链接。同步不包含历史记录；图片需要嵌入正文或使用其他设备也能访问的图片地址。大型 Gist 文件通过 GitHub 返回的原始文件地址读取，原始文件请求不携带 Token。

## Cloudflare Pages 部署

```bash
pnpm build:cloudflare
pnpm dlx wrangler@4.151.1 pages deploy
```

`wrangler.toml` 使用项目名称 `ohmycv-windyskr`，上传目录为 `site/.output/public`。已登录 Wrangler 时也可以运行 `pnpm deploy:cloudflare` 完成构建与上传。Cloudflare 登录信息从本机 Wrangler 配置读取，代码中不保存令牌。

首次创建 Pages 项目：

```bash
pnpm dlx wrangler@4.151.1 pages project create ohmycv-windyskr --production-branch main --force
```

Cloudflare Git 构建使用仓库根目录，构建命令填写 `pnpm build:cloudflare`，输出目录填写 `site/.output/public`，pnpm 版本使用 `9.4.0`。Node.js 版本由 `.node-version` 指定。已有的 Direct Upload 项目可以继续通过 Wrangler 上传。

云端构建会移除本地文件编辑和历史预览页面，隐藏“本地简历”入口，并为各语言的 `/editor/*` 路径生成客户端路由回退规则。简历正文、CSS、排版设置和 Gist 同步在浏览器中使用，PDF 通过浏览器打印导出；本地文件历史记录与后台 PDF 导出继续通过本地服务使用。

构建时可通过 `NUXT_SITE_URL` 指定站点地址；默认使用 `https://ohmycv-windyskr.pages.dev`，Pages Git 构建也会读取 `CF_PAGES_URL`。构建会更新站点元信息、站点地图和 `robots.txt`，并移除上游 GitHub Pages 的 `CNAME`。个人简历源文件和本地历史记录均不包含在上传目录中。

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
