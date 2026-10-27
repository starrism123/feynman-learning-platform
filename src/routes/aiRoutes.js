const express = require("express");
const { auth } = require("../middleware/auth");
const {
  evaluateFeynman,
  generateQuestion,
  gradeAnswer,
} = require("../controllers/aiController");
const {
  answerWithRAG,
  streamAnswerWithRAG,
} = require("../controllers/ragController");

const router = express.Router();

router.use(auth);
router.post("/evaluate", evaluateFeynman);
router.post("/generate-question", generateQuestion);
router.post("/grade-answer", gradeAnswer);
// 第 11 课：知识库问答（普通 / 流式）
router.post("/rag-qa", answerWithRAG);
router.post("/rag-qa/stream", streamAnswerWithRAG);

module.exports = { aiRoutes: router };
