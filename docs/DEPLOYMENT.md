# 部署与最终提交

## 当前实际状态

| 项 | 实际地址 |
| --- | --- |
| 可操作 Web 产品（GitHub Pages 静态规则演示） | https://kaka20022002.github.io/trace-investment-intelligence/ |
| 源代码仓库（Public） | https://github.com/kaka20022002/trace-investment-intelligence |
| 本机开发 | `http://localhost:5173` |
| 本机生产 Node（含可选 `/api`） | `http://localhost:4173` |

公网站点当前由 **`gh-pages` 分支**托管（内容为 `npm run build` 生成的 `dist/`）。静态托管无模型 API，页面会如实回退规则模式；主链路（工作台、导入归并、时间线、备份）可完整操作。

更新静态站：本地执行 `npm run build` 后，将 `dist/` 内容发布到 `gh-pages` 分支根目录（可附带空文件 `.nojekyll`）。仓库内亦保留 `.github/workflows/deploy-pages.yml`，在可正常 `git push` 到 GitHub 的环境中可改为 Actions 自动部署。

**换机先阅读根目录 `HANDOFF.md`。** 以下 EdgeOne / Node 内容保留为备选或完整模型部署参考。

## 方式一：EdgeOne Pages 静态演示

适合快速交付可公开操作的规则主链路。请在 IDE 集成面板完成 EdgeOne Pages 授权。

1. 执行 `npm ci` 与 `npm run build`。
2. 通过 Pages 控制台上传 `dist/`，或连接用户自己的远程源码仓库。
3. Git 构建方式：构建命令 `npm ci && npm run build`，输出目录 `dist`，Node 22 或更新稳定版本。
4. 等待部署成功，使用实际返回的 HTTPS URL 在无痕窗口和手机中打开。
5. 将验证后的真实 URL 填入提交材料，不能用截图、本地 URL 或未实际存在的域名替代。

静态托管没有 Node 模型 API，页面检查 `/api/health` 失败或收到 HTML 时会如实退回规则模式。导入、归并、版本、结论、备份等本地功能仍可用。路由使用 URL hash，不依赖服务端 SPA 路由配置。

## 方式二：Node 同源完整产品

适合需要实际调用模型的环境。

1. 安装完整依赖（`tsx` 为启动工具，不能用 `npm ci --omit=dev` 后直接运行当前启动命令）。
2. 运行 `npm run build`。
3. 按 `.env.example` 配置模型服务；真实密钥仅放服务端，不使用 `VITE_` 前缀。
4. 运行 `npm start`，默认监听 `127.0.0.1:4173`。
5. 使用 HTTPS 网关反向代理同源页面与 `/api`；保留原始 Host/Origin 一致性。若需要监听所有网卡，显式设置 `HOST=0.0.0.0`。
6. 对公开模型接口补充登录/访问令牌、全局预算限额、集中式限流和审计。现有 IP 限流只保证单实例基本防护，不是生产级访问控制。

不要把真实密钥加进静态构建或公开仓库，也不要公开私人文档或受限金融数据。

## 源码仓库交付

远程公开仓库：https://github.com/kaka20022002/trace-investment-intelligence

`.codebuddy/` 为开发会话数据，保留在本地但不作为公开源码提交。提交内容包含源码、文档、锁文件、测试与 `.env.example`；不含 `.env`、`node_modules`、缓存、会话与测试临时结果。

## 上线验收清单

- HTTPS URL 在未登录浏览器可以打开，不依赖开发机。
- 六个虚构事件、五种状态和“演示工作区”标签正常。
- 导入演示更正，选中前版本后“已否认 → 已证实”，旧原文保留。
- 不选择前版本时保留“证据冲突”。
- 刷新后本浏览器数据仍在，另一台设备使用独立记录。
- 缺失和过期不会生成正常结论，模型失败明确回退。
- 静态模式注明没有实际模型与金融数据接口。
- 原文来源与四类时间可查看，简报与 JSON 可下载。
- 手机导航、弹窗、时间线无页面级横向溢出。
- 最后提交真实 Web URL、真实远程源码 URL、README、AI 使用记录、测试说明。
