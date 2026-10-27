// 把 diagrams/*.mmd 渲染成白底 PNG（2 倍清晰度），供视频和报告使用。
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { prepareDiagramPage, renderDiagram } from "./lib/diagram.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, "diagrams");
const outDir = path.join(here, "output", "diagrams");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await prepareDiagramPage(browser);
for (const file of (await readdir(srcDir)).filter((f) => f.endsWith(".mmd"))) {
  const out = path.join(outDir, file.replace(".mmd", ".png"));
  await renderDiagram(
    page,
    await readFile(path.join(srcDir, file), "utf8"),
    out,
  );
  console.log("已生成", out);
}
await browser.close();
