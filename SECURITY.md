# Security Policy

[English](#english) · [简体中文](#简体中文)

## English

### Supported versions

`0.1.x` is maintained. Earlier versions no longer receive security fixes.

### Reporting a vulnerability

**Please do not report security issues in public issues.**

Once this repository is published on GitHub, use **Security → Report a vulnerability** to submit privately. Until then, contact the maintainer directly. Please include:

- Affected version or commit
- Steps to reproduce and any preconditions
- Impact (for example: can another user's data be read, can authentication be bypassed, can arbitrary code be executed)
- A minimal reproduction or PoC when convenient

Please do not include real users' email addresses, keys, book files or database exports in a report.

### Scope

In scope:

- Supabase RLS policy flaws that allow reading or writing another user's data
- Authentication bypass, session fixation, or flaws in the account deletion flow
- Leakage of the `service_role` key or other server-side secrets into client bundles
- Path traversal, arbitrary file read/write or remote code execution through upload and EPUB parsing
- Signed storage URLs that grant access to another user's files
- Known high-severity vulnerabilities in dependencies

Generally out of scope:

- Issues that require the deployer's `service_role` key or database password first
- Rate limiting failing on a single instance (a known limitation, see README)
- Factual errors or inappropriate wording in AI-generated content
- Issues caused by deployers changing configuration, disabling RLS or making buckets public

### Notes for deployers

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never put it in any `NEXT_PUBLIC_*` variable or client code.
- `.env*` is excluded by `.gitignore`; never paste keys into issues, screenshots or logs.
- Storage buckets must stay **private**; book text and covers should only be served through short-lived signed URLs.
- If you suspect a key leak, rotate the `anon` / `service_role` keys in the Supabase dashboard immediately and redeploy.
- The app collects no telemetry. If you add logging or analytics, make sure email addresses, note text and book content are not recorded.

### Process

After a report is received, the maintainer will confirm the issue, assess its impact, and prepare a fix and release notes. Fixes are recorded in the CHANGELOG, and reporters are credited with their consent.

## 简体中文

### 支持的版本

当前维护 `0.1.x`。更早的版本不再接收安全修复。

### 报告安全问题

**请不要用公开 Issue 报告安全漏洞。**

仓库发布到 GitHub 后，请通过仓库的 **Security → Report a vulnerability** 私密提交；在此之前，可直接联系仓库维护者。报告中请包含：

- 受影响的版本或提交号
- 复现步骤与必要的前置条件
- 影响范围（例如：能否读取他人数据、能否绕过登录、能否执行任意代码）
- 如方便，附上最小复现或 PoC

请不要在报告中附带真实用户的邮箱、密钥、书籍文件或数据库导出。

### 范围

以下问题属于安全范围：

- Supabase RLS 策略缺陷，导致跨用户读取或写入数据
- 鉴权绕过、会话固定、账户删除流程缺陷
- `service_role` 密钥或其它服务端密钥泄露到客户端产物
- 文件上传与解析（EPUB）导致的路径穿越、任意文件读写或远程代码执行
- 存储签名 URL 越权访问他人文件
- 依赖中的已知高危漏洞

以下通常不属于安全范围：

- 需要先拿到部署者 `service_role` 密钥或数据库密码才能利用的问题
- 限流在单实例下失效（已知限制，见 README）
- AI 生成内容的事实错误或不当措辞
- 部署者自行修改配置、关闭 RLS 或公开 bucket 造成的问题

### 部署者注意事项

- `SUPABASE_SERVICE_ROLE_KEY` 只能在服务端使用，不要写进任何 `NEXT_PUBLIC_*` 变量或客户端代码。
- `.env*` 已被 `.gitignore` 排除；不要在 Issue、截图或日志中粘贴密钥。
- Storage bucket 必须保持**私有**；书籍正文与封面只应通过短时签名 URL 访问。
- 一旦怀疑密钥泄露，立即在 Supabase 控制台轮换 `anon` / `service_role` 密钥，并重新部署。
- 应用不采集遥测；但如果自行接入日志或分析服务，请先确认不会记录邮箱、笔记正文与书籍内容。

### 处理流程

收到报告后，维护者会先确认问题、评估影响范围，再准备修复与发布说明。修复发布后会在 CHANGELOG 中记录，并在征得报告者同意后致谢。
