const express = require("express");
const { auth } = require("../middleware/auth");
const {
  getStatus,
  reindex,
  searchChunks,
} = require("../controllers/ragController");

const router = express.Router();

router.use(auth);
router.get("/status", getStatus);
router.post("/reindex", reindex);
router.post("/search", searchChunks);

module.exports = { ragRoutes: router };
