// 按分镜表把配音、录屏、静态画面合成成片，并烧录字幕。
// 前提：已运行 record-shots.mjs、make-stills.mjs、tts.py。输出 output/期中演示-费曼学习平台.mp4 和同名 .srt。
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { plan } from "./plan.mjs";
import { loadScript, paragraphId } from "./lib/script.mjs";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const out = (...p) => path.join(here, "output", ...p);
const FPS = 30;
const PARA_GAP = 0.35; // 同一镜头里两个自然段之间
const SHOT_TAIL = 0.45; // 每个镜头结束前留白
const CARD_SECONDS = 1.6; // 章节卡
const DEFAULT_MAX_SPEED = 1.6;
const FINAL = "期中演示-费曼学习平台";

const ffmpeg = (args, cwd) =>
  run("ffmpeg", ["-y", "-loglevel", "error", ...args], {
    cwd,
    maxBuffer: 1 << 24,
  });
async function duration(file) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  return Number(stdout.trim());
}
const toFrames = (t) => Math.round(t * FPS) / FPS;

// ---------- 检查分镜表覆盖了讲稿的每个自然段 ----------
const sections = await loadScript(path.join(here, "讲稿.md"));
for (const s of sections) {
  const covered =
    plan
      .find((p) => p.section === s.index)
      ?.shots.flatMap((shot) => shot.paras) ?? [];
  const expected = s.paragraphs.map((_, i) => i);
  if (covered.join() !== expected.join()) {
    throw new Error(
      `第 ${s.index} 段：分镜表的自然段 ${covered.join(",")} 和讲稿 ${expected.join(",")} 对不上`,
    );
  }
}

// ---------- 逐个镜头出片 ----------
const shotsDir = out("shots");
await rm(shotsDir, { recursive: true, force: true });
await mkdir(shotsDir, { recursive: true });

const shots = [];
for (const { section, shots: list } of plan) {
  if (section > 0)
    shots.push({
      still: `section-${section}`,
      silent: CARD_SECONDS,
      paras: [],
      section,
    });
  for (const shot of list) shots.push({ ...shot, section });
}

const cues = [];
let timeline = 0;
const concatList = [];

for (const [index, shot] of shots.entries()) {
  const name = `${String(index).padStart(3, "0")}.mp4`;
  // 1. 音频：各自然段 + 段间停顿 + 可选原声
  const audioInputs = [];
  const audioParts = [];
  let audioLength = 0;
  for (const [k, para] of shot.paras.entries()) {
    const id = paragraphId(shot.section, para);
    const mp3 = out("tts", `${id}.mp3`);
    const info = JSON.parse(await readFile(out("tts", `${id}.json`), "utf8"));
    if (k > 0) {
      audioParts.push({ silence: PARA_GAP });
      audioLength += PARA_GAP;
    }
    for (const sentence of info.sentences) {
      cues.push({
        start: timeline + audioLength + sentence.start,
        end: timeline + audioLength + sentence.end,
        text: sentence.text,
      });
    }
    audioInputs.push(["-i", mp3]);
    audioParts.push({ input: audioInputs.length - 1 });
    audioLength += await duration(mp3);
  }
  if (shot.tailAudio) {
    const { file, start, duration: d, caption } = shot.tailAudio;
    audioParts.push({ silence: PARA_GAP });
    audioLength += PARA_GAP;
    if (caption)
      cues.push({
        start: timeline + audioLength,
        end: timeline + audioLength + d,
        text: caption,
        raw: true,
      });
    audioInputs.push([
      "-ss",
      String(start),
      "-t",
      String(d),
      "-i",
      path.join(here, file),
    ]);
    audioParts.push({ input: audioInputs.length - 1 });
    audioLength += d;
  }
  let target = shot.silent ?? audioLength + SHOT_TAIL;

  // 2. 画面
  let videoInput;
  let videoFilter;
  if (shot.clip && shot.fit !== "tail") {
    const clip = out("clips", `${shot.clip}.mp4`);
    const clipLength = await duration(clip);
    const maxSpeed = shot.maxSpeed ?? DEFAULT_MAX_SPEED;
    let speed = clipLength / target;
    if (speed > maxSpeed) {
      speed = maxSpeed;
      target = clipLength / maxSpeed;
    }
    speed = Math.max(1, speed);
    target = toFrames(target);
    videoInput = ["-i", clip];
    videoFilter = `setpts=PTS/${speed.toFixed(4)},tpad=stop_mode=clone:stop_duration=${(target + 1).toFixed(2)},trim=duration=${target},setpts=PTS-STARTPTS,fps=${FPS},scale=out_range=tv,format=yuv420p`;
  } else {
    let image;
    if (shot.clip) {
      // 只用录屏的最后一帧
      image = out("shots", `${shot.clip}-last.png`);
      if (!existsSync(image))
        await ffmpeg([
          "-sseof",
          "-0.2",
          "-i",
          out("clips", `${shot.clip}.mp4`),
          "-frames:v",
          "1",
          "-update",
          "1",
          image,
        ]);
    } else {
      image = out("stills", `${shot.still ?? shot.diagram}.png`);
    }
    target = toFrames(target);
    videoInput = [
      "-loop",
      "1",
      "-framerate",
      String(FPS),
      "-t",
      String(target),
      "-i",
      image,
    ];
    videoFilter = shot.diagram
      ? // 架构图缩放到留出字幕位置，居中略偏上
        `scale=1880:880:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(1080-ih)/2-60:color=white,setsar=1,fps=${FPS},scale=out_range=tv,format=yuv420p`
      : `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,fps=${FPS},scale=out_range=tv,format=yuv420p`;
  }

  // 3. 合成这个镜头
  const args = [...videoInput, ...audioInputs.flat()];
  const filters = [`[0:v]${videoFilter}[v]`];
  const labels = [];
  let silenceIndex = 0;
  for (const part of audioParts) {
    if (part.silence) {
      const label = `s${silenceIndex++}`;
      filters.push(`aevalsrc=0:c=stereo:s=48000:d=${part.silence}[${label}]`);
      labels.push(`[${label}]`);
    } else {
      const label = `a${part.input}`;
      filters.push(
        `[${part.input + 1}:a]aresample=48000,aformat=channel_layouts=stereo[${label}]`,
      );
      labels.push(`[${label}]`);
    }
  }
  if (labels.length === 0)
    filters.push(`aevalsrc=0:c=stereo:s=48000:d=${target}[aout]`);
  else
    filters.push(
      `${labels.join("")}concat=n=${labels.length}:v=0:a=1,apad,atrim=duration=${target}[aout]`,
    );
  await ffmpeg(
    [
      ...args,
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[v]",
      "-map",
      "[aout]",
      "-t",
      String(target),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-r",
      String(FPS),
      "-color_range",
      "tv",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      name,
    ],
    shotsDir,
  );
  concatList.push(`file '${name}'`);
  console.log(
    `${name}  ${String(shot.still ?? shot.diagram ?? shot.clip).padEnd(16)} ${target.toFixed(1)}s`,
  );
  timeline += target;
}

// ---------- 拼接 ----------
await writeFile(path.join(shotsDir, "list.txt"), concatList.join("\n"));
await ffmpeg(
  ["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "../full.mp4"],
  shotsDir,
);

// ---------- 字幕：按标点切成短行，时间按字数分配 ----------
const MAX_CHARS = 22;
function splitSentence({ start, end, text, raw }) {
  if (raw) return [{ start, end, text }];
  const pieces = text.match(/[^，。；：！？、,]+[，。；：！？、,]?/g) ?? [text];
  const lines = [];
  for (const piece of pieces) {
    const last = lines.at(-1);
    if (
      last &&
      (last + piece).replace(/[，。；：、,]$/, "").length <= MAX_CHARS
    )
      lines[lines.length - 1] = last + piece;
    else lines.push(piece);
  }
  const total = lines.reduce((n, l) => n + l.length, 0);
  let t = start;
  return lines.map((line) => {
    const d = ((end - start) * line.length) / total;
    const cue = {
      start: t,
      end: t + d,
      text: line.replace(/[，。；：、,]$/, ""),
    };
    t += d;
    return cue;
  });
}
const lines = cues.flatMap(splitSentence).filter((c) => c.text.trim());
for (let i = 0; i < lines.length - 1; i += 1)
  lines[i].end = Math.min(lines[i].end + 0.15, lines[i + 1].start);

const assTime = (t) => {
  const cs = Math.round(t * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const srtTime = (t) =>
  assTime(t)
    .replace(/^(\d+)/, (h) => h.padStart(2, "0"))
    .replace(".", ",") + "0";
const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,52,&H00FFFFFF,&H00FFFFFF,&H00202020,&H80000000,1,0,0,0,100,100,1,0,1,3.2,1.2,2,80,80,44,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.map((c) => `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,${c.text}`).join("\n")}
`;
await writeFile(out("subs.ass"), ass);
await writeFile(
  out(`${FINAL}.srt`),
  lines
    .map(
      (c, i) =>
        `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`,
    )
    .join("\n"),
);

// ---------- 烧录字幕 ----------
await ffmpeg(
  [
    "-i",
    "full.mp4",
    "-vf",
    "ass=subs.ass",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-color_range",
    "tv",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    `${FINAL}.mp4`,
  ],
  out(),
);
const total = await duration(out(`${FINAL}.mp4`));
console.log(
  `完成：${FINAL}.mp4，${Math.floor(total / 60)} 分 ${Math.round(total % 60)} 秒，字幕 ${lines.length} 条`,
);
