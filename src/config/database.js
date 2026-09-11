const mongoose = require("mongoose");

async function connectDatabase(uri = process.env.MONGO_URI) {
  if (!uri) {
    throw new Error("缺少 MONGO_URI，请先配置数据库连接地址");
  }

  await mongoose.connect(uri);
  return mongoose.connection;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectDatabase, disconnectDatabase };
