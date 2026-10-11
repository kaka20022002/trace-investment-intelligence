# 换机交接说明｜溯知 Trace

打包日期：2026-10-11。**请先解压完整项目包，再阅读本文件。**

## 一、当前进度与后续目标

- 项目已开发完成：事件工作台、导入提取与人工归并、证据时间线、原文和四类时间、冲突/否认/更正/过期判断、关注、简报、备份恢复。
- 本轮打包前已通过 159 项单元/接口测试与生产构建；先前完整浏览器验收为 34 项桌面/手机模拟测试通过。记录见 `docs/TESTING.md`。
- 用户已确定并完成：**GitHub 公开仓库 `trace-investment-intelligence`**。
- 公网可操作演示：https://kaka20022002.github.io/trace-investment-intelligence/ （GitHub Pages 静态规则模式）。
- 源代码仓库：https://github.com/kaka20022002/trace-investment-intelligence
- 旧电脑压缩包不包含 `.git`；新电脑已重新初始化并推送。不要把 localhost 当作唯一交付地址。

## 二、包内包含什么

| 内容 | 位置 |
| --- | --- |
| 前端完整源码 | `src/`、`public/`、`index.html` |
| 可选模型代理后端 | `server/` |
| 精确依赖锁定与脚本 | `package.json`、`package-lock.json` |
| 类型、构建与浏览器测试配置 | `tsconfig.json`、`vite.config.ts`、`playwright.config.ts` |
| 全部自动化测试源码 | `tests/` |
| 可直接上传静态托管的构建产物 | `dist/` |
| README、实现方案、测试及 AI 使用记录、部署指南与截图 | `README.md`、`docs/` |
| 安全环境模板、Git 忽略规则 | `.env.example`、`.gitignore` |
| 本换机交接说明 | `HANDOFF.md` |

不包含：`node_modules/`、`.cache/`、真实 `.env`、任何 API Key 或登录状态、`.codebuddy/` 开发会话、`.git/`、测试临时输出、旧电脑进程和工具二进制。它们不是恢复和部署项目所需的源码，依赖由锁文件重装。

**旧电脑中的 `.codebuddy/` 没有删除，只是不放进迁移/公开源码包。**

## 三、新电脑本地启动（Windows / macOS / Linux）

1. 安装 Node.js 22 或更新版本的稳定/LTS运行时、npm；源码发布另需 Git 或 GitHub Desktop。
2. 将完整 ZIP 解压到一个独立文件夹，例如 `trace-investment-intelligence`。不要直接在 ZIP 中打开或运行。
3. 终端进入含 `package.json` 的项目根目录。
4. 执行 `npm ci`，按 `package-lock.json` 安装依赖。首次安装需要联网。
5. 执行 `npm run dev`。
6. 浏览器打开 **http://localhost:5173**。

未配置模型密钥也可以使用完整规则演示，不需要先部署数据库。保留终端运行；关闭开发进程后该本地 URL 不再可用。

### 验证与生产运行

- `npm run check`：类型检查 + 159 项业务/接口/完整性测试。
- `npm run build`：重新生成 `dist/`。
- `npm start`：用 Node 同时提供生产页面与 API，默认地址 **http://localhost:4173**。
- `npm run test:e2e`：34 项桌面/手机模拟测试；默认需要本机安装 Google Chrome。详见 `README.md` 的浏览器环境说明。

当前 `npm start` 依赖 `tsx`，应安装完整依赖，不要只执行 `npm ci --omit=dev`。

**不要直接双击 `dist/index.html` 使用 `file://` 打开**，请通过 HTTP 服务或静态托管访问。

## 四、最快的公网方式：静态站点

无需启用模型后端时，可以直接部署完整包中的 **`dist/` 内容**。另外随附的 `trace-investment-intelligence-static-20261011.zip` 只包含站点文件，ZIP 根目录即 `index.html`、`assets/` 和图标，适用于支持 ZIP 上传的静态托管平台。

平台需要配置时：

- 项目根目录：含 `package.json` 的目录。
- 构建命令：`npm ci && npm run build`。
- 构建输出目录：`dist`。
- Node 版本：22+。
- 默认部署到域名根路径 `/`。若使用 GitHub Pages 的 `/仓库名/` 子路径，需先调整 Vite `base` 和相关资源路径再构建，不能原样上传后忽略资源错误。
- 前端使用 hash 路由，不依赖服务端页面路由重写。

静态模式没有 Node `/api`，会明确显示规则模式。数据源为虚构示例和用户手动导入，不会假装真实 AI 调用或金融数据接口成功。

**只上传 `dist/` 内容，不要把完整源码包、凭据或本地记录备份放进公开站点根目录。**

## 五、Cloud Studio / Node 托管继续操作

若使用 CodeBuddy：在新电脑打开本项目，通过对话集成中的 Cloud Studio 入口进行连接，并按实际提供的部署能力选择项目。当前迁移包不包含对该平台的授权，不声称支持某个未经核验的一键命令。

如果目标环境支持长期运行 Node 服务：

1. 上传/克隆源码并安装完整依赖。
2. 运行 `npm run build`。
3. 在平台设置启动命令 `npm start`。
4. 在服务器环境变量中设置 `HOST=0.0.0.0`；`PORT` 使用平台分配值或 4173，并将公网入口映射到该端口。
5. 使用平台实际生成的 HTTPS 地址访问，确认停止本机开发服务后仍可访问。
6. 如要真实模型提取，将 `.env.example` 复制为 `.env` 或在平台密钥管理中设置相同变量。模型 Key 只在后端，禁止 `VITE_` 前缀。

公开开放模型代理之前，需增加访问控制、全局预算与限流；当前没有生产级用户认证。建议先发布**不配置模型 Key 的规则演示**，避免费用和滥用风险。

## 六、GitHub 公开仓库发布

建议使用 GitHub Desktop 完成新电脑上的身份认证、仓库初始化与发布，避免复制旧机器的令牌或配置。

1. 在 GitHub Desktop 登录自己的 GitHub 账号。
2. 将解压后的项目根目录创建/添加为本地仓库；检查实际仓库目录中确实有 `package.json`，不要误建成空的嵌套目录。
3. 提交前检查 `.gitignore` 生效：不包含 `.env`、`node_modules`、`.cache`、开发会话、测试临时输出、迁移 ZIP 及浏览器备份。
4. 创建首次提交。
5. 发布仓库名 `trace-investment-intelligence`，可见性为 **Public**。如果名称被占用，选择新名字，不覆盖或强推已有仓库。
6. 保存真实仓库 URL，浏览器退出登录后确认可访问。
7. 公网站点成功后，将真实网站 URL 和仓库 URL 更新到 `README.md` 与 `docs/DEPLOYMENT.md`，再提交文档更新。

如果采用命令行，请在新电脑配置好自己的 Git 身份并通过官方 GitHub 授权。不要将密码、令牌或他人的作者身份写入仓库。

## 七、特别注意：个人导入记录不在源码文件里

事件导入内容、关注列表等用户操作保存在**旧电脑浏览器对应站点的 localStorage**，不是项目目录里的文件，因此源码 ZIP 不会自动包含这些记录。

如需携带自己的数据，请在旧电脑打开产品：

**数据与设置 → 导出完整备份 → 将下载的 JSON 单独传到新电脑 → 数据与设置 → 恢复备份。**

换电脑、换浏览器，或从 `localhost` 改为公网域名，都会使用不同的浏览器存储。没有备份时，新环境将展示 6 个虚构事件、14 条模拟证据。

个人 JSON 备份请私下传输，不放入公开 GitHub 仓库或静态网站。

## 八、部署完成验收

- 用另一设备/无痕窗口打开真实 HTTPS URL。
- 六个事件正常显示，明确标注虚构数据/规则模式。
- 导入演示案例，选择前版本后状态由已否认转为已证实，旧原文保留。
- 不选择前版本时保留冲突；未核验来源不会自动证实。
- 原文、四类时间、来源链、过期与更正可查看。
- 页面刷新后当前浏览器数据保留；备份可下载恢复。
- GitHub 公开仓库内含源码、锁文件、README、AI 使用记录和测试说明，且没有私密数据。
- 提交真实 Web URL 与仓库 URL。当前包只负责迁移，不代表远程发布已经完成。

## 九、传输校验

交付目录附带 `SHA256SUMS.txt`，记录两个 ZIP 的 SHA-256。传输后可比较文件摘要确认压缩包未损坏：macOS/Linux 使用 SHA-256 文件校验工具，Windows 可使用 PowerShell `Get-FileHash`。

还可以用系统压缩工具执行“测试压缩包”功能；文件完整后再解压。

## 十、给下一台电脑上的 AI 助手

可直接告诉它：

> 请先阅读 HANDOFF.md、README.md、docs/DEPLOYMENT.md 和 docs/TESTING.md。该项目已完成开发并附带 dist，下一步是在我的 GitHub 账号新建公开仓库 trace-investment-intelligence，并选择可用的 Cloud Studio 或其他托管完成公网部署。请保留现有业务实现，先验证构建，再做发布。不要提交任何凭据、开发会话或用户数据；没有授权或部署成功时不能伪造 URL。完成后在文档中填写实际网站和仓库地址，并验证公网核心交互。
