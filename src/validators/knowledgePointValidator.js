const { AppError } = require("../utils/appError");

const STATUSES = ["not_started", "in_progress", "mastered"];
const ALLOWED_FIELDS = ["title", "content", "status", "reviewList"];

function normalizeKnowledgePoint(body = {}, { partial = false } = {}) {
  const result = {};
  const details = [];

  if (!partial || Object.hasOwn(body, "title")) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 120)
      details.push("title 必填且不能超过 120 个字符");
    else result.title = title;
  }

  if (!partial || Object.hasOwn(body, "content")) {
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content || content.length > 20000) {
      details.push("content 必填且不能超过 20000 个字符");
    } else result.content = content;
  }

  if (Object.hasOwn(body, "status")) {
    if (!STATUSES.includes(body.status))
      details.push(`status 只能是 ${STATUSES.join("、")}`);
    else result.status = body.status;
  }

  if (Object.hasOwn(body, "reviewList")) {
    if (typeof body.reviewList !== "boolean")
      details.push("reviewList 必须是布尔值");
    else result.reviewList = body.reviewList;
  }

  const unknownFields = Object.keys(body).filter(
    (field) => !ALLOWED_FIELDS.includes(field),
  );
  if (unknownFields.length)
    details.push(`不支持的字段：${unknownFields.join("、")}`);
  if (partial && Object.keys(result).length === 0 && details.length === 0) {
    details.push("至少提供一个可更新字段");
  }

  if (details.length) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "知识点参数不符合要求",
      details,
    );
  }

  return result;
}

module.exports = { STATUSES, normalizeKnowledgePoint };
