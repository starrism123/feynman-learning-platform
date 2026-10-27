const mongoose = require("mongoose");
const { AppError } = require("../utils/appError");
const { sendSuccess } = require("../utils/response");
const KnowledgePoint = require("../models/KnowledgePoint");
const KnowledgeChunk = require("../models/KnowledgeChunk");
const vectorStoreService = require("../services/vectorStoreService");

// 第 10 课：查看和维护当前用户的向量库

// 每个知识点切成了几块、什么时候建的索引；chunks 为 0 说明还没进向量库
async function getStatus(req, res) {
  const [knowledgePoints, counts] = await Promise.all([
    KnowledgePoint.find({ user: req.user.id }, "title updatedAt").sort({
      createdAt: -1,
    }),
    KnowledgeChunk.aggregate([
      // aggregate 不会自动把字符串转成 ObjectId，要手动转
      { $match: { user: new mongoose.Types.ObjectId(String(req.user.id)) } },
      {
        $group: {
          _id: "$knowledgePoint",
          chunks: { $sum: 1 },
          indexedAt: { $max: "$updatedAt" },
          model: { $first: "$model" },
        },
      },
    ]),
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c]));
  const items = knowledgePoints.map((kp) => {
    const count = byId.get(String(kp._id));
    return {
      id: kp._id,
      title: kp.title,
      chunks: count?.chunks ?? 0,
      indexedAt: count?.indexedAt ?? null,
      model: count?.model ?? null,
    };
  });
  return sendSuccess(res, 200, {
    knowledgePoints: items,
    totalChunks: items.reduce((sum, item) => sum + item.chunks, 0),
    missing: items.filter((item) => item.chunks === 0).length,
  });
}

// 把当前用户的知识点全部重新向量化：换了向量模型、或者后台向量化失败后用
async function reindex(req, res) {
  const knowledgePoints = await KnowledgePoint.find({ user: req.user.id });
  let chunks = 0;
  for (const kp of knowledgePoints) {
    const result = await vectorStoreService.indexKnowledgePoint(kp);
    chunks += result.chunks;
  }
  return sendSuccess(
    res,
    200,
    { knowledgePoints: knowledgePoints.length, chunks },
    "知识库索引已重建",
  );
}

// 只做检索不调用大模型，用来观察「问题」和哪些片段最相似
async function searchChunks(req, res) {
  const query =
    typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (!query || query.length > 500) {
    throw new AppError(400, "VALIDATION_ERROR", "query 必填且不能超过 500 字");
  }
  const limit = Math.min(10, Math.max(1, Number(req.body.limit) || 4));
  const results = await vectorStoreService.search(req.user.id, query, {
    limit,
  });
  return sendSuccess(res, 200, { query, results });
}

module.exports = { getStatus, reindex, searchChunks };
