"""本机 AI 服务：供 Node 后端调用。

- 第 7.5 课：用 Flask 把本地 Whisper 模型包装成语音识别接口 /transcribe。
- 第 10 课：加上文本向量化接口 /embed（bge-base-zh-v1.5），给 RAG 知识库用。
"""

import os
import tempfile

import torch
import whisper
from flask import Flask, jsonify, request
from transformers import AutoModel, AutoTokenizer

MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
MODEL_DIR = os.getenv("WHISPER_MODEL_DIR", r"F:\AI-models\whisper")
PORT = int(os.getenv("WHISPER_PORT", "5001"))
EMBEDDING_MODEL_DIR = os.getenv(
    "EMBEDDING_MODEL_DIR", r"F:\AI-models\embedding\bge-base-zh-v1.5"
)
EMBEDDING_MODEL = os.path.basename(os.path.normpath(EMBEDDING_MODEL_DIR))
# bge 中文模型的约定：检索时给「问题」加这句前缀，「文档」不加，召回更准
QUERY_INSTRUCTION = "为这个句子生成表示以用于检索相关文章："
MAX_TEXTS = 64

app = Flask(__name__)

# 加载模型很慢，只在启动时执行一次
print(f"正在加载 Whisper 模型 {MODEL_NAME} ...")
model = whisper.load_model(MODEL_NAME, download_root=MODEL_DIR)
print("模型加载完毕！")

print(f"正在加载向量模型 {EMBEDDING_MODEL} ...")
embed_tokenizer = AutoTokenizer.from_pretrained(EMBEDDING_MODEL_DIR)
embed_model = AutoModel.from_pretrained(EMBEDDING_MODEL_DIR).eval()
print("向量模型加载完毕！")


@app.get("/health")
def health():
    return jsonify(
        {"status": "ok", "model": MODEL_NAME, "embeddingModel": EMBEDDING_MODEL}
    )


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


@app.post("/embed")
def embed_texts():
    body = request.get_json(silent=True) or {}
    texts = body.get("texts")
    kind = body.get("type", "document")
    if (
        not isinstance(texts, list)
        or not texts
        or len(texts) > MAX_TEXTS
        or not all(isinstance(t, str) and t.strip() for t in texts)
    ):
        return jsonify({"error": f"texts 必须是 1–{MAX_TEXTS} 个非空字符串"}), 400
    if kind not in ("query", "document"):
        return jsonify({"error": "type 只能是 query 或 document"}), 400

    if kind == "query":
        texts = [QUERY_INSTRUCTION + t for t in texts]
    with torch.no_grad():
        inputs = embed_tokenizer(
            texts, padding=True, truncation=True, max_length=512, return_tensors="pt"
        )
        # bge 取 [CLS] 位置的向量，再归一化成长度 1，这样两个向量的点积就是余弦相似度
        vectors = embed_model(**inputs).last_hidden_state[:, 0]
        vectors = torch.nn.functional.normalize(vectors, dim=-1)
    return jsonify(
        {
            "model": EMBEDDING_MODEL,
            "dimensions": vectors.shape[1],
            "embeddings": vectors.tolist(),
        }
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=PORT)
