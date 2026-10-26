"""第 7.5 课：用 Flask 把本地 Whisper 模型包装成 HTTP 接口，供 Node 后端调用。"""

import os
import tempfile

import whisper
from flask import Flask, jsonify, request

MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
MODEL_DIR = os.getenv("WHISPER_MODEL_DIR", r"F:\AI-models\whisper")
PORT = int(os.getenv("WHISPER_PORT", "5001"))

app = Flask(__name__)

# 加载模型很慢，只在启动时执行一次
print(f"正在加载 Whisper 模型 {MODEL_NAME} ...")
model = whisper.load_model(MODEL_NAME, download_root=MODEL_DIR)
print("模型加载完毕！")


@app.get("/health")
def health():
    return jsonify({"status": "ok", "model": MODEL_NAME})


@app.post("/transcribe")
def transcribe_audio():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    suffix = os.path.splitext(audio_file.filename or "")[1] or ".webm"
    # Whisper 依赖 ffmpeg 读文件，所以先存成临时文件；浏览器录的 webm 可以直接识别
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    audio_file.save(temp_path)

    try:
        # initial_prompt 让模型倾向输出简体中文
        result = model.transcribe(
            temp_path, language="zh", initial_prompt="以下是普通话的句子。", fp16=False
        )
        text = result["text"].strip()
        print("转录结果:", text)
        return jsonify({"result": text})
    except Exception as error:  # noqa: BLE001 - 把模型错误原样返回给 Node 端
        return jsonify({"error": str(error)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=PORT)
