const mongoose = require("mongoose");
const { AppError } = require("../utils/appError");
const { sendSuccess } = require("../utils/response");
const KnowledgePoint = require("../models/KnowledgePoint");
const KnowledgeChunk = require("../models/KnowledgeChunk");
const vectorStoreService = require("../services/vectorStoreService");
const embeddingService = require("../services/embeddingService");
const llmService = require("../services/llmService");
const ragService = require("../services/ragService");

// 第 10 课：查看和维护当前用户的向量库

// 每个知识点切成了几块、什么时候建的索引；chunks 为 0 说明还没进向量库，
// upToDate 为 false 说明块是旧内容或别的模型算的（例如改了知识点但当时向量化服务没开）
async function getStatus(req, res) {
  const [knowledgePoints, counts, service] = await Promise.all([
    KnowledgePoint.find({ user: req.user.id }, "title content").sort({
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
          models: { $addToSet: "$model" },
          hashes: { $addToSet: "$contentHash" },
        },
      },
    ]),
    embeddingService.health(),
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c]));
  const items = knowledgePoints.map((kp) => {
    const count = byId.get(String(kp._id));
    const model = count?.models.length === 1 ? count.models[0] : null;
    return {
      id: kp._id,
      title: kp.title,
      chunks: count?.chunks ?? 0,
      indexedAt: count?.indexedAt ?? null,
      model,
      upToDate:
        Boolean(count) &&
        count.hashes.length === 1 &&
        count.hashes[0] === vectorStoreService.contentHash(kp) &&
        model !== null &&
        (!service.model || model === service.model),
    };
  });
  return sendSuccess(res, 200, {
    knowledgePoints: items,
    totalChunks: items.reduce((sum, item) => sum + item.chunks, 0),
    missing: items.filter((item) => item.chunks === 0).length,
    outdated: items.filter((item) => item.chunks > 0 && !item.upToDate).length,
    service,
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
  // 顺手清掉知识点已经不存在的块（例如删除时数据库出错留下的）
  await KnowledgeChunk.deleteMany({
    user: req.user.id,
    knowledgePoint: { $nin: knowledgePoints.map((kp) => kp._id) },
  });
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

function readQuestion(req) {
  const question =
    typeof req.body?.question === "string" ? req.body.question.trim() : "";
  if (!question || question.length > 500) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "question 必填且不能超过 500 字",
    );
  }
  return question;
}

// 第 11 课：知识库问答，一次性返回完整回答和引用来源
async function answerWithRAG(req, res) {
  const question = readQuestion(req);
  const sources = await ragService.retrieve(req.user.id, question);
  // 没有相关笔记就不调用大模型：省一次调用，也不给模型编造的机会
  if (!sources.length) {
    return sendSuccess(res, 200, {
      answer: ragService.NO_CONTEXT_ANSWER,
      sources,
      provider: null,
      model: null,
    });
  }
  const { text, provider, model, latencyMs } = await llmService.chatText(
    ragService.buildMessages(question, sources),
  );
  return sendSuccess(res, 200, {
    answer: text.trim(),
    sources,
    provider,
    model,
    latencyMs,
  });
}

// 第 11 课挑战：流式输出。用 SSE（Server-Sent Events）格式一段段推给浏览器：
// 先推 sources（引用来源），再推若干个 token（回答片段），最后 done 或 error
async function streamAnswerWithRAG(req, res) {
  const question = readQuestion(req);
  // 检索在发响应头之前做：向量化服务没开等错误，照常走统一的 JSON 错误格式
  const sources = await ragService.retrieve(req.user.id, question);

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  const send = (event, data) =>
    res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
  send("sources", { sources });

  if (!sources.length) {
    send("token", { text: ragService.NO_CONTEXT_ANSWER });
    send("done", { provider: null, model: null });
    return res.end();
  }

  // 用户关掉页面或点了停止，就中止对大模型的请求，不再白白生成
  const controller = new AbortController();
  res.on("close", () => controller.abort());
  try {
    const { provider, model, latencyMs } = await llmService.chatStream(
      ragService.buildMessages(question, sources),
      {
        signal: controller.signal,
        onToken: (text) => send("token", { text }),
      },
    );
    send("done", { provider, model, latencyMs });
  } catch (error) {
    if (!controller.signal.aborted) {
      // 响应头已经发出，不能再改状态码，只能用一个 error 事件告诉前端
      send("error", {
        code: error instanceof AppError ? error.code : "LLM_STREAM_ERROR",
        message:
          error instanceof AppError ? error.message : "回答生成中断，请重试",
      });
    }
  }
  return res.end();
}

module.exports = {
  getStatus,
  reindex,
  searchChunks,
  answerWithRAG,
  streamAnswerWithRAG,
};
