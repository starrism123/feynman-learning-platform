const express = require("express");
const { auth } = require("../middleware/auth");
const { getKnowledgeMap } = require("../controllers/graphController");

const router = express.Router();

router.use(auth);
router.get("/knowledge-map", getKnowledgeMap);

module.exports = { graphRoutes: router };
