const { AppError } = require("../utils/appError");
const { sendSuccess } = require("../utils/response");
const speechService = require("../services/speechService");

// 第 7 课：接收前端上传的录音（multer 已放到 req.file），交给语音识别服务转成文字
async function transcribeAudio(req, res) {
  if (!req.file) {
    throw new AppError(400, "AUDIO_REQUIRED", "没有收到录音文件");
  }
  const text = await speechService.transcribe(req.file.buffer, {
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
  });
  // 讲义约定的返回字段是 result
  return sendSuccess(res, 200, { result: text });
}

module.exports = { transcribeAudio };
