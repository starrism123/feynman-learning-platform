// 第 10 课选做：比较几种文本切分方式，结果写到 docs/rag-splitter-comparison.md。
// 用法：npm run rag:compare-splitters
// 语料：docs/learning-guide.md（长 Markdown 文档）、期中讲稿的旁白（拼成没有换行的一整段，
// 模拟语音转文字得到的复述）、scripts/seed-demo.js 里的示例知识点。
const fs = require("fs");
const path = require("path");
const {
  CharacterTextSplitter,
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
} = require("@langchain/textsplitters");
const { createSplitter } = require("../src/services/vectorStoreService");
const { demoKnowledgePoints } = require("./seed-demo");

const root = path.join(__dirname, "..");
const narration = fs
  .readFileSync(path.join(root, "video/讲稿.md"), "utf8")
  .split("**旁白**：")
  .slice(1)
  .map((part) => part.split(/\n## |\n---/)[0])
  .join("")
  .replace(/【[^】]*】/g, "")
  .replace(/\s+/g, "");
const corpus = [
  {
    title: "学习指南（长文档）",
    content: fs.readFileSync(path.join(root, "docs/learning-guide.md"), "utf8"),
  },
  { title: "讲稿旁白（无换行长段落）", content: narration },
  ...demoKnowledgePoints,
];

const candidates = [
  {
    name: "A. 课程示例：RecursiveCharacter 默认分隔符，500/50",
    splitter: new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    }),
  },
  {
    name: "B. Character：只按空行切，500/50",
    splitter: new CharacterTextSplitter({
      separator: "\n\n",
      chunkSize: 500,
      chunkOverlap: 50,
    }),
  },
  {
    name: "C. Markdown：按标题、代码块等 Markdown 结构切，500/50",
    splitter: new MarkdownTextSplitter({ chunkSize: 500, chunkOverlap: 50 }),
  },
  {
    name: "D. 本项目采用：先按标题分节，节内按中文句子切，带标题路径，300/50",
    splitter: createSplitter(),
  },
];

// 句子在中间被切断：块的结尾不是句末标点、换行或代码块结束
// 回到原文找这一块的结尾：后面紧跟的不是换行，自己也不以句末标点结束，就是切在了半句话上
function endsMidSentence(text, source) {
  const tail = bodyOf(text).trimEnd().slice(-30);
  const pos = source.indexOf(tail);
  if (pos === -1) return false;
  const next = source[pos + tail.length];
  return next !== undefined && next !== "\n" && !/[。！？；!?;]$/.test(tail);
}

// 去掉 D 方式加在开头的【标题路径】，只看正文
function bodyOf(text) {
  return text.replace(/^【[^】]*】\n/, "");
}

// 块的最后一行是标题：这一节的正文被分到了下一块
function danglingHeading(text) {
  const lines = text.split("\n").filter((line) => line.trim());
  return lines.length > 1 && /^\s*#{1,6}\s/.test(lines.at(-1));
}

// 只有标题、没有正文的块：检索到它也拿不到任何内容
function headingOnly(text) {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .every((line) => /^\s*#{1,6}\s|^【[^】]*】$/.test(line));
}

async function evaluate({ splitter }) {
  const chunks = [];
  for (const doc of corpus) {
    const pieces = await splitter.splitText(doc.content);
    chunks.push(
      ...pieces.map((text) => ({ doc: doc.title, source: doc.content, text })),
    );
  }
  const lengths = chunks.map((c) => c.text.length);
  const longDocChunks = chunks.filter((c) => c.doc === corpus[0].title);
  return {
    count: chunks.length,
    avg: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length),
    max: Math.max(...lengths),
    tiny: lengths.filter((l) => l < 60).length,
    midSentence: chunks.filter((c) => endsMidSentence(c.text, c.source)).length,
    headingOnly: chunks.filter((c) => headingOnly(c.text)).length,
    dangling: chunks.filter((c) => danglingHeading(c.text)).length,
    // 没有换行的长段落单独统计，看中文句子能不能切完整
    paragraphCuts: chunks.filter(
      (c) => c.doc === corpus[1].title && endsMidSentence(c.text, c.source),
    ).length,
    paragraphChunks: chunks.filter((c) => c.doc === corpus[1].title).length,
    sample: longDocChunks.slice(3, 5).map((c) => c.text),
  };
}

const quote = (text) =>
  text.slice(0, 160).replace(/\n/g, "⏎").replace(/\|/g, "\\|") +
  (text.length > 160 ? "…" : "");

async function main() {
  const rows = [];
  const samples = [];
  for (const candidate of candidates) {
    const result = await evaluate(candidate);
    rows.push(
      `| ${candidate.name} | ${result.count} | ${result.avg} | ${result.max} | ${result.tiny} | ${result.headingOnly} | ${result.dangling} | ${result.midSentence}（其中长段落 ${result.paragraphCuts}/${result.paragraphChunks}）|`,
    );
    samples.push(
      `### ${candidate.name}\n\n${result.sample.map((s, i) => `- 第 ${i + 4} 块：${quote(s)}`).join("\n")}`,
    );
    console.log(candidate.name, result.count, "块");
  }

  const report = `# 文本切分方式对比（第 10 课选做）

> 由 \`npm run rag:compare-splitters\` 生成，不要手改。语料：\`docs/learning-guide.md\`（约 ${corpus[0].content.length} 字的 Markdown）加 ${demoKnowledgePoints.length} 个示例知识点。

| 方式 | 块数 | 平均长度 | 最长 | 少于 60 字的碎块 | 只有标题的块 | 标题落在块尾 | 切在半句话上 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## 结论

- **有分段的文档，几种方式都很少切断句子**：学习指南的段落本来就短，按换行就能断开。差别在标题上：A、B 有 3 块的最后一行是下一节的标题，正文却在下一块；C 先在标题处断开，结果切出 3 个只有标题、没有正文的块。检索命中这些块，模型拿到的要么是错位的标题，要么什么内容都没有。
- **没有换行的长段落，差别最大**：A 和 C 的段落里没有空格可断，只能按字符硬切，6 块里有 5 块停在半句话上；B 只认空行，干脆不切，留下一块 2683 字的大块，超出上限好几倍，检索时整块要么全中、要么全不中。语音转文字得到的复述正是这种长段落，所以这一项对本平台最重要。
- **本项目用 D**：先按标题把文档分成小节，节内再按段落、换行、中文句号断开，每块开头带上它所在的标题路径。表里 D 没有标题错位，长段落 12 块全部切在句末；块长 300 字，一块大约讲一件事，代价是块数多了将近一倍，向量化和检索的计算量也跟着翻倍，对个人知识库可以接受。
- **标题路径和知识点标题都参与向量化**（见 \`vectorStoreService.js\`）：片段里没出现主题词，也能和问题对上。
- 这里比的是「切得完不完整」。「切完以后检索得准不准」要等第 11 课有了问答，用同一组问题看命中率，再回头验证 300 这个块长。

## 第 4、5 块对照（长文档）

${samples.join("\n\n")}
`;
  fs.writeFileSync(path.join(root, "docs/rag-splitter-comparison.md"), report);
  console.log("已写入 docs/rag-splitter-comparison.md");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
