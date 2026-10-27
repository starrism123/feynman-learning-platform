// 生成视频里的静态画面：片头、章节卡、片尾、代码页、带高亮的架构图、终端截图、识别错字对比。
// 输出到 output/stills/，都是 1920×1080 的 PNG（架构图除外，由合成脚本居中放到白底上）。
import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import plaintext from "highlight.js/lib/languages/plaintext";
import { chromium } from "playwright-core";
import { prepareDiagramPage, renderDiagram } from "./lib/diagram.mjs";
import { loadScript } from "./lib/script.mjs";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("plaintext", plaintext);

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const outDir = path.join(here, "output", "stills");
const meta = JSON.parse(
  await readFile(path.join(here, "output", "clips", "meta.json"), "utf8"),
);
const hljsCss = await readFile(
  path.join(here, "node_modules", "highlight.js", "styles", "github-dark.css"),
  "utf8",
);
await mkdir(outDir, { recursive: true });

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FONT = `"Microsoft YaHei", "PingFang SC", sans-serif`;
const MONO = `"Cascadia Mono", Consolas, "Microsoft YaHei", monospace`;

// ---------- 从源码里按起止标记截取代码 ----------
async function extract(file, startMark, endTest) {
  const lines = (await readFile(path.join(root, file), "utf8")).split(/\r?\n/);
  const start = lines.findIndex((l) => l.includes(startMark));
  if (start === -1) throw new Error(`${file} 里找不到「${startMark}」`);
  let end = start + 1;
  while (end < lines.length && !endTest(lines[end], end - start)) end += 1;
  return { file, firstLine: start + 1, lines: lines.slice(start, end + 1) };
}
const closesAt = (indent) => (line) =>
  line === `${indent}}` || line === `${indent}};` || line === `${indent});`;

function codePanel({
  file,
  firstLine,
  lines,
  lang = "javascript",
  highlights = [],
}) {
  const head = `<header><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="path">${escapeHtml(file)}</span></header>`;
  // 提示词这类长文字：逐行排版、允许折行，不做语法高亮
  if (lang === "plaintext") {
    const rows = lines
      .map((l, i) => {
        const hl = highlights.some((h) => l.includes(h)) ? " hl" : "";
        return `<div class="row${hl}"><span class="ln">${firstLine + i}</span><span class="tx">${escapeHtml(l)}</span></div>`;
      })
      .join("");
    return `<section class="panel">${head}<div class="body"><div class="rows">${rows}</div></div></section>`;
  }
  const html = hljs.highlight(lines.join("\n"), { language: lang }).value;
  const marks = lines
    .map((l, i) =>
      highlights.some((h) => l.includes(h))
        ? `<div class="mark" style="top: calc(${i} * var(--lh))"></div>`
        : "",
    )
    .join("");
  const gutter = lines.map((_, i) => firstLine + i).join("\n");
  return `<section class="panel">
    ${head}
    <div class="body"><pre class="gutter">${gutter}</pre><div class="code-wrap">${marks}<pre class="hljs">${html}</pre></div></div>
  </section>`;
}

function codeSlide(title, panels) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${hljsCss}
    :root { --fs: 26px; --lh: calc(var(--fs) * 1.5); }
    html, body { margin: 0; width: 1920px; height: 1080px; background: #0b1020; font-family: ${FONT}; color: #e6edf3; }
    .slide { box-sizing: border-box; height: 1080px; padding: 48px 64px 140px; display: flex; flex-direction: column; gap: 28px; }
    h1 { margin: 0; font-size: 44px; font-weight: 700; color: #fff; }
    h1 small { font-size: 26px; font-weight: 400; color: #8b98b8; margin-left: 18px; }
    .panels { flex: 1; min-height: 0; display: flex; gap: 32px; }
    .panel { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #0d1117; border: 1px solid #263045; border-radius: 14px; overflow: hidden; }
    header { display: flex; align-items: center; gap: 9px; padding: 14px 18px; background: #161b26; font-family: ${MONO}; font-size: 20px; color: #8b98b8; }
    .dot { width: 13px; height: 13px; border-radius: 50%; } .r { background: #ff5f57; } .y { background: #febc2e; } .g { background: #28c840; }
    .path { margin-left: 10px; }
    .body { flex: 1; min-height: 0; display: flex; padding: 18px 0; overflow: hidden; }
    pre { margin: 0; font-family: ${MONO}; font-size: var(--fs); line-height: var(--lh); }
    .gutter { padding: 0 18px 0 22px; text-align: right; color: #4d5a73; user-select: none; }
    .code-wrap { position: relative; flex: 1; min-width: 0; }
    .hljs { background: transparent; padding: 0 24px 0 6px; white-space: pre; }
    .mark { position: absolute; left: 0; right: 0; height: var(--lh); background: rgba(250, 204, 21, 0.14); border-left: 4px solid #facc15; }
    .rows { flex: 1; min-width: 0; padding-right: 28px; font-family: ${MONO}; font-size: var(--fs); line-height: 1.5; }
    .row { display: flex; } .row.hl { background: rgba(250, 204, 21, 0.14); box-shadow: inset 4px 0 #facc15; }
    .ln { flex: 0 0 3.2em; padding-right: 18px; text-align: right; color: #4d5a73; }
    .tx { flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-all; color: #d5dde8; }
  </style></head><body><div class="slide"><h1>${title}</h1><div class="panels">${panels.map(codePanel).join("")}</div></div></body></html>`;
}

// ---------- 卡片、终端、对比 ----------
const cardCss = `html, body { margin: 0; width: 1920px; height: 1080px; font-family: ${FONT}; }
  .card { height: 1080px; display: flex; flex-direction: column; justify-content: center; padding: 0 180px; box-sizing: border-box;
    background: radial-gradient(circle at 80% 20%, #3b7bff 0, transparent 45%), linear-gradient(135deg, #1d4ed8, #0b1f5c); color: #fff; }`;

function titleCard() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${cardCss}
    .mark { width: 96px; height: 96px; border-radius: 24px; background: #fff; color: #2f6fed; display: grid; place-items: center; font-size: 56px; font-weight: 800; margin-bottom: 48px; }
    h1 { margin: 0; font-size: 104px; letter-spacing: 6px; } p { margin: 28px 0 0; font-size: 40px; opacity: 0.9; }
    .stack { margin-top: 72px; display: flex; gap: 18px; flex-wrap: wrap; }
    .stack span { padding: 12px 26px; border: 2px solid rgba(255,255,255,0.45); border-radius: 999px; font-size: 28px; }
  </style></head><body><div class="card"><div class="mark">F</div><h1>费曼学习平台</h1><p>《大前端与AI实战》期中项目演示 · 第 1–9 课</p>
  <div class="stack"><span>React 19</span><span>Express 5</span><span>MongoDB</span><span>Whisper</span><span>DeepSeek</span><span>Ollama</span></div></div></body></html>`;
}

function sectionCard(index, title) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${cardCss}
    .no { font-size: 150px; font-weight: 800; opacity: 0.35; line-height: 1; } h1 { margin: 24px 0 0; font-size: 92px; }
  </style></head><body><div class="card"><div class="no">${String(index).padStart(2, "0")}</div><h1>${escapeHtml(title)}</h1></div></body></html>`;
}

function endCard() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${cardCss}
    .card { align-items: center; text-align: center; } h1 { margin: 0; font-size: 110px; letter-spacing: 8px; } p { margin-top: 36px; font-size: 38px; opacity: 0.9; }
  </style></head><body><div class="card"><h1>谢谢观看</h1><p>写下知识点 → 讲出来 → AI 点评 → 测评 → 复习</p></div></body></html>`;
}

function terminal(title, blocks) {
  const body = blocks
    .map(
      ({ cmd, out }) =>
        `<div class="cmd"><span class="ps">PS …\\${escapeHtml(cmd.dir)}&gt;</span> ${escapeHtml(cmd.text)}</div><pre>${out.map((l) => colorize(escapeHtml(l))).join("\n")}</pre>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; width: 1920px; height: 1080px; background: #0b1020; font-family: ${FONT}; }
    .wrap { box-sizing: border-box; height: 1080px; padding: 48px 64px 140px; display: flex; flex-direction: column; gap: 28px; }
    h1 { margin: 0; font-size: 44px; color: #fff; }
    .term { flex: 1; background: #0c0c0c; border: 1px solid #263045; border-radius: 14px; padding: 28px 34px; overflow: hidden; font-family: ${MONO}; font-size: 25px; line-height: 1.5; color: #cccccc; }
    .cmd { color: #fff; margin-top: 10px; } .ps { color: #5fb3ff; } pre { margin: 6px 0 14px; font-family: inherit; white-space: pre-wrap; }
    .ok { color: #3fd07a; font-weight: 700; } .dim { color: #7a8599; } .tag { color: #f0c674; }
  </style></head><body><div class="wrap"><h1>${escapeHtml(title)}</h1><div class="term">${body}</div></div></body></html>`;
}
const colorize = (line) =>
  line
    .replace(/^(PASS)/, '<span class="ok">$1</span>')
    .replace(/(\d+ passed)/g, '<span class="ok">$1</span>')
    .replace(/^(&gt; .*)$/, '<span class="dim">$1</span>')
    .replace(/^(lesson-\d+)$/, '<span class="tag">$1</span>');

function transcriptCompare(raw, polished, wrong) {
  const mark = (text, words, cls) =>
    words.reduce(
      (t, w) => t.split(w).join(`<mark class="${cls}">${w}</mark>`),
      escapeHtml(text),
    );
  const fixed = wrong.map(([, right]) => right);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; width: 1920px; height: 1080px; background: #f6f7f9; font-family: ${FONT}; color: #1f2430; }
    .wrap { box-sizing: border-box; height: 1080px; padding: 60px 110px 150px; display: flex; flex-direction: column; gap: 32px; }
    h1 { margin: 0; font-size: 46px; } .box { background: #fff; border: 1px solid #e3e6eb; border-radius: 16px; padding: 30px 38px; font-size: 32px; line-height: 1.75; }
    .label { font-size: 26px; color: #6b7280; margin-bottom: 8px; } mark { padding: 0 4px; border-radius: 6px; }
    .bad { background: #fde2e2; color: #c62828; text-decoration: underline wavy #c62828; } .good { background: #dcf5e7; color: #157347; font-weight: 700; }
    .pairs { display: flex; gap: 28px; font-size: 34px; } .pairs span { background: #fff; border: 1px solid #e3e6eb; border-radius: 12px; padding: 12px 26px; }
  </style></head><body><div class="wrap"><h1>同音错字：识别结果 → AI 润色</h1>
    <div class="box"><div class="label">Whisper 识别结果</div>${mark(
      raw,
      wrong.map(([w]) => w),
      "bad",
    )}</div>
    <div class="pairs">${wrong.map(([w, r]) => `<span><mark class="bad">${w}</mark> → <mark class="good">${r}</mark></span>`).join("")}</div>
    <div class="box"><div class="label">AI 润色后</div>${mark(polished, fixed, "good")}</div></div></body></html>`;
}

// ---------- 终端输出取真实结果 ----------
async function capture(cmd, args, cwd) {
  try {
    const { stdout, stderr } = await run(cmd, args, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0" },
      maxBuffer: 1 << 24,
    });
    return `${stdout}\n${stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
  } catch (error) {
    return `${error.stdout}\n${error.stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
  }
}

// ---------- 开始生成 ----------
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

async function shoot(name, html, fitCode = false) {
  await page.setContent(html, { waitUntil: "load" });
  if (fitCode) {
    // 代码太长时逐步缩小字号，直到整块代码放得下
    await page.evaluate(() => {
      const fits = () =>
        [...document.querySelectorAll(".body")].every(
          (b) =>
            b.scrollHeight <= b.clientHeight + 1 &&
            b.scrollWidth <= b.clientWidth + 1,
        );
      for (let fs = 26; fs >= 15 && !fits(); fs -= 1)
        document.documentElement.style.setProperty("--fs", `${fs}px`);
    });
  }
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log("已生成", name);
}

const sections = await loadScript(path.join(here, "讲稿.md"));
await shoot("title", titleCard());
for (const s of sections.filter((s) => s.index > 0))
  await shoot(`section-${s.index}`, sectionCard(s.index, s.title));
await shoot("end", endCard());

await shoot(
  "code1-auth",
  codeSlide(
    "代码 1：令牌怎么带上、怎么校验<small>前端请求拦截器 + 后端认证中间件</small>",
    [
      {
        // 请求拦截器以「});」结尾，响应拦截器以「);」结尾，截到后者为止
        ...(await extract(
          "feynman-platform-frontend/src/api/axios.js",
          "请求拦截器",
          (l) => l === ");",
        )),
        highlights: ["Authorization", "status === 401"],
      },
      {
        ...(await extract(
          "src/middleware/auth.js",
          "function auth(req",
          closesAt(""),
        )),
        highlights: ["jwt.verify", "req.user = decoded.user"],
      },
    ],
  ),
  true,
);
await shoot(
  "code2-recorder",
  codeSlide("代码 2：用 MediaRecorder 录音<small>自写 React Hook</small>", [
    {
      ...(await extract(
        "feynman-platform-frontend/src/hooks/useAudioRecorder.js",
        "const stream = await navigator",
        (l) => l.includes("recorder.start();"),
      )),
      highlights: ["ondataavailable", "new Blob", "new MediaRecorder"],
    },
  ]),
  true,
);
await shoot(
  "code2-whisper",
  codeSlide(
    "代码 2（续）：本机 Whisper 转文字<small>Python Flask 服务</small>",
    [
      {
        ...(await extract(
          "whisper-service/app.py",
          '@app.post("/transcribe")',
          (l) => l.includes("os.remove(temp_path)"),
        )),
        lang: "python",
        highlights: ["model.transcribe", 'language="zh"'],
      },
    ],
  ),
  true,
);
await shoot(
  "code3-llm",
  codeSlide(
    "代码 3：多模型按顺序尝试，失败自动切换<small>src/services/llmService.js</small>",
    [
      {
        ...(await extract(
          "src/services/llmService.js",
          "async function chatJson",
          closesAt(""),
        )),
        highlights: [
          "for (const provider",
          "catch (error)",
          "throw new AppError",
        ],
      },
    ],
  ),
  true,
);
await shoot(
  "code4-prompt",
  codeSlide(
    "代码 4：提示词——用填写说明代替示例分数<small>src/services/prompts.js</small>",
    [
      {
        ...(await extract("src/services/prompts.js", "请完成两件事", (l) =>
          l.includes("}`,"),
        )),
        lang: "plaintext",
        highlights: [
          "同音错别字",
          "不要原样照抄",
          "<1-10 整数>",
          "<0-100 整数>",
        ],
      },
    ],
  ),
  true,
);

// 架构图：每段旁白高亮正在讲的部分
const HIGHLIGHT = "fill:#fff4e5,stroke:#e8590c,stroke-width:4px";
const arch = await readFile(
  path.join(here, "diagrams", "architecture.mmd"),
  "utf8",
);
const archVariants = {
  all: [],
  fe: ["FE"],
  be: ["BE", "DB"],
  whisper: ["WS", "AUDIO"],
  llm: ["LLM", "DS", "OL"],
};
const diagramPage = await prepareDiagramPage(browser);
for (const [name, nodes] of Object.entries(archVariants)) {
  const styled =
    arch + nodes.map((n) => `\n  style ${n} ${HIGHLIGHT}`).join("");
  await renderDiagram(
    diagramPage,
    styled,
    path.join(outDir, `arch-${name}.png`),
  );
  console.log("已生成", `arch-${name}`);
}
await renderDiagram(
  diagramPage,
  await readFile(path.join(here, "diagrams", "feynman-sequence.mmd"), "utf8"),
  path.join(outDir, "sequence.png"),
);
console.log("已生成 sequence");

// 识别错字对比
const wrong = [
  ["汇化", "会话"],
  ["载贺", "载荷"],
  ["在贺里", "在载荷里"],
].filter(([w]) => meta.transcript.includes(w));
await shoot(
  "transcript",
  transcriptCompare(meta.transcript, meta.evaluation.polishedText, wrong),
);

// 终端：测试、标签、自动录制日志
const verify = await capture("npm", ["run", "verify"], root);
const verifyLines = verify
  .split(/\r?\n/)
  .filter((l) =>
    /^(> (prettier|eslint|jest)|All matched|PASS|FAIL|Test Suites:|Tests:|Time:)/.test(
      l.trim(),
    ),
  )
  .map((l) => l.trim());
await shoot(
  "term-verify",
  terminal("自动化测试：npm run verify（格式检查 + 代码检查 + 27 个测试）", [
    { cmd: { dir: "Android", text: "npm run verify" }, out: verifyLines },
  ]),
);

const tags = (await capture("git", ["tag", "--list", "--sort=v:refname"], root))
  .split(/\r?\n/)
  .filter(Boolean);
const logLines = (await capture("git", ["log", "--oneline", "-6"], root))
  .split(/\r?\n/)
  .filter(Boolean);
await shoot(
  "term-git",
  terminal("每课一个标签，可以回看任意一课", [
    { cmd: { dir: "Android", text: "git tag --list" }, out: tags },
    { cmd: { dir: "Android", text: "git log --oneline -6" }, out: logLines },
  ]),
);

const recordLog = meta.log
  .filter((l) => !l.includes("开始录制") && !l.includes("识别结果"))
  .map((l) => (l.length > 64 ? `${l.slice(0, 63)}…` : l));
await shoot(
  "term-record",
  terminal("本视频的操作由 Playwright 脚本自动完成", [
    { cmd: { dir: "video", text: "node record-shots.mjs" }, out: recordLog },
  ]),
);

await browser.close();
