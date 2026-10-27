// 按讲稿顺序录制各段操作画面，输出到 output/clips/，并把 AI 当次的真实输出记到 meta.json。
// 前提：按 README 启动 MongoDB、后端、前端、Whisper（和 Ollama），.env 里配好 DeepSeek。
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  click,
  moveTo,
  openBrowser,
  recordClip,
  smoothScroll,
  type,
} from "./lib/browser.mjs";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const clipsDir = path.join(here, "output", "clips");
const APP = process.env.APP_URL ?? "http://localhost:5173";
const API = process.env.API_URL ?? "http://localhost:3000";
const DEMO = {
  username: "demo_student",
  email: "demo@feynman.test",
  password: "demo-pass-2026",
};
const ONLY = process.env.ONLY?.split(","); // 只重录某几段，例如 ONLY=evaluate,quiz-single

const NEW_KP = {
  title: "Express 中间件",
  content: `# 中间件是什么

中间件是请求到达路由之前要经过的一道道"关卡"，每一道都可以检查、修改请求，或者直接拦下。

| 中间件 | 作用 |
| --- | --- |
| express.json() | 把请求体解析成对象 |
| auth | 校验 JWT，挂上 req.user |
| errorHandler | 统一处理错误 |

一个请求依次经过 $n$ 个中间件，总耗时 $T = \\sum_{i=1}^{n} t_i$

\`\`\`mermaid
flowchart LR
  A[请求] --> B[express.json] --> C[auth] --> D[路由处理] --> E[响应]
\`\`\`
`,
};

const meta = { recordedAt: new Date().toISOString(), clips: {}, log: [] };
const log = (text) => {
  const line = `[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${text}`;
  console.log(line);
  meta.log.push(line);
};
const seed = (...args) =>
  run("node", ["scripts/seed-demo.js", ...args], { cwd: root });

await mkdir(clipsDir, { recursive: true });
const { browser, page } = await openBrowser({
  fakeMic: path.join(here, "assets", "student-retell.wav"),
});

async function clip(name, actions) {
  if (ONLY && !ONLY.includes(name)) return;
  log(`开始录制：${name}`);
  const result = await recordClip(
    page,
    path.join(clipsDir, `${name}.mp4`),
    actions,
  );
  meta.clips[name] = Number(result.seconds.toFixed(2));
  log(`录好 ${name}，${result.seconds.toFixed(1)} 秒`);
}

const card = (title) => page.locator(".kp-card", { hasText: title });

try {
  // 准备：删掉演示账号，从注册开始演示
  if (!ONLY || ONLY.includes("register")) {
    await seed("--reset");
    log("已清空演示账号");
  }

  await clip("register", async () => {
    await page.goto(`${APP}/register`);
    await page.waitForTimeout(800);
    await type(page, page.locator('input[name="username"]'), DEMO.username);
    await type(page, page.locator('input[name="email"]'), DEMO.email);
    await type(page, page.locator('input[type="password"]'), DEMO.password);
    await click(page, page.getByRole("button", { name: "注册" }));
    await page.waitForURL("**/login");
    await page.waitForTimeout(1800);
  });

  // 注册完补上 3 个演示知识点
  await seed();
  log("已写入演示知识点");

  await clip("login", async () => {
    if (!page.url().includes("/login")) await page.goto(`${APP}/login`);
    await type(page, page.locator('input[type="email"]'), DEMO.email);
    await type(page, page.locator('input[type="password"]'), DEMO.password);
    await click(page, page.getByRole("button", { name: "登录" }));
    await page.getByRole("heading", { name: "我的知识点" }).waitFor();
    await page.waitForTimeout(2500);
  });

  await clip("search", async () => {
    await type(page, page.locator("input.search"), "React", 120);
    await page.waitForTimeout(2200);
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(1500);
  });

  await clip("editor", async () => {
    await click(page, page.getByRole("link", { name: "+ 新建知识点" }));
    await page.getByRole("heading", { name: "新建知识点" }).waitFor();
    await type(
      page,
      page.getByPlaceholder("例如：JWT 是什么"),
      NEW_KP.title,
      90,
    );
    await click(page, page.locator(".w-md-editor-text-input"));
    await page.keyboard.type(NEW_KP.content, { delay: 14 });
    await page.waitForTimeout(800);
    // 把编辑器滚到底，露出预览里的表格和公式
    await page
      .locator(".w-md-editor-preview")
      .evaluate((el) =>
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }),
      );
    await page.waitForTimeout(2500);
  });

  await clip("saved", async () => {
    await click(page, page.getByRole("button", { name: "创建" }));
    await page
      .locator(".mermaid-block svg")
      .first()
      .waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    await smoothScroll(page, 2000, 2500);
    await page.waitForTimeout(1200);
    await click(page, page.getByRole("link", { name: "我的知识点" }));
    await page.getByRole("heading", { name: "我的知识点" }).waitFor();
    await page.waitForTimeout(1000);
    await moveTo(page, card("JWT 登录认证").locator(".kp-title"));
    await page.waitForTimeout(1500);
  });

  await clip("record-start", async () => {
    if (!page.url().endsWith("/")) await page.goto(APP);
    await click(
      page,
      card("JWT 登录认证").getByRole("link", { name: "开始复述" }),
    );
    await page.getByRole("button", { name: "● 开始录音" }).waitFor();
    await page.waitForTimeout(1000);
    await click(page, page.getByRole("button", { name: "● 开始录音" }));
    await page.waitForTimeout(31000); // 复述录音约 30 秒
  });

  await clip("record-stop", async () => {
    await click(page, page.getByRole("button", { name: "■ 停止录音" }));
    const transcript = page.locator("textarea.transcript");
    await transcript.waitFor({ timeout: 120000 });
    await transcript.scrollIntoViewIfNeeded();
    meta.transcript = await transcript.inputValue();
    log(`识别结果：${meta.transcript}`);
    await page.waitForTimeout(3000);
  });

  await clip("evaluate", async () => {
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/ai/evaluate"),
      { timeout: 180000 },
    );
    await click(page, page.getByRole("button", { name: "请 AI 教练点评" }));
    meta.evaluation = (await (await response).json()).data;
    log(
      `点评：${meta.evaluation.provider}，${meta.evaluation.score} 分，耗时 ${meta.evaluation.latencyMs} 毫秒`,
    );
    await page.locator(".score-box .score").waitFor();
    await page.waitForTimeout(600);
    await page
      .getByRole("heading", { name: "AI 润色后的文本" })
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(3500);
    const bottom = await page.evaluate(() => document.body.scrollHeight);
    const current = await page.evaluate(() => window.scrollY);
    for (let y = current + 260; y < bottom; y += 260)
      await smoothScroll(page, y, 1500);
    await page.waitForTimeout(2500);
  });

  await clip("quiz-single", async () => {
    await page.goto(page.url().replace("/feynman/", "/quiz/"));
    await page.getByRole("button", { name: "单选题" }).waitFor();
    await page.waitForTimeout(800);
    await click(page, page.getByRole("button", { name: "单选题" }));
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/ai/generate-question"),
      { timeout: 120000 },
    );
    await click(page, page.getByRole("button", { name: "中等" }));
    const question = (await (await response).json()).data;
    await page.locator(".option").first().waitFor();
    await page.waitForTimeout(3500);
    // 故意选一个错误选项，演示「答错加入复习列表」
    const wrong = Object.keys(question.options).find(
      (key) => key !== question.answer,
    );
    meta.single = { ...question, picked: wrong };
    log(
      `单选题：${question.question}，答案 ${question.answer}，故意选 ${wrong}`,
    );
    await click(
      page,
      page.locator(".option", { has: page.locator(`input[value="${wrong}"]`) }),
    );
    await click(page, page.getByRole("button", { name: "提交答案" }));
    await page.locator(".result").scrollIntoViewIfNeeded();
    await page.waitForTimeout(4000);
  });

  await clip("quiz-short", async () => {
    await smoothScroll(page, 0, 800);
    await click(page, page.getByRole("button", { name: "简答题" }));
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/ai/generate-question"),
      { timeout: 120000 },
    );
    await click(page, page.getByRole("button", { name: "基础" }));
    meta.short = (await (await response).json()).data;
    await page.locator("textarea.transcript").waitFor();
    await page.waitForTimeout(2500);
    const answer =
      "JWT 由头部、载荷和签名三部分组成。头部写签名算法，载荷放用户 id 和过期时间，签名用服务器的密钥算出来，用来防止内容被篡改。";
    await type(page, page.locator("textarea.transcript"), answer, 35);
    const grade = page.waitForResponse(
      (r) => r.url().includes("/api/ai/grade-answer"),
      { timeout: 120000 },
    );
    await click(page, page.getByRole("button", { name: "提交答案" }));
    meta.short.grade = (await (await grade).json()).data;
    log(`简答题：${meta.short.question}，AI 判 ${meta.short.grade.score} 分`);
    await page.locator(".result").scrollIntoViewIfNeeded();
    await page.waitForTimeout(4500);
  });

  await clip("swagger", async () => {
    await page.goto(`${API}/api-docs`);
    await page.locator(".opblock").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    for (const y of [500, 1100, 1700, 2300]) await smoothScroll(page, y, 1600);
    await page.waitForTimeout(1000);
  });

  await clip("review", async () => {
    await page.goto(APP);
    await page.getByRole("heading", { name: "我的知识点" }).waitFor();
    await page.waitForTimeout(1200);
    await moveTo(page, card("JWT 登录认证").locator(".badge-review"));
    await page.waitForTimeout(3500);
  });

  // 开场用：浏览列表，再打开 JWT 知识点的详情和复述记录
  await clip("tour", async () => {
    await page.goto(APP);
    await page.getByRole("heading", { name: "我的知识点" }).waitFor();
    await page.waitForTimeout(800);
    await moveTo(page, card("React 中的 State 与 Props").locator(".kp-title"));
    await page.waitForTimeout(600);
    await click(page, card("JWT 登录认证").locator(".kp-title"));
    await page.waitForTimeout(1500);
    await smoothScroll(page, 600, 1800);
    await smoothScroll(page, 2400, 2200);
    await page.waitForTimeout(1500);
  });

  log("全部片段录制完成");
} catch (error) {
  await page.screenshot({ path: path.join(clipsDir, "error.png") });
  log(`出错：${error.message}`);
  throw error;
} finally {
  const metaFile = path.join(
    clipsDir,
    ONLY ? `meta-${ONLY.join("_")}.json` : "meta.json",
  );
  await writeFile(metaFile, JSON.stringify(meta, null, 2));
  await browser.close();
}
