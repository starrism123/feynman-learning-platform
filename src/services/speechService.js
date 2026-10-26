const axios = require("axios");
const { AppError } = require("../utils/appError");

// 第 7.5 课：把音频转发给本地 Whisper 服务（whisper-service/app.py），代替百度语音识别
async function transcribe(buffer, { filename = "audio.webm", mimetype } = {}) {
  const form = new FormData();
  form.append("audio", new Blob([buffer], { type: mimetype }), filename);

  try {
    const response = await axios.post(
      `${process.env.WHISPER_URL || "http://127.0.0.1:5001"}/transcribe`,
      form,
      { timeout: 120000 },
    );
    return response.data.result;
  } catch (error) {
    if (!error.response) {
      throw new AppError(
        503,
        "SPEECH_SERVICE_UNAVAILABLE",
        "语音识别服务未启动，请先运行 whisper-service",
      );
    }
    throw new AppError(
      502,
      "SPEECH_SERVICE_ERROR",
      error.response.data?.error || "语音识别失败",
    );
  }
}

module.exports = { transcribe };
