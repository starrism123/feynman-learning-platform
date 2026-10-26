const path = require("path");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { createApp } = require("../src/app");
const {
  connectDatabase,
  disconnectDatabase,
} = require("../src/config/database");

const DEFAULT_API_PORT = 3000;
const DEFAULT_WEB_PORT = 5173;
const DEFAULT_HOST = "127.0.0.1";
const DEMO_JWT_SECRET =
  "learning-demo-only-secret-never-use-this-in-production";

function parsePort(value, name, fallback) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`${name} 必须是 0 到 65535 之间的整数`);
  }
  return port;
}

function listen(app, port, host) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.once("listening", () => {
      server.off("error", onError);
      resolve(server);
    });
  });
}

function closeServer(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function serverPort(server) {
  const address = server.address();
  return typeof address === "object" && address ? address.port : undefined;
}

function restoreEnvironment(name, previousValue) {
  if (previousValue === undefined) delete process.env[name];
  else process.env[name] = previousValue;
}

function describeStartupError(error, apiPort, webPort) {
  if (error?.code !== "EADDRINUSE") return error.message;
  return [
    `端口已被占用：API=${apiPort}，网页=${webPort}。`,
    "关闭占用端口的程序，或临时指定其他端口：",
    "$env:LEARNING_API_PORT=3001; $env:LEARNING_WEB_PORT=5174; npm run learn:ajax",
  ].join("\n");
}

async function startLearningDemo(options = {}) {
  const host = options.host || DEFAULT_HOST;
  const apiPort = parsePort(
    options.apiPort ?? process.env.LEARNING_API_PORT,
    "LEARNING_API_PORT",
    DEFAULT_API_PORT,
  );
  const webPort = parsePort(
    options.webPort ?? process.env.LEARNING_WEB_PORT,
    "LEARNING_WEB_PORT",
    DEFAULT_WEB_PORT,
  );
  if (apiPort !== 0 && apiPort === webPort) {
    throw new Error("LEARNING_API_PORT 与 LEARNING_WEB_PORT 不能相同");
  }

  const previousMongoUri = process.env.MONGO_URI;
  const previousJwtSecret = process.env.JWT_SECRET;
  let mongoServer;
  let apiServer;
  let webServer;
  let closed = false;

  async function close() {
    if (closed) return;
    closed = true;
    await Promise.allSettled([closeServer(webServer), closeServer(apiServer)]);
    await disconnectDatabase();
    if (mongoServer) await mongoServer.stop();
    restoreEnvironment("MONGO_URI", previousMongoUri);
    restoreEnvironment("JWT_SECRET", previousJwtSecret);
  }

  try {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri("feynman-learning-demo");
    process.env.JWT_SECRET = DEMO_JWT_SECRET;
    await connectDatabase(process.env.MONGO_URI);

    apiServer = await listen(createApp(), apiPort, host);
    const actualApiPort = serverPort(apiServer);
    const apiBaseUrl = `http://${host}:${actualApiPort}`;

    const webApp = express();
    webApp.get("/demo-config.js", (req, res) => {
      res
        .type("application/javascript")
        .send(
          `window.LEARNING_DEMO_CONFIG = ${JSON.stringify({ apiBaseUrl })};`,
        );
    });
    webApp.use(
      express.static(path.join(__dirname, "..", "examples", "ajax-demo")),
    );
    webServer = await listen(webApp, webPort, host);

    const actualWebPort = serverPort(webServer);
    const webUrl = `http://${host}:${actualWebPort}`;
    if (!options.silent) {
      console.log("\nAJAX 学习演示已启动");
      console.log(`教学网页：${webUrl}`);
      console.log(`真实 API：${apiBaseUrl}`);
      console.log("练习数据保存在临时 MongoDB 中，按 Ctrl+C 后自动清空。\n");
    }

    return {
      apiBaseUrl,
      apiPort: actualApiPort,
      webUrl,
      webPort: actualWebPort,
      close,
    };
  } catch (error) {
    await close();
    error.learningDemoMessage = describeStartupError(error, apiPort, webPort);
    throw error;
  }
}

if (require.main === module) {
  startLearningDemo()
    .then((demo) => {
      let stopping = false;
      async function shutdown(signal) {
        if (stopping) return;
        stopping = true;
        console.log(`\n收到 ${signal}，正在关闭教学网页、API 和临时数据库...`);
        await demo.close();
        console.log("学习演示已关闭，临时数据已清空。");
      }
      process.once("SIGINT", () => shutdown("Ctrl+C"));
      process.once("SIGTERM", () => shutdown("SIGTERM"));
    })
    .catch((error) => {
      console.error("AJAX 学习演示启动失败：");
      console.error(error.learningDemoMessage || error.message);
      process.exitCode = 1;
    });
}

module.exports = { startLearningDemo };
