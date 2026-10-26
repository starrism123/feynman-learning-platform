const mongoose = require("mongoose");

// 第 7 课作业：保存每一次费曼复述；第 8 课再把 AI 润色和评价一起存进来
const feynmanAttemptSchema = new mongoose.Schema(
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
    transcribedText: { type: String, required: true, maxlength: 20000 },
    polishedText: { type: String, maxlength: 20000 },
    score: { type: Number, min: 0, max: 100 },
    evaluation: {
      type: mongoose.Schema.Types.Mixed,
    },
    provider: { type: String },
  },
  { timestamps: true },
);

feynmanAttemptSchema.set("toJSON", {
  transform(doc, result) {
    delete result.__v;
    return result;
  },
});

module.exports = mongoose.model("FeynmanAttempt", feynmanAttemptSchema);
