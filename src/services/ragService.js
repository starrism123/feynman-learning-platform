const vectorStoreService = require("./vectorStoreService");

// 第 11 课：RAG 的「检索 + 生成」。问题 → 检索相关片段 → 拼进提示词 → 大模型照着资料回答。
// 讲义用 LangChain 的 RunnableSequence 把这几步串成一条链；这里每一步都只是一个函数，
// 直接按顺序调用更好读，也方便单独测试，所以没有引入 LCEL。

const TOP_K = 4;
// 相关度门槛，由 npm run rag:eval 实测确定（见 docs/rag-retrieval-eval.md）：
// 有答案的问题，最高分最低约 0.35；红烧肉、天气这类完全无关的问题在 0.3 以下。
// 0.3 到 0.45 之间两类问题有重叠，门槛只挡掉明显无关的，剩下的交给提示词让模型判断。
// 问题里点名的术语出现在块里时，不受门槛限制（见 vectorStoreService.rankChunks）
const MIN_SCORE = 0.3;
const NO_CONTEXT_ANSWER =
  "知识库里没有找到和这个问题相关的笔记，所以我不回答，免得编造。可以换个说法再问，或者先把相关内容记成知识点。";

async function retrieve(userId, question) {
  const results = await vectorStoreService.search(userId, question, {
    limit: TOP_K,
    minScore: MIN_SCORE,
  });
  // 编号从 1 开始，回答里的 [1] [2] 就指这里的第几条
  return results.map((result, i) => ({
    id: i + 1,
    knowledgePointId: result.knowledgePointId,
    title: result.title,
    text: result.text,
    score: Number(result.score.toFixed(3)),
  }));
}

// 讲义把这种用标签分隔各部分的写法叫「MCP」。它其实只是结构化提示词：
// 用标签告诉模型哪段是资料、哪段是问题。真正的 MCP（Model Context Protocol）
// 是让 AI 应用接入外部工具和数据源的协议，和这里不是一回事
function buildMessages(question, sources) {
  const context = sources
    .map(
      (source) =>
        `<source id="${source.id}" title="${source.title.replaceAll('"', "'")}">\n${source.text}\n</source>`,
    )
    .join("\n");
  return [
    {
      role: "system",
      content: [
        "你是费曼学习平台的知识库助手，只根据用户自己的笔记回答问题。",
        "规则：",
        "1. 只使用 <context> 里的资料，不要用资料以外的知识补充。",
        "2. 每句用到资料的话，在句末标注来源编号，例如 [1]、[2][3]。",
        "3. 资料不足以回答时，直接说「知识库里没有相关内容」，并说明缺什么，不要编造。",
        "4. 用简体中文，先给结论，再简要解释；不超过 300 字。",
      ].join("\n"),
    },
    {
      role: "user",
      content: `<context>\n${context}\n</context>\n\n<question>\n${question}\n</question>`,
    },
  ];
}

module.exports = {
  TOP_K,
  MIN_SCORE,
  NO_CONTEXT_ANSWER,
  retrieve,
  buildMessages,
};
