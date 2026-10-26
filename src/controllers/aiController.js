const { AppError } = require("../utils/appError");
const { sendSuccess } = require("../utils/response");
const llmService = require("../services/llmService");
const {
  feynmanEvaluationPrompt,
  questionPrompt,
  gradePrompt,
} = require("../services/prompts");
const FeynmanAttempt = require("../models/FeynmanAttempt");
const { findOwnedKnowledgePoint } = require("./knowledgePointController");

// 评分低于这个分数，知识点自动加入复习列表（第 8 课挑战）
const REVIEW_THRESHOLD = 60;
const DIFFICULTIES = ["基础", "中等", "困难"];
const QUESTION_TYPES = ["single-choice", "short-answer"];

function requireText(value, field, max = 20000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} 不能为空`);
  }
  if (value.length > max) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} 不能超过 ${max} 字`);
  }
  return value.trim();
}

function clampScore(value) {
  const score = Math.round(Number(value));
  return Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
}

// 第 8 课：AI 润色 + 评价打分，并把这次复述存档
async function evaluateFeynman(req, res) {
  const transcribedText = requireText(req.body.transcribedText, "复述内容");
  const knowledgePoint = await findOwnedKnowledgePoint(
    req.body.knowledgePointId,
    req.user.id,
  );

  const { data, provider, model, latencyMs } = await llmService.chatJson(
    feynmanEvaluationPrompt({
      title: knowledgePoint.title,
      originalContent: knowledgePoint.content,
      transcribedText,
    }),
  );

  const feedback = {
    polishedText: String(data.polishedText || ""),
    dimensions: data.dimensions || {},
    score: clampScore(data.score),
    evaluation: String(data.evaluation || ""),
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
  };

  // 分数低于阈值：自动加入复习列表；分数高：标记为学习中或已掌握
  knowledgePoint.reviewList = feedback.score < REVIEW_THRESHOLD;
  if (feedback.score >= 85) knowledgePoint.status = "mastered";
  else if (knowledgePoint.status === "not_started")
    knowledgePoint.status = "in_progress";
  await knowledgePoint.save();

  const attempt = await FeynmanAttempt.create({
    user: req.user.id,
    knowledgePoint: knowledgePoint._id,
    transcribedText,
    polishedText: feedback.polishedText,
    score: feedback.score,
    evaluation: feedback,
    provider,
  });

  return sendSuccess(res, 200, {
    ...feedback,
    provider,
    model,
    latencyMs,
    attemptId: attempt._id,
    reviewList: knowledgePoint.reviewList,
    status: knowledgePoint.status,
  });
}

// 第 9 课：根据知识点内容和难度出题，支持单选题和简答题
async function generateQuestion(req, res) {
  const { difficulty = "基础", type = "single-choice" } = req.body;
  if (!DIFFICULTIES.includes(difficulty)) {
    throw new AppError(400, "VALIDATION_ERROR", "难度只能是基础、中等或困难");
  }
  if (!QUESTION_TYPES.includes(type)) {
    throw new AppError(400, "VALIDATION_ERROR", "题型不支持");
  }

  // 优先按知识点 ID 取内容（只能是自己的知识点），也兼容讲义直接传内容的写法
  let content;
  if (req.body.knowledgePointId) {
    const knowledgePoint = await findOwnedKnowledgePoint(
      req.body.knowledgePointId,
      req.user.id,
    );
    content = knowledgePoint.content;
  } else {
    content = requireText(req.body.knowledgePointContent, "知识点内容");
  }

  const { data, provider } = await llmService.chatJson(
    questionPrompt({ content, difficulty, type }),
    { temperature: 0.7 },
  );

  const valid =
    type === "single-choice"
      ? data.question &&
        data.options &&
        ["A", "B", "C", "D"].every((key) => data.options[key]) &&
        ["A", "B", "C", "D"].includes(data.answer)
      : data.question && Array.isArray(data.answer_key_points);
  if (!valid) {
    throw new AppError(
      502,
      "INVALID_AI_RESPONSE",
      "AI 返回的题目格式不完整，请重试",
    );
  }

  return sendSuccess(res, 200, { ...data, type, difficulty, provider });
}

// 第 9 课挑战：简答题交给 AI 阅卷
async function gradeAnswer(req, res) {
  const question = requireText(req.body.question, "题目", 2000);
  const studentAnswer = requireText(req.body.studentAnswer, "回答", 5000);
  const { answerKeyPoints } = req.body;
  if (!Array.isArray(answerKeyPoints) || answerKeyPoints.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "缺少答案要点");
  }

  const { data, provider } = await llmService.chatJson(
    gradePrompt({ question, answerKeyPoints, studentAnswer }),
  );

  return sendSuccess(res, 200, {
    isCorrect: Boolean(data.isCorrect),
    score: clampScore(data.score),
    explanation: String(data.explanation || ""),
    provider,
  });
}

module.exports = {
  evaluateFeynman,
  generateQuestion,
  gradeAnswer,
  REVIEW_THRESHOLD,
};
