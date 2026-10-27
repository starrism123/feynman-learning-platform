// 第 11 课：检索效果评测。用一组答案已知的问题，比较不同切分方式「搜得准不准」，
// 并看相关问题和无关问题的最高相似度分布，给问答接口定「相关度门槛」。
// 用法：先启动 whisper-service，再运行 npm run rag:eval，结果写到 docs/rag-retrieval-eval.md。
// 和 rag:compare-splitters（只看切得完不完整）互补：这里看切完以后检索的命中率。
const fs = require("fs");
const path = require("path");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const embeddingService = require("../src/services/embeddingService");
const {
  createSplitter,
  rankChunks,
} = require("../src/services/vectorStoreService");
const { MIN_SCORE } = require("../src/services/ragService");
const { demoKnowledgePoints } = require("./seed-demo");

const root = path.join(__dirname, "..");
const guide = fs.readFileSync(
  path.join(root, "docs/learning-guide.md"),
  "utf8",
);

// 语料：一篇约 8000 字的长笔记（学习指南）+ 8 个演示知识点
const docs = [
  { id: "guide", title: "系统学习指南", content: guide },
  ...demoKnowledgePoints.map((kp) => ({
    id: `kp:${kp.title}`,
    title: kp.title,
    content: kp.content,
  })),
];

// 学习指南里每个小节的起点，用来判断一个块落在哪几节
const sections = [...guide.matchAll(/^#{2,3} (\d+(?:\.\d+)?)/gm)].map((m) => ({
  label: `guide:${m[1]}`,
  start: m.index,
}));

// expected：答对的位置，任意命中一个就算对（有的问题在指南和知识点里都有答案）
const QUESTIONS = [
  { q: "node_modules 要不要提交到 Git？", expected: ["guide:2.2"] },
  { q: "require 和 module.exports 分别是干什么的？", expected: ["guide:2.3"] },
  { q: "为什么要把创建应用和监听端口分开写？", expected: ["guide:2.4"] },
  {
    q: "JWT 密钥这种秘密应该放在哪里？",
    expected: ["guide:2.5", "kp:JWT 登录认证"],
  },
  { q: "暂存区和提交有什么区别？", expected: ["guide:2.6"] },
  { q: "接口返回 409 是什么情况？", expected: ["guide:3.1"] },
  {
    q: "MongoDB 内部用什么格式存数据？",
    expected: ["guide:3.2", "kp:MongoDB 与 Mongoose"],
  },
  {
    q: "字段设置了 unique，为什么控制器还要自己查重复？",
    expected: ["guide:3.3"],
  },
  { q: "await 等待的到底是什么？", expected: ["guide:3.4"] },
  {
    q: "存密码时加盐有什么用？",
    expected: ["guide:3.5", "kp:密码哈希与 bcrypt"],
  },
  { q: "解析 JSON 的中间件为什么要写在路由前面？", expected: ["guide:3.6"] },
  {
    q: "JWT 里面能不能放密码？",
    expected: ["guide:4.1", "kp:JWT 登录认证"],
  },
  {
    q: "只验证 token、不检查资源属于谁，会出什么问题？",
    expected: ["guide:4.2"],
  },
  { q: "认证中间件按什么顺序处理请求头？", expected: ["guide:4.3"] },
  { q: "知识点的状态可以取哪些值？", expected: ["guide:4.4"] },
  { q: "ID 格式不对时为什么返回 400？", expected: ["guide:4.5"] },
  { q: "前端应该根据什么来判断错误类型？", expected: ["guide:4.6"] },
  {
    q: "访问别人的知识点为什么返回 404 而不是 401？",
    expected: ["guide:5", "guide:4.2"],
  },
  { q: "测试里的内存数据库起什么作用？", expected: ["guide:6.1"] },
  { q: "Docker 里的应用怎么连上数据库？", expected: ["guide:6.3"] },
  { q: "让 AI 帮忙写代码时应该怎么要求它？", expected: ["guide:7"] },
  {
    q: "前端为什么调不通另一个端口上的接口？",
    expected: ["kp:跨域与 CORS", "guide:3.6"],
  },
  {
    q: "props 和 state 有什么区别？",
    expected: ["kp:React 中的 State 与 Props"],
  },
  {
    q: "useEffect 的依赖数组写成空数组是什么意思？",
    expected: ["kp:useEffect 与副作用"],
  },
  { q: "为什么讲给别人听能检验自己学会没有？", expected: ["kp:费曼学习法"] },
  {
    q: "资源的 URL 应该怎么设计？",
    expected: ["kp:RESTful API 设计", "guide:3.1"],
  },
  {
    q: "Mongoose 的 Schema 是用来做什么的？",
    expected: ["kp:MongoDB 与 Mongoose", "guide:3.3"],
  },
  { q: "token 过期了会怎样？", expected: ["kp:JWT 登录认证", "guide:4.1"] },
];
// 知识库里没有答案的问题：最高分应该明显低于上面那些
const UNANSWERABLE = [
  "红烧肉怎么做才不腻？",
  "明天北京天气怎么样？",
  "Python 的装饰器怎么写？",
  "Vue 的生命周期钩子有哪些？",
  "怎么用 Redis 做缓存？",
  "期末考试是什么时候？",
];

const courseSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});
const CANDIDATES = [
  {
    name: "A. 课程示例：Recursive 500/50，只向量化块本身",
    split: (text) => courseSplitter.splitText(text),
    withTitle: false,
  },
  ...[200, 300, 500].map((size) => ({
    name: `D${size}. 本项目切法，块长 ${size}，向量化时带标题`,
    split: (text) => createSplitter({ chunkSize: size }).splitText(text),
    withTitle: true,
  })),
  {
    name: "D300'. 本项目切法，块长 300，不带知识点标题",
    split: (text) => createSplitter().splitText(text),
    withTitle: false,
  },
];

const bodyOf = (text) => text.replace(/^【[^】]*】\n/, "");

// 这个块覆盖了学习指南的哪几节；知识点的块就是知识点本身
function labelsOf(doc, text) {
  if (doc.id !== "guide") return [doc.id];
  const body = bodyOf(text);
  const start = guide.indexOf(body.slice(0, 40));
  if (start === -1) return [];
  const end = start + body.length;
  return sections
    .filter((s, i) => {
      const next = sections[i + 1]?.start ?? guide.length;
      return s.start < end && next > start;
    })
    .map((s) => s.label);
}

// 综合性问题：一句话问几个概念，每组里命中任意一个就算覆盖了这个概念
const MULTI = [
  {
    q: "JWT、bcrypt 和 CORS 各自解决什么问题？",
    groups: [
      ["kp:JWT 登录认证", "guide:4.1"],
      ["kp:密码哈希与 bcrypt", "guide:3.5"],
      ["kp:跨域与 CORS", "guide:3.6"],
    ],
  },
  {
    q: "JWT 和 bcrypt 有什么区别？",
    groups: [
      ["kp:JWT 登录认证", "guide:4.1"],
      ["kp:密码哈希与 bcrypt", "guide:3.5"],
    ],
  },
  {
    q: "useEffect 和 State 有什么关系？",
    groups: [["kp:useEffect 与副作用"], ["kp:React 中的 State 与 Props"]],
  },
  {
    q: "Mongoose 的 Schema 和 RESTful API 设计分别管什么？",
    groups: [
      ["kp:MongoDB 与 Mongoose", "guide:3.3"],
      ["kp:RESTful API 设计", "guide:3.1"],
    ],
  },
  {
    q: "费曼学习法和用 AI 辅助编程的学习方法有什么共同点？",
    groups: [["kp:费曼学习法"], ["guide:7", "guide:8"]],
  },
];

const quantile = (list, p) => {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * p)];
};
const pct = (n, total) => `${n}/${total}（${Math.round((n / total) * 100)}%）`;

async function buildChunks(candidate) {
  const chunks = [];
  for (const doc of docs) {
    for (const text of await candidate.split(doc.content)) {
      chunks.push({
        knowledgePointId: doc.id,
        title: doc.title,
        text,
        labels: labelsOf(doc, text),
      });
    }
  }
  const { embeddings } = await embeddingService.embed(
    chunks.map((c) => (candidate.withTitle ? `${c.title}\n${c.text}` : c.text)),
  );
  chunks.forEach((c, i) => (c.embedding = embeddings[i]));
  return chunks;
}

// 表一：只换切分方式，检索都用纯向量、不设门槛，看「切法」本身的影响
function evaluateSplitter(chunks, queryVectors, unansweredVectors) {
  const top = (vector) => rankChunks("", vector, chunks, { limit: 4 });
  let hit1 = 0;
  let hit4 = 0;
  const misses = [];
  const topScores = [];
  QUESTIONS.forEach(({ q, expected }, i) => {
    const ranked = top(queryVectors[i]);
    const ok = (c) => c.labels.some((l) => expected.includes(l));
    topScores.push(ranked[0].score);
    if (ok(ranked[0])) hit1 += 1;
    else misses.push(`${q} → ${ranked[0].labels.join("、") || "?"}`);
    if (ranked.some(ok)) hit4 += 1;
  });
  const unanswered = unansweredVectors.map((v) => top(v)[0].score);
  return {
    count: chunks.length,
    hit1,
    hit4,
    misses,
    answeredMin: Math.min(...topScores),
    answeredP10: quantile(topScores, 0.1),
    answeredMedian: quantile(topScores, 0.5),
    unansweredMax: Math.max(...unanswered),
  };
}

// 表二：切法固定为本项目的 300 字，比较检索策略，并带上问答接口实际用的相关度门槛
const STRATEGIES = [
  {
    name: "纯向量（讲义做法）",
    rank: (q, v, chunks) => rankChunks("", v, chunks, { minScore: MIN_SCORE }),
  },
  {
    name: "纯向量 + 标题点名保底（本项目采用）",
    rank: (q, v, chunks) => rankChunks(q, v, chunks, { minScore: MIN_SCORE }),
  },
];

function evaluateStrategy(strategy, chunks, vectors) {
  let hit1 = 0;
  let hit4 = 0;
  let blocked = 0;
  QUESTIONS.forEach(({ q, expected }, i) => {
    const picked = strategy.rank(q, vectors.questions[i], chunks);
    const ok = (c) => c.labels.some((l) => expected.includes(l));
    if (!picked.length) blocked += 1;
    if (picked[0] && ok(picked[0])) hit1 += 1;
    if (picked.some(ok)) hit4 += 1;
  });
  let covered = 0;
  let groups = 0;
  const multiLines = [];
  MULTI.forEach(({ q, groups: g }, i) => {
    const picked = strategy.rank(q, vectors.multi[i], chunks);
    const labels = new Set(picked.flatMap((c) => c.labels));
    const hits = g.filter((group) => group.some((l) => labels.has(l))).length;
    covered += hits;
    groups += g.length;
    multiLines.push(`${q}：覆盖 ${hits}/${g.length}`);
  });
  const passed = UNANSWERABLE.filter(
    (q, i) => strategy.rank(q, vectors.unanswerable[i], chunks).length > 0,
  ).length;
  return { hit1, hit4, blocked, covered, groups, passed, multiLines };
}

async function main() {
  const embedQueries = (list) =>
    embeddingService.embed(list, { type: "query" });
  const { embeddings: questions, model } = await embedQueries(
    QUESTIONS.map((x) => x.q),
  );
  const { embeddings: unanswerable } = await embedQueries(UNANSWERABLE);
  const { embeddings: multi } = await embedQueries(MULTI.map((x) => x.q));

  const splitterRows = [];
  const missLines = [];
  let projectChunks;
  for (const candidate of CANDIDATES) {
    const chunks = await buildChunks(candidate);
    if (candidate.name.startsWith("D300.")) projectChunks = chunks;
    const r = evaluateSplitter(chunks, questions, unanswerable);
    splitterRows.push(
      `| ${candidate.name} | ${r.count} | ${pct(r.hit1, QUESTIONS.length)} | ${pct(r.hit4, QUESTIONS.length)} | ${r.answeredMin.toFixed(3)} / ${r.answeredP10.toFixed(3)} / ${r.answeredMedian.toFixed(3)} | ${r.unansweredMax.toFixed(3)} |`,
    );
    missLines.push(
      `### ${candidate.name}\n\n${r.misses.map((m) => `- ${m}`).join("\n") || "- 无"}`,
    );
    console.log(candidate.name, `第一名命中 ${r.hit1}，前四命中 ${r.hit4}`);
  }

  const strategyRows = [];
  const multiDetails = [];
  for (const strategy of STRATEGIES) {
    const r = evaluateStrategy(strategy, projectChunks, {
      questions,
      unanswerable,
      multi,
    });
    strategyRows.push(
      `| ${strategy.name} | ${pct(r.hit1, QUESTIONS.length)} | ${pct(r.hit4, QUESTIONS.length)} | ${pct(r.covered, r.groups)} | ${r.blocked} | ${r.passed}/${UNANSWERABLE.length} |`,
    );
    multiDetails.push(
      `### ${strategy.name}\n\n${r.multiLines.map((m) => `- ${m}`).join("\n")}`,
    );
    console.log(strategy.name, `综合题覆盖 ${r.covered}/${r.groups}`);
  }

  const report = `# 检索效果评测（第 11 课）

> 由 \`npm run rag:eval\` 生成，不要手改。向量模型：${model}。
> 语料：\`docs/learning-guide.md\`（约 ${guide.length} 字，当作一篇长笔记）加 ${demoKnowledgePoints.length} 个演示知识点。
> 问题：${QUESTIONS.length} 道答案已知的问题，${MULTI.length} 道一次问几个概念的综合题，${UNANSWERABLE.length} 道知识库里没有答案的问题。

## 表一：切分方式（纯向量检索，取前 4 块，不设门槛）

| 方式 | 块数 | 第一名就对 | 前 4 名里有对的 | 有答案问题的最高分：最低 / 10% 分位 / 中位 | 没答案问题的最高分：最高 |
| --- | --- | --- | --- | --- | --- |
${splitterRows.join("\n")}

## 表二：检索策略（切法 D300，取前 4 块，相关度门槛 ${MIN_SCORE}）

| 策略 | 第一名就对 | 前 4 名里有对的 | 综合题的概念覆盖 | 有答案却一块都没取到 | 没答案却取到了资料 |
| --- | --- | --- | --- | --- | --- |
${strategyRows.join("\n")}

## 结论

${CONCLUSION}

## 综合题逐题覆盖

${multiDetails.join("\n\n")}

## 表一中第一名没命中的问题

${missLines.join("\n\n")}
`;
  fs.writeFileSync(path.join(root, "docs/rag-retrieval-eval.md"), report);
  console.log("已写入 docs/rag-retrieval-eval.md");
}

// 结论按实测数据写，数据变了要回来改
const CONCLUSION = `- **先说可信度**：只有 28 道题，两种方式差 1–2 题属于正常波动，不能当成谁更好的证据；题目和「正确答案」都是我按指南内容出的，可能偏向本项目的切法。下面只采纳差距明显、方向一致的结论。
- **块长 300 保留**：前 4 名里有没有对的那一块，D300、D500 和 D300' 都是 28/28，D200 和讲义的 A 是 27/28；问答接口取前 4 块交给大模型，看的正是这一项。D200 的「第一名就对」多一题，但块数多了一半（93 对 60），每块只有两三句话，交给模型的上下文更零碎；D500 的「第一名就对」最低。300 是折中。
- **向量化时带知识点标题，这批数据里看不出好处**：带和不带（D300 和 D300'）只差 1 题，在波动范围内。原因可能是长笔记的标题「系统学习指南」太笼统，对每一块都一样；演示知识点又都很短，正文里本来就有主题词。暂时保留，等真实笔记多了再测。
- **相关度门槛定为 0.3**：有答案的问题，最高分最低约 0.35；没答案的问题最高分在 0.19–0.43 之间。两类在 0.3–0.45 有重叠，没有一个门槛能把它们完全分开。所以门槛只挡掉明显无关的（红烧肉、天气、期末考试），这时直接回答「知识库里没有」，不调用大模型；剩下的 3 道（Python、Vue、Redis）会带着不相关的资料进入大模型，由提示词要求它没有依据就说没有。实测 DeepSeek 对这 3 类都回答了「知识库里没有相关内容」。
- **综合题加「标题点名保底」**：一句话问几个概念时，问题向量是几个主题的平均，纯向量只覆盖了 8/11 个概念（「JWT、bcrypt 和 CORS」只取到 1 个）。加上保底后 11/11，单个问题的两项命中率不变。局限：只对标题里有英文术语的知识点生效（JWT、CORS、useEffect 这类），纯中文的概念名不受益；而且这 5 道综合题本来就是点名式的问法，结果对这条规则有利。
- **试过但没采用**：把全文关键词匹配和向量排名用倒数排名融合（RRF）合并，再限制每个知识点最多 2 块。单个问题的「第一名就对」从 86% 降到 75%，长笔记被限成 2 块后「前 4 名里有对的」也从 100% 降到 89%，综合题只多覆盖 1 个概念，所以放弃。`;

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
