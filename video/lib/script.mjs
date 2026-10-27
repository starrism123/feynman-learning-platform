// 读取 讲稿.md：每个「## 」是一段，「**旁白**：」后面按空行分成若干自然段，每个自然段单独配音。
import { readFile } from "node:fs/promises";

export async function loadScript(file) {
  const text = await readFile(file, "utf8");
  const sections = [];
  for (const block of text.split(/\n(?=## )/).slice(1)) {
    const heading = block.split("\n")[0].replace(/^##\s*/, "");
    const match = heading.match(/^(\d+)\.\s*([^（(]+)/);
    const narration = block.split("**旁白**：")[1] ?? "";
    const paragraphs = narration
      .split(/\n\s*\n/)
      .map((p) =>
        p
          .replace(/【[^】]*】/g, "")
          .replace(/\s+/g, "")
          .trim(),
      )
      .filter(Boolean);
    sections.push({
      index: Number(match[1]),
      title: match[2].trim(),
      paragraphs,
    });
  }
  return sections;
}

export const paragraphId = (section, paragraph) => `s${section}p${paragraph}`;
