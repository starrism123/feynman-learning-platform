const express = require("express");
const {
  createKnowledgePoint,
  listKnowledgePoints,
  getKnowledgePoint,
  updateKnowledgePoint,
  deleteKnowledgePoint,
} = require("../controllers/knowledgePointController");
const { listAttempts } = require("../controllers/feynmanAttemptController");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.use(auth);
router.route("/").post(createKnowledgePoint).get(listKnowledgePoints);
router
  .route("/:id")
  .get(getKnowledgePoint)
  .patch(updateKnowledgePoint)
  .put(updateKnowledgePoint)
  .delete(deleteKnowledgePoint);
router.get("/:id/attempts", listAttempts);

module.exports = { knowledgePointRoutes: router };
