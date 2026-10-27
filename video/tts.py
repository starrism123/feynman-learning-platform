"""用 edge-tts 给每个自然段配音，同时记录每句话的起止时间（用来做字幕）。

用法：.venv/Scripts/python tts.py <段落清单.json> <输出目录>
段落清单是 [{"id": "s0p0", "text": "..."}]；文字没变的段落会跳过，不重复请求。
"""

import asyncio
import hashlib
import json
import sys
from pathlib import Path

import edge_tts

VOICE = "zh-CN-YunyangNeural"


async def synthesize(item, out_dir: Path):
    digest = hashlib.sha1(item["text"].encode("utf-8")).hexdigest()
    mp3 = out_dir / f"{item['id']}.mp3"
    info = out_dir / f"{item['id']}.json"
    if mp3.exists() and info.exists():
        if json.loads(info.read_text(encoding="utf-8")).get("hash") == digest:
            return "跳过"

    sentences = []
    with mp3.open("wb") as audio:
        communicate = edge_tts.Communicate(item["text"], VOICE, boundary="SentenceBoundary")
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio.write(chunk["data"])
            elif chunk["type"] == "SentenceBoundary":
                # offset 和 duration 的单位是 100 纳秒
                sentences.append(
                    {
                        "start": chunk["offset"] / 1e7,
                        "end": (chunk["offset"] + chunk["duration"]) / 1e7,
                        "text": chunk["text"],
                    }
                )
    info.write_text(
        json.dumps({"hash": digest, "text": item["text"], "sentences": sentences}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return "完成"


async def main():
    items = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    for item in items:
        for attempt in range(3):
            try:
                print(item["id"], await synthesize(item, out_dir), flush=True)
                break
            except Exception as error:  # noqa: BLE001 - 网络抖动重试
                print(item["id"], "失败，重试：", error, flush=True)
                await asyncio.sleep(2)
        else:
            sys.exit(f"{item['id']} 配音失败")


asyncio.run(main())
