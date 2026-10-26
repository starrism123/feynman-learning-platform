const express = require("express");
const { auth } = require("../middleware/auth");
const {
  evaluateFeynman,
  generateQuestion,
  gradeAnswer,
} = require("../controllers/aiController");

const router = express.Router();

router.use(auth);
router.post("/evaluate", evaluateFeynman);
router.post("/generate-question", generateQuestion);
router.post("/grade-answer", gradeAnswer);

module.exports = { aiRoutes: router };
