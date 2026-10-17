# Cloudflare 账户与简历 API

分支：`feat/cloudflare-auth-api`。独立部署地址：<https://ohmycv-auth.ccgslb.workers.dev>。

## 使用

1. 打开 `/zh-cn/login`，使用用户名与密码注册、登录。
2. 在“我的简历”中创建或打开简历。正文、CSS、名称、排版参数、当前选择和历史记录均保存到 Cloudflare D1。
3. 点击右上角用户名进入账户页，创建 API 令牌。可以选择仅读取或读取和修改，限定某份简历，并指定有效期。
4. 将令牌交给需要访问简历的 Agent。网页会自动读取 API 修改；同时修改同一版本时返回 `409`。

API 令牌只在创建时显示一次。数据库仅保存令牌摘要，可以随时撤销。网页使用 HttpOnly 会话 Cookie；用户名与密码登录使用随机盐和 scrypt 保存密码摘要。

## Agent 命令

```bash
export OHMYCV_API_TOKEN='账户页生成的令牌'
export OHMYCV_API_URL='https://ohmycv-auth.ccgslb.workers.dev'

node scripts/cloud-resume.mjs current
node scripts/cloud-resume.mjs list
node scripts/cloud-resume.mjs get --id 1
node scripts/cloud-resume.mjs patch --markdown /tmp/resume.md
node scripts/cloud-resume.mjs patch --id 1 --json /tmp/layout-update.json
```

`current` 读取最近在网页中打开的简历。`patch` 先读取最新 revision，再通过 `If-Match` 更新；冲突时停止覆盖。JSON 更新可以只包含 `name`、`markdown`、`css` 或部分 `styles`，例如：

```json
{ "styles": { "marginTop": 20, "marginBottom": 35 } }
```

请通过环境变量提供令牌，不要写进简历、Git 提交或公开链接。

## 后台 PDF 导出

```bash
export OHMYCV_API_TOKEN='具有读取权限的 API 令牌'
pnpm export:pdf
pnpm export:pdf output/pdf/custom.pdf --id 1
```

命令通过 API 读取当前简历，再使用本机无界面的 Chrome 生成 PDF，无需手动打开网页。默认保存到 `output/pdf/resume.pdf`。可以使用 `RESUME_PDF_CHROME_PATH` 指定 Chrome；读取令牌不会传入浏览器环境。网页中的 PDF 按钮继续使用浏览器打印。

## REST API

[OpenAPI 文档](https://ohmycv-auth.ccgslb.workers.dev/api/openapi.json)

所有简历接口使用 `Authorization: Bearer <token>`，只访问令牌所属账户的数据。限定简历的令牌无法读取其他简历；只读令牌无法修改数据。账户及令牌管理需要网页登录会话。

| 方法        | 路径                                     | 用途                                             |
| ----------- | ---------------------------------------- | ------------------------------------------------ |
| GET         | `/api/v1/active-resume`                  | 当前简历，包含 revision                          |
| GET         | `/api/v1/resumes`                        | 简历列表；使用 before 翻页                       |
| POST        | `/api/v1/resumes`                        | 创建简历                                         |
| GET         | `/api/v1/resumes/:id`                    | 完整简历，返回 ETag                              |
| PATCH / PUT | `/api/v1/resumes/:id`                    | 更新正文、样式等；需要 If-Match 或 JSON revision |
| DELETE      | `/api/v1/resumes/:id`                    | 软删除；需要当前 revision                        |
| POST        | `/api/v1/resumes/:id/undelete`           | 恢复已删除简历                                   |
| GET         | `/api/v1/resumes/:id/history`            | 历史列表；before 为上一页最后的版本 ID           |
| GET         | `/api/v1/resumes/:id/history/:versionId` | 历史快照                                         |
| POST        | `/api/v1/resumes/:id/history/restore`    | 使用 `{id, revision}` 恢复版本                   |
| POST        | `/api/v1/import`                         | 使用 `{sourceId, resume}` 导入简历，支持重复执行 |
| POST        | `/api/v1/resumes/:id/history/import`     | 导入旧版本，保留时间与内容                       |

未登录返回 `401`，权限不足返回 `403`，其他账户的简历返回 `404`，版本冲突返回 `409`，缺少 revision 返回 `428`，限流返回 `429`。`If-None-Match` 匹配时读取简历返回 `304`。

## 迁移现有数据

```bash
node scripts/export-cloud-backup.mjs
```

默认备份到 `output/migration/resumes-cloud.json`，包含现有文件简历、历史记录、删除备份和当前选择，保留创建时间、更新时间、历史修改来源及版本关联，文件权限为 `0600`，不会加入 Git。

登录后可在账户页选择此文件导入。重复选择同一份备份会跳过已经导入的内容，遇到请求限额时等待后继续。也支持原有 `.ohmycv.json` 导出文件和当前浏览器中的旧简历。

已登录 Cloudflare 的维护者也可以在用户自行注册后，按用户名迁移，无需获取用户密码：

```bash
node scripts/migrate-cloud.mjs --username 已注册的用户名
```

维护脚本创建有效期一小时的临时导入令牌，迁移完成后删除该令牌；重新运行可以继续未完成的导入。真实简历只归属于指定账户。

## 构建与部署

```bash
pnpm install --frozen-lockfile
pnpm cloud:migrate
pnpm build:cloudflare
pnpm dlx wrangler@4.151.1 deploy
```

`wrangler.toml` 配置 Worker `ohmycv-auth`，通过 `DB` 绑定 D1 数据库 `ohmycv-auth-db`。迁移文件位于 `migrations/`。浏览器资源与 API 由同一个 Worker 提供，不需要跨域配置。

```bash
pnpm start
pnpm start -- --port 3001
```

本地启动使用 Wrangler，D1 绑定设置 `remote = true`，与线上连接同一个数据库。需要本机已登录对应 Cloudflare 账户。客户端构建会缓存；客户端源码变化后重新编译，Worker 源码由 Wrangler 监测更新。

自定义域名部署时，构建前设置 `NUXT_SITE_URL`。当前密码登录不依赖第三方 OAuth 密钥，也没有公开管理员密钥。定时任务每天清理过期会话和限流记录。

## 数据结构

D1 保存 `users`、`sessions`、`resumes`、`resume_history`、`api_tokens`、`user_settings` 和迁移记录。所有简历与历史 SQL 都校验账户归属。编辑与历史记录在同一事务中保存，更新使用 revision 条件。

单份简历内容限制为 1.5 MB，包含内嵌图片。历史列表只读取元数据，完整内容按版本单独读取。删除操作保留历史，数据不会因网页关闭或更换浏览器而消失。
