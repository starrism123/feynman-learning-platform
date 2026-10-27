// 录屏用的浏览器和小工具：本机 Chrome、假麦克风、可见的鼠标指针、按帧录制成 mp4。
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { chromium } from "playwright-core";

const run = promisify(execFile);

// 无头浏览器截图里看不到鼠标，这里画一个指针，点击时加一圈波纹
const CURSOR_SCRIPT = `
(() => {
  const install = () => {
    if (document.getElementById('__cursor')) return;
    const style = document.createElement('style');
    style.textContent = \`
      #__cursor { position: fixed; left: 0; top: 0; width: 26px; height: 26px; z-index: 2147483647;
        pointer-events: none; transform: translate(-3px, -2px);
        background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'><path d='M3 2 L3 21 L8.5 16 L12 24 L15.5 22.5 L12 15 L19.5 15 Z' fill='black' stroke='white' stroke-width='1.6' stroke-linejoin='round'/></svg>") no-repeat; }
      .__ripple { position: fixed; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
        border: 3px solid rgba(47, 111, 237, 0.85); pointer-events: none; z-index: 2147483646;
        animation: __ripple 0.6s ease-out forwards; }
      @keyframes __ripple { from { transform: scale(0.3); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
    \`;
    document.head.appendChild(style);
    const cursor = document.createElement('div');
    cursor.id = '__cursor';
    const last = window.__cursorPos || { x: -50, y: -50 };
    cursor.style.left = last.x + 'px';
    cursor.style.top = last.y + 'px';
    document.body.appendChild(cursor);
  };
  document.addEventListener('mousemove', (e) => {
    window.__cursorPos = { x: e.clientX, y: e.clientY };
    const c = document.getElementById('__cursor');
    if (c) { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }
  }, true);
  document.addEventListener('mousedown', (e) => {
    const r = document.createElement('div');
    r.className = '__ripple';
    r.style.left = e.clientX + 'px';
    r.style.top = e.clientY + 'px';
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 700);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
`;

export async function openBrowser({ fakeMic } = {}) {
  const args = [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ];
  if (fakeMic) args.push(`--use-file-for-fake-audio-capture=${fakeMic}%noloop`);
  const browser = await chromium.launch({ channel: "chrome", args });
  // 1280×720 的布局按 1.5 倍渲染，正好是 1920×1080，字更清楚
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
  });
  await context.addInitScript(CURSOR_SCRIPT);
  const page = await context.newPage();
  return { browser, context, page };
}

// 鼠标平滑移到元素中间
export async function moveTo(page, locator, steps = 24) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("元素不可见，无法移动鼠标");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps,
  });
  await page.waitForTimeout(250);
}

export async function click(page, locator) {
  await moveTo(page, locator);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
  await page.waitForTimeout(350);
}

export async function type(page, locator, text, delay = 55) {
  await click(page, locator);
  await page.keyboard.type(text, { delay });
}

export async function smoothScroll(page, top, wait = 1200) {
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: "smooth" }),
    top,
  );
  await page.waitForTimeout(wait);
}

// 用 Chrome 的逐帧截屏录下 actions() 期间的画面，合成 30 帧的 mp4。
// 截帧是 JPEG（全范围色彩），要转成视频常用的标准范围，否则和其他镜头拼接后白色会发灰
export async function recordClip(page, outFile, actions) {
  const framesDir = `${outFile}.frames`;
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: 1920,
    maxHeight: 1080,
  });
  // 先停一下，保证开头有画面
  await page.waitForTimeout(400);
  await actions();
  await page.waitForTimeout(500);
  const endedAt = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  await cdp.detach();
  if (frames.length === 0) throw new Error(`${outFile} 没有录到任何画面`);

  const lines = [];
  for (let i = 0; i < frames.length; i += 1) {
    const name = `f${String(i).padStart(5, "0")}.jpg`;
    await writeFile(
      path.join(framesDir, name),
      Buffer.from(frames[i].data, "base64"),
    );
    const next = i + 1 < frames.length ? frames[i + 1].t : endedAt;
    lines.push(
      `file '${name}'`,
      `duration ${Math.max(0.001, next - frames[i].t).toFixed(3)}`,
    );
  }
  // concat 格式要求最后一帧再写一次
  lines.push(`file 'f${String(frames.length - 1).padStart(5, "0")}.jpg'`);
  await writeFile(path.join(framesDir, "list.txt"), lines.join("\n"));
  await run(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "list.txt",
      "-vf",
      "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,fps=30,scale=out_range=tv,format=yuv420p",
      "-c:v",
      "libx264",
      "-crf",
      "18",
      "-preset",
      "fast",
      path.resolve(outFile),
    ],
    { cwd: framesDir },
  );
  await rm(framesDir, { recursive: true, force: true });
  return { file: outFile, seconds: endedAt - frames[0].t };
}
