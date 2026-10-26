// 本机开发用的 MongoDB：不用装 Docker 或 MongoDB，数据持久保存在 .data/mongo
const fs = require("node:fs");
const path = require("node:path");
const { MongoMemoryServer } = require("mongodb-memory-server");

const DB_PATH = path.join(__dirname, "..", ".data", "mongo");
const PORT = Number(process.env.LOCAL_DB_PORT) || 27017;

async function main() {
  fs.mkdirSync(DB_PATH, { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: { port: PORT, dbPath: DB_PATH, storageEngine: "wiredTiger" },
  });
  console.log(`本地 MongoDB 已启动：${server.getUri()}feynman-db`);
  console.log(`数据目录：${DB_PATH}（按 Ctrl+C 停止，数据会保留）`);

  async function shutdown() {
    await server.stop({ doCleanup: false });
    process.exit(0);
  }
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("本地 MongoDB 启动失败:", error.message);
  process.exitCode = 1;
});
