require("dotenv").config();

const { createApp } = require("./app");
const { getJwtSecret } = require("./config/auth");
const { connectDatabase, disconnectDatabase } = require("./config/database");
const port = Number(process.env.PORT) || 3000;
const app = createApp();

async function start() {
  try {
    getJwtSecret();
    await connectDatabase();
    const server = app.listen(port, () => {
      console.log(
        `Feynman Platform backend is running at http://localhost:${port}`,
      );
    });

    async function shutdown(signal) {
      console.log(`收到 ${signal}，正在安全关闭服务...`);
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    }

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("服务启动失败:", error.message);
    process.exitCode = 1;
  }
}

start();
