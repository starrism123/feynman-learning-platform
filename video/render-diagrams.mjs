// 把 diagrams/*.mmd 渲染成白底 PNG（2 倍清晰度），供视频和报告使用。
// 用前端已经安装的 mermaid，不额外下载；浏览器用本机 Chrome。
import { readdir, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, "diagrams");
const outDir = path.join(here, "output", "diagrams");
const mermaidJs = path.join(
  here,
  "..",
  "feynman-platform-frontend",
  "node_modules",
  "mermaid",
  "dist",
  "mermaid.min.js",
);

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  deviceScaleFactor: 2,
  viewport: { width: 1600, height: 900 },
});
await page.setContent(
  '<html><body style="margin:0;background:#fff"><div id="out" style="display:inline-block;padding:32px;background:#fff"></div></body></html>',
);
await page.addScriptTag({ path: mermaidJs });

for (const file of (await readdir(srcDir)).filter((f) => f.endsWith(".mmd"))) {
  const code = await readFile(path.join(srcDir, file), "utf8");
  await page.evaluate(async (source) => {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      themeVariables: { fontSize: "18px" },
      flowchart: {
        useMaxWidth: false,
        wrappingWidth: 320,
        nodeSpacing: 40,
        rankSpacing: 60,
      },
      sequence: {
        useMaxWidth: false,
        actorFontSize: 18,
        messageFontSize: 18,
        noteFontSize: 16,
        width: 170,
      },
    });
    const { svg } = await window.mermaid.render("diagram", source);
    document.getElementById("out").innerHTML = svg;
  }, code);
  const out = path.join(outDir, file.replace(".mmd", ".png"));
  await page.locator("#out").screenshot({ path: out });
  console.log("已生成", out);
}
await browser.close();
