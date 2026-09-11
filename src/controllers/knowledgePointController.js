const mongoose = require("mongoose");
const KnowledgePoint = require("../models/KnowledgePoint");
const { AppError } = require("../utils/appError");
const { sendSuccess } = require("../utils/response");
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
  Object.assign(knowledgePoint, updates);
  await knowledgePoint.save();
  return sendSuccess(res, 200, { knowledgePoint }, "知识点更新成功");
}

async function deleteKnowledgePoint(req, res) {
  const knowledgePoint = await findOwnedKnowledgePoint(
    req.params.id,
    req.user.id,
  );
  await knowledgePoint.deleteOne();
  return sendSuccess(res, 200, { id: req.params.id }, "知识点删除成功");
}

module.exports = {
  createKnowledgePoint,
  listKnowledgePoints,
  getKnowledgePoint,
  updateKnowledgePoint,
  deleteKnowledgePoint,
};
