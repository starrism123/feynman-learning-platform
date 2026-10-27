const mongoose = require("mongoose");
const KnowledgePoint = require("../models/KnowledgePoint");
const { AppError } = require("../utils/appError");
const { sendSuccess } = require("../utils/response");
const vectorStoreService = require("../services/vectorStoreService");
const {
  normalizeKnowledgePoint,
} = require("../validators/knowledgePointValidator");

function validateId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw new AppError(400, "INVALID_ID", "知识点 ID 格式不正确");
  }
}

async function findOwnedKnowledgePoint(id, userId) {
  validateId(id);
  const knowledgePoint = await KnowledgePoint.findOne({
    _id: id,
    user: userId,
  });
  if (!knowledgePoint) {
    throw new AppError(404, "KNOWLEDGE_POINT_NOT_FOUND", "知识点不存在");
  }
  return knowledgePoint;
}

async function createKnowledgePoint(req, res) {
  const input = normalizeKnowledgePoint(req.body);
  const knowledgePoint = await KnowledgePoint.create({
    ...input,
    user: req.user.id,
  });
  // 第 10 课：新知识点自动进入向量库，供 AI 助手检索
  vectorStoreService.indexInBackground(knowledgePoint);
  return sendSuccess(res, 201, { knowledgePoint }, "知识点创建成功");
}

async function listKnowledgePoints(req, res) {
  const knowledgePoints = await KnowledgePoint.find({ user: req.user.id }).sort(
    {
      createdAt: -1,
    },
  );
  return sendSuccess(res, 200, {
    knowledgePoints,
    count: knowledgePoints.length,
  });
}

async function getKnowledgePoint(req, res) {
  const knowledgePoint = await findOwnedKnowledgePoint(
    req.params.id,
    req.user.id,
  );
  return sendSuccess(res, 200, { knowledgePoint });
}

async function updateKnowledgePoint(req, res) {
  const knowledgePoint = await findOwnedKnowledgePoint(
    req.params.id,
    req.user.id,
  );
  const updates = normalizeKnowledgePoint(req.body, { partial: true });
  const textChanged = ["title", "content"].some(
    (field) =>
      Object.hasOwn(updates, field) && updates[field] !== knowledgePoint[field],
  );
  Object.assign(knowledgePoint, updates);
  await knowledgePoint.save();
  // 只改状态、复习标记时不用重新向量化
  if (textChanged) vectorStoreService.indexInBackground(knowledgePoint);
  return sendSuccess(res, 200, { knowledgePoint }, "知识点更新成功");
}

async function deleteKnowledgePoint(req, res) {
  const knowledgePoint = await findOwnedKnowledgePoint(
    req.params.id,
    req.user.id,
  );
  await knowledgePoint.deleteOne();
  await vectorStoreService.removeKnowledgePoint(knowledgePoint._id);
  return sendSuccess(res, 200, { id: req.params.id }, "知识点删除成功");
}

module.exports = {
  findOwnedKnowledgePoint,
  createKnowledgePoint,
  listKnowledgePoints,
  getKnowledgePoint,
  updateKnowledgePoint,
  deleteKnowledgePoint,
};
