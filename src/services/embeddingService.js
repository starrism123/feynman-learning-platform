const axios = require("axios");
const { AppError } = require("../utils/appError");

// 第 10 课：把文本转成向量。调用本机 AI 服务（whisper-service/app.py 的 /embed，
// 模型 bge-base-zh-v1.5），和语音识别是同一个服务，不需要密钥、不按次数收费。
// type 为 query 时服务会给问题加检索前缀，文档不加；返回的向量已归一化成长度 1。
const BATCH_SIZE = 32;

async function embed(texts, { type = "document" } = {}) {
  const embeddings = [];
  let model;
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    try {
      const response = await axios.post(
        `${process.env.WHISPER_URL || "http://127.0.0.1:5001"}/embed`,
        { texts: texts.slice(start, start + BATCH_SIZE), type },
        { timeout: 120000 },
      );
      embeddings.push(...response.data.embeddings);
      model = response.data.model;
    } catch (error) {
      if (!error.response) {
        throw new AppError(
          503,
          "EMBEDDING_SERVICE_UNAVAILABLE",
          "向量化服务未启动，请先运行 whisper-service",
        );
      }
      throw new AppError(
        502,
        "EMBEDDING_SERVICE_ERROR",
        error.response.data?.error || "文本向量化失败",
      );
    }
  }
  return { embeddings, model };
}

module.exports = { embed };
