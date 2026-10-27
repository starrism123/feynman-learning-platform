const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../../src/models/User");
const KnowledgePoint = require("../../src/models/KnowledgePoint");
const KnowledgeChunk = require("../../src/models/KnowledgeChunk");
const {
  connectDatabase,
  disconnectDatabase,
} = require("../../src/config/database");

let mongoServer;

async function startTestDatabase() {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri());
}

async function clearTestDatabase() {
  await Promise.all([
    User.deleteMany({}),
    KnowledgePoint.deleteMany({}),
    KnowledgeChunk.deleteMany({}),
  ]);
}

async function stopTestDatabase() {
  await disconnectDatabase();
  if (mongoServer) await mongoServer.stop();
}

module.exports = { startTestDatabase, clearTestDatabase, stopTestDatabase };
