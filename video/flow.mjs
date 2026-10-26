// 用 Playwright 驱动本机 Chrome 走一遍完整用户流程：登录 → 录音复述 → AI 点评 → AI 测评。
// 麦克风用 Chrome 的假设备代替，播放 assets/student-retell.wav（一段模拟学生复述的录音）。
// 用法：先按 README 启动全部服务并运行 npm run seed:demo，再在 video/ 下运行 npm run flow
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "output", "flow");
const fakeMic = path.join(here, "assets", "student-retell.wav");
const APP = process.env.APP_URL ?? "http://localhost:5173";
const RETELL_SECONDS = 31; // 录音文件约 30 秒，多录 1 秒

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: process.env.HEADED !== "1",
  args: [
    "--use-fake-ui-for-media-stream", // 自动允许麦克风
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${fakeMic}%noloop`,
  ],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
});
const page = await context.newPage();
const shot = (name) =>
  page.screenshot({ path: path.join(outDir, `${name}.png`) });
const step = (text) =>
  console.log(`[${new Date().toLocaleTimeString()}] ${text}`);

try {
  step("登录演示账号");
  await page.goto(`${APP}/login`);
  await page.locator("input[type=email]").fill("demo@feynman.test");
  await page.locator("input[type=password]").fill("demo-pass-2026");
  await page.getByRole("button", { name: "登录" }).click();
  await page.getByRole("heading", { name: "我的知识点" }).waitFor();
  await shot("01-dashboard");

  step("打开 JWT 知识点的复述页并录音");
  const card = page.locator(".kp-card", { hasText: "JWT 登录认证" });
  await card.getByRole("link", { name: "开始复述" }).click();
  await page.getByRole("button", { name: "● 开始录音" }).click();
  await page.waitForTimeout(RETELL_SECONDS * 1000);
  await shot("02-recording");
  await page.getByRole("button", { name: "■ 停止录音" }).click();

  step("等 Whisper 转写");
  const transcript = page.locator("textarea.transcript");
  await transcript.waitFor({ timeout: 120_000 });
  step(`识别结果：${await transcript.inputValue()}`);
  await shot("03-transcript");

  step("请 AI 教练点评");
  await page.getByRole("button", { name: "请 AI 教练点评" }).click();
  await page.locator(".score-box .score").waitFor({ timeout: 180_000 });
  step(`综合分：${await page.locator(".score-box .score").innerText()}`);
  await shot("04-evaluation");

  step("AI 出单选题并作答");
  await page.goto(page.url().replace("/feynman/", "/quiz/"));
  await page.getByRole("button", { name: "单选题" }).click();
  await page.getByRole("button", { name: "中等" }).click();
  await page.locator(".option").first().waitFor({ timeout: 120_000 });
  await page.locator(".option").first().click();
  await page.getByRole("button", { name: "提交答案" }).click();
  await page.locator(".result").waitFor();
  step(`单选结果：${await page.locator(".result strong").innerText()}`);
  await shot("05-single-choice");

  step("AI 出简答题并由 AI 判分");
  await page.getByRole("button", { name: "简答题" }).click();
  await page.getByRole("button", { name: "基础" }).click();
  await page.locator("textarea.transcript").waitFor({ timeout: 120_000 });
  await page
    .locator("textarea.transcript")
    .fill(
      "JWT 由头部、载荷和签名三部分组成。头部写签名算法，载荷放用户 id 和过期时间，签名用服务器的密钥算出来，用来防止内容被篡改。",
    );
  await page.getByRole("button", { name: "提交答案" }).click();
  await page.locator(".result").waitFor({ timeout: 120_000 });
  step(`简答结果：${await page.locator(".result strong").innerText()}`);
  await shot("06-short-answer");
  step("全流程完成");
} catch (error) {
  await shot("error");
  throw error;
} finally {
  await context.close();
  await browser.close();
}
