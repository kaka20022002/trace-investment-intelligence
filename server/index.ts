import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envPath)) {
  if (typeof process.loadEnvFile !== "function") {
    console.error(
      "读取 .env 需要 Node.js 20.12+，推荐使用 Node.js 22。也可直接设置服务器环境变量。",
    );
    process.exit(1);
  }
  try {
    process.loadEnvFile(envPath);
  } catch {
    console.error("无法读取项目 .env 文件，请检查文件格式与读取权限。");
    process.exit(1);
  }
}

const portValue = process.env.PORT ?? "4173";
const port = Number(portValue);
if (
  !/^\d+$/.test(portValue) ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  console.error("PORT 必须为 1–65535 之间的整数。");
  process.exit(1);
}
const host = process.env.HOST?.trim() || "127.0.0.1";
const app = createApp({ staticDir: `${projectRoot}dist` });
const server = app.listen(port, host, () => {
  console.log(
    `证据分析服务已启动，端口 ${port}。未配置模型时可继续使用前端本地规则。`,
  );
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.maxHeadersCount = 100;
server.on("error", () => {
  console.error("服务启动失败，请检查监听地址及端口占用。");
  process.exit(1);
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
