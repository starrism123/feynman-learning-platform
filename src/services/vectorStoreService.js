const crypto = require("crypto");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const KnowledgeChunk = require("../models/KnowledgeChunk");
const KnowledgePoint = require("../models/KnowledgePoint");
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
function createSplitter({
  chunkSize = CHUNK_SIZE,
  chunkOverlap = CHUNK_OVERLAP,
} = {}) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
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

// 标题和内容的指纹，存在每个块上。知识点改了但向量化失败时，
// 旧块还在、块数也不为 0，只有对比指纹才知道它们已经过期
function contentHash(knowledgePoint) {
  return crypto
    .createHash("sha1")
    .update(`${knowledgePoint.title}\n${knowledgePoint.content}`)
    .digest("hex");
}

// 同一个知识点的建索引、删除排成一队，一个做完再做下一个。
// 否则连续保存两次时，两个后台任务交错执行，可能留下两组块，或者旧内容覆盖新内容
const queues = new Map();
function enqueue(knowledgePointId, job) {
  const key = String(knowledgePointId);
  const run = (queues.get(key) || Promise.resolve()).catch(() => {}).then(job);
  queues.set(key, run);
  run
    .finally(() => {
      if (queues.get(key) === run) queues.delete(key);
    })
    .catch(() => {});
  return run;
}

async function buildIndex(knowledgePointId) {
  // 排到自己时再读一次数据库，用的是最新内容；知识点已经被删了就只清理块
  const knowledgePoint = await KnowledgePoint.findById(knowledgePointId);
  if (!knowledgePoint) {
    await KnowledgeChunk.deleteMany({ knowledgePoint: knowledgePointId });
    return { chunks: 0, model: null };
  }
  const texts = await splitter.splitText(knowledgePoint.content);
  // 先算向量再替换：向量化失败时，旧的块还在，检索不会突然变空
  const { embeddings, model } = await embeddingService.embed(
    texts.map((text) => withTitle(knowledgePoint, text)),
  );
  const hash = contentHash(knowledgePoint);
  // 先插入新块、再删旧块：插入失败时旧块完好；删除失败时多出的旧块下次重建会清掉
  const inserted = await KnowledgeChunk.insertMany(
    texts.map((text, index) => ({
      user: knowledgePoint.user,
      knowledgePoint: knowledgePoint._id,
      index,
      text,
      embedding: embeddings[index],
      model,
      contentHash: hash,
    })),
  );
  await KnowledgeChunk.deleteMany({
    knowledgePoint: knowledgePoint._id,
    _id: { $nin: inserted.map((chunk) => chunk._id) },
  });
  return { chunks: texts.length, model };
}

function indexKnowledgePoint(knowledgePoint) {
  return enqueue(knowledgePoint._id, () => buildIndex(knowledgePoint._id));
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

// 也要排队：正在建索引的任务做完以后再删，不会删完又被它插回来
function removeKnowledgePoint(knowledgePointId) {
  return enqueue(knowledgePointId, () =>
    KnowledgeChunk.deleteMany({ knowledgePoint: knowledgePointId }),
  );
}

// 两个向量都已归一化，点积就是余弦相似度，越接近 1 越相关
function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

// 第 11 课：点名保底。一句话同时问几个概念时（「JWT、bcrypt 和 CORS 各解决什么」），
// 问题向量是几个主题的「平均」，和每个知识点都不太像，纯向量检索会漏掉其中几个。
// 知识点标题是用户自己起的主题名，问题里出现了标题中的英文术语，就等于点名要这个知识点：
// 它最相关的一块一定入选，不受相关度门槛限制；其余名额仍按向量相似度排。
// 试过「向量 + 全文关键词」的混合排序，单个问题的命中率反而下降，对比见 docs/rag-retrieval-eval.md
function keywordTerms(query) {
  const words = query.match(/[A-Za-z][w.+#-]*[A-Za-z0-9+#]/g) || [];
  return [...new Set(words.map((word) => word.toLowerCase()))];
}

function rankChunks(
  query,
  queryVector,
  chunks,
  { limit = 4, minScore = 0 } = {},
) {
  const terms = keywordTerms(query);
  const ranked = chunks
    .map((chunk) => ({ ...chunk, score: dot(queryVector, chunk.embedding) }))
    .sort((a, b) => b.score - a.score);

  const picked = [];
  const named = new Set();
  for (const chunk of ranked) {
    const key = String(chunk.knowledgePointId);
    const title = chunk.title.toLowerCase();
    if (!named.has(key) && terms.some((term) => title.includes(term))) {
      named.add(key);
      picked.push(chunk);
    }
  }
  picked.splice(limit);
  for (const chunk of ranked) {
    if (picked.length >= limit) break;
    if (chunk.score >= minScore && !picked.includes(chunk)) picked.push(chunk);
  }
  return picked.sort((a, b) => b.score - a.score);
}

async function search(userId, query, { limit = 4, minScore = 0 } = {}) {
  const {
    embeddings: [queryVector],
    model,
  } = await embeddingService.embed([query], { type: "query" });
  // 只和同一个模型算出的块比较：不同模型的向量各有各的坐标系，点积没有意义，
  // 维度不同时甚至不会报错，只会给出乱序的结果。换了模型要先重建索引
  const chunks = await KnowledgeChunk.find({ user: userId, model })
    .populate("knowledgePoint", "title")
    .lean();
  const candidates = chunks
    .filter(
      (chunk) =>
        chunk.knowledgePoint && chunk.embedding.length === queryVector.length,
    )
    .map((chunk) => ({
      knowledgePointId: chunk.knowledgePoint._id,
      title: chunk.knowledgePoint.title,
      index: chunk.index,
      text: chunk.text,
      embedding: chunk.embedding,
    }));
  return rankChunks(query, queryVector, candidates, { limit, minScore }).map(
    // eslint-disable-next-line no-unused-vars
    ({ embedding, ...result }) => result,
  );
}

module.exports = {
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  contentHash,
  createSplitter,
  rankChunks,
  indexKnowledgePoint,
  indexInBackground,
  removeKnowledgePoint,
  search,
};
