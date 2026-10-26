const { sendSuccess } = require("../utils/response");
const FeynmanAttempt = require("../models/FeynmanAttempt");
const { findOwnedKnowledgePoint } = require("./knowledgePointController");

// 查看某个知识点的历次复述记录，用来对比自己的进步
async function listAttempts(req, res) {
  const knowledgePoint = await findOwnedKnowledgePoint(
    req.params.id,
    req.user.id,
  );
  const attempts = await FeynmanAttempt.find({
    user: req.user.id,
    knowledgePoint: knowledgePoint._id,
  })
    .sort({ createdAt: -1 })
    .limit(20);
  return sendSuccess(res, 200, { attempts, count: attempts.length });
}

module.exports = { listAttempts };
