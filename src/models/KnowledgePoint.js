const mongoose = require("mongoose");

const knowledgePointSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, trim: true, maxlength: 20000 },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "mastered"],
      default: "not_started",
    },
    reviewList: { type: Boolean, default: false },
  },
  { timestamps: true },
);

knowledgePointSchema.index({ user: 1, createdAt: -1 });

knowledgePointSchema.set("toJSON", {
  transform(doc, result) {
    delete result.__v;
    return result;
  },
});

module.exports = mongoose.model("KnowledgePoint", knowledgePointSchema);
