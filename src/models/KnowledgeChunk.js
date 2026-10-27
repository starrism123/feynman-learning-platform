const mongoose = require("mongoose");

// 第 10 课：知识点切成的文本块和它的向量。一个知识点对应多个块，
// 知识点更新时整组替换、删除时整组删除，所以向量库里不会留下过期内容。
const knowledgeChunkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    knowledgePoint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgePoint",
      required: true,
      index: true,
    },
    index: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    model: { type: String, required: true },
  },
  { timestamps: true },
);

knowledgeChunkSchema.index({ knowledgePoint: 1, index: 1 });

module.exports = mongoose.model("KnowledgeChunk", knowledgeChunkSchema);
