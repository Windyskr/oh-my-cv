# 修改用户简历

- 当前分支使用 Cloudflare D1。用户简历以鉴权 API 返回的数据为准。
- 使用 `OHMYCV_API_TOKEN` 环境变量；`OHMYCV_API_URL` 默认指向 `https://ohmycv-auth.ccgslb.workers.dev`。不要打印、提交或写入简历中的 API 令牌。
- 修改当前简历前运行 `node scripts/cloud-resume.mjs current`，或调用 `GET /api/v1/active-resume`。用户指定其他简历时，先查询列表并确认对应 ID。
- 使用 `node scripts/cloud-resume.mjs patch --markdown <临时文件>`、`--css <临时文件>` 或 `--json <临时文件>` 提交修改。接口需要当前 revision，遇到 `409` 先重新读取并保留其他修改。
- 日常简历修改通过 API 提交；Cloudflare 管理凭据只用于部署及明确要求的数据迁移。
- 网页会自动读取 API 修改。`resumes/` 目录中的文件属于旧版文件存储和迁移来源，直接修改这些文件不会更新云端简历。
- 账户及 API 文档见 `CLOUD-API.md`。迁移已有数据时，需要先确认已经注册的目标用户名，不需要用户发送密码。
- 个人简历、迁移备份、临时凭据及截图不加入 Git。验证程序使用独立测试账户，验证后清理测试数据。
