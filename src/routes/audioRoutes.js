const express = require("express");
const multer = require("multer");
const { auth } = require("../middleware/auth");
const { transcribeAudio } = require("../controllers/audioController");

const router = express.Router();

// 内存存储：录音只是中转给语音识别服务，不需要落盘；限制 25MB 防止超大文件
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// 'audio' 必须和前端 FormData.append 的字段名一致
router.post("/transcribe", auth, upload.single("audio"), transcribeAudio);

module.exports = { audioRoutes: router };
