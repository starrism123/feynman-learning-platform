require("dotenv").config();

const { createApp } = require("./app");
const { connectDatabase } = require("./config/database");
const port = Number(process.env.PORT) || 3000;
const app = createApp();

async function start() {
  try {
    await connectDatabase();
    app.listen(port, () => {
      console.log(
        `Feynman Platform backend is running at http://localhost:${port}`,
      );
    });
  } catch (error) {
    console.error("服务启动失败:", error.message);
    process.exitCode = 1;
  }
}

start();
