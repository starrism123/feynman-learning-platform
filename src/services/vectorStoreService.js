const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const KnowledgeChunk = require("../models/KnowledgeChunk");
const embeddingService = require("./embeddingService");

// 第 10 课：RAG 的「建库」部分。知识点 → 切块 → 向量化 → 存进 MongoDB。
// 课程示例用 HNSWLib 存本地文件，它删不掉旧向量，只能「允许冗余」；
// 这里把向量和知识点存在同一个数据库里，更新时整组替换，删除时一起删，检索结果不会过期。
// 个人知识库只有几百个块，检索时逐个算相似度就够快；块数上万再换 HNSW 这类近似索引。

const CHUNK_SIZE = 300;
const CHUNK_OVERLAP = 50;
// 句末标点后插入一个看不见的标记当分隔符，切完再去掉：
// 这样句号留在句子末尾，而不是被挪到下一块开头
const SENTENCE_MARK = "\u2063";
const SEPARATORS = ["\n```", "\n\n", "\n", SENTENCE_MARK, "，", ""];
const HEADING = /^(#{1,4})\s+(.+?)\s*#*$/;

// 按 Markdown 标题把文档分成小节，记下每节所在的标题路径；代码块里的 # 不算标题
function splitSections(text) {
  const sections = [];
  const path = [];
  let lines = [];
  let inCode = false;
  const flush = () => {
    const body = lines.join("\n").trim();
    if (body) sections.push({ path: path.filter(Boolean).join(" > "), body });
    lines = [];
  };
  for (const line of text.split(/\r?\n/)) {
    if (line.trimStart().startsWith("```")) inCode = !inCode;
    const heading = !inCode && line.match(HEADING);
    if (heading) {
      flush();
      const level = heading[1].length;
      path.length = level;
      path[level - 1] = heading[2];
    } else {
      lines.push(line);
    }
  }
  flush();
  return sections;
}

// 先按标题分节，节内再按段落、换行、中文句子切；每块开头带上标题路径，
// 避免标题和正文被切到两块里。对比见 docs/rag-splitter-comparison.md
function createSplitter() {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators: SEPARATORS,
    keepSeparator: true,
  });
  return {
    async splitText(text) {
      const chunks = [];
      for (const { path, body } of splitSections(text)) {
        const marked = body.replace(/([。！？；])/g, `$1${SENTENCE_MARK}`);
        for (const piece of await splitter.splitText(marked)) {
          const clean = piece.replaceAll(SENTENCE_MARK, "").trim();
          if (clean) chunks.push(path ? `【${path}】\n${clean}` : clean);
        }
      }
      return chunks;
    },
  };
}

const splitter = createSplitter();

// 每块向量化时带上标题：片段里没出现主题词，也能和问题对上
const withTitle = (knowledgePoint, text) => `${knowledgePoint.title}\n${text}`;

async function indexKnowledgePoint(knowledgePoint) {
  const texts = await splitter.splitText(knowledgePoint.content);
  // 先算向量再替换：向量化失败时，旧的块还在，检索不会突然变空
  const { embeddings, model } = await embeddingService.embed(
    texts.map((text) => withTitle(knowledgePoint, text)),
  );
  await KnowledgeChunk.deleteMany({ knowledgePoint: knowledgePoint._id });
  await KnowledgeChunk.insertMany(
    texts.map((text, index) => ({
      user: knowledgePoint.user,
      knowledgePoint: knowledgePoint._id,
      index,
      text,
      embedding: embeddings[index],
      model,
    })),
  );
  return { chunks: texts.length, model };
}

// 创建、更新知识点时调用：不等向量化完成就先返回响应，失败只记日志，可以再用 reindex 补
function indexInBackground(knowledgePoint) {
  if (process.env.RAG_INDEXING === "off") return;
  indexKnowledgePoint(knowledgePoint).catch((error) => {
    console.warn(
      `知识点 ${knowledgePoint._id} 向量化失败：${error.message}，之后可在知识库页面重建索引`,
    );
  });
}

async function removeKnowledgePoint(knowledgePointId) {
  await KnowledgeChunk.deleteMany({ knowledgePoint: knowledgePointId });
}

// 两个向量都已归一化，点积就是余弦相似度，越接近 1 越相关
function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

async function search(userId, query, { limit = 4 } = {}) {
  const {
    embeddings: [queryVector],
  } = await embeddingService.embed([query], { type: "query" });
  const chunks = await KnowledgeChunk.find({ user: userId })
    .populate("knowledgePoint", "title")
    .lean();
  return chunks
    .filter((chunk) => chunk.knowledgePoint)
    .map((chunk) => ({
      knowledgePointId: chunk.knowledgePoint._id,
      title: chunk.knowledgePoint.title,
      index: chunk.index,
      text: chunk.text,
      score: dot(queryVector, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = {
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  createSplitter,
  indexKnowledgePoint,
  indexInBackground,
  removeKnowledgePoint,
  search,
};
