// 用前端已经安装的 mermaid 在本机 Chrome 里把图渲染成白底 PNG。
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mermaidJs = path.join(
  here,
  "..",
  "..",
  "feynman-platform-frontend",
  "node_modules",
  "mermaid",
  "dist",
  "mermaid.min.js",
);

export async function prepareDiagramPage(browser) {
  const page = await browser.newPage({
    deviceScaleFactor: 2,
    viewport: { width: 1600, height: 900 },
  });
  await page.setContent(
    '<html><body style="margin:0;background:#fff"><div id="out" style="display:inline-block;padding:32px;background:#fff"></div></body></html>',
  );
  await page.addScriptTag({ path: mermaidJs });
  return page;
}

export async function renderDiagram(page, source, outFile) {
  await page.evaluate(async (code) => {
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
    const { svg } = await window.mermaid.render(`d${Date.now()}`, code);
    document.getElementById("out").innerHTML = svg;
  }, source);
  await page.locator("#out").screenshot({ path: outFile });
}
