const KnowledgePoint = require("../models/KnowledgePoint");
const KnowledgeChunk = require("../models/KnowledgeChunk");

// 第 12 课：知识图谱的数据。节点是知识点，边有两种：
// - reference：A 的正文里出现了 B 的标题（讲义的规则），有方向；
// - similar：两个知识点的向量互相排在对方最相似的前 K 名里（第 12 课挑战，复用第 10 课的向量）。
// 为什么不用「相似度超过某个分数就连线」：实测 8 个演示知识点两两之间的相似度全挤在 0.46–0.69，
// 都是技术笔记，向量有一大块公共成分。分数线定低了全连成一团，定高了只剩一两条，换一批笔记又要重调。
// 「互为前 K 名」只看排名，不受整体分数高低影响，也能避免一个泛泛的知识点（如「RESTful API 设计」）
// 和所有点都连上。第 14 课的 3D 知识宇宙用同一份数据。
const SIMILAR_NEIGHBORS = 2;

function normalize(vector) {
  const length = Math.hypot(...vector);
  return length ? vector.map((x) => x / length) : vector;
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

// 一个知识点的向量 = 它所有块的向量取平均再归一化。
// 只用用户块里最多的那个模型：不同模型的向量不能放在一起比
async function knowledgePointVectors(userId) {
  const chunks = await KnowledgeChunk.find(
    { user: userId },
    "knowledgePoint embedding model",
  ).lean();
  const modelCounts = new Map();
  for (const chunk of chunks) {
    modelCounts.set(chunk.model, (modelCounts.get(chunk.model) || 0) + 1);
  }
  const model = [...modelCounts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const sums = new Map();
  for (const chunk of chunks.filter((c) => c.model === model)) {
    const key = String(chunk.knowledgePoint);
    const sum = sums.get(key) || new Array(chunk.embedding.length).fill(0);
    chunk.embedding.forEach((x, i) => (sum[i] += x));
    sums.set(key, sum);
  }
  return new Map([...sums].map(([key, sum]) => [key, normalize(sum)]));
}

function referenceLinks(knowledgePoints) {
  const links = [];
  for (const source of knowledgePoints) {
    for (const target of knowledgePoints) {
      if (source === target) continue;
      if (source.content.includes(target.title)) {
        links.push({
          source: String(source._id),
          target: String(target._id),
          type: "reference",
        });
      }
    }
  }
  return links;
}

function similarLinks(vectors, k = SIMILAR_NEIGHBORS) {
  const ids = [...vectors.keys()];
  const top = new Map(
    ids.map((id) => [
      id,
      ids
        .filter((other) => other !== id)
        .map((other) => ({
          other,
          score: dot(vectors.get(id), vectors.get(other)),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k),
    ]),
  );
  const links = [];
  ids.forEach((id, i) => {
    for (const { other, score } of top.get(id)) {
      // 每对只看一次（i 小的一方），并且要求对方的前 K 名里也有自己
      if (ids.indexOf(other) < i) continue;
      if (!top.get(other).some((n) => n.other === id)) continue;
      links.push({
        source: id,
        target: other,
        type: "similar",
        score: Number(score.toFixed(3)),
      });
    }
  });
  return links;
}

async function buildKnowledgeMap(userId) {
  const [knowledgePoints, vectors] = await Promise.all([
    KnowledgePoint.find(
      { user: userId },
      "title content status reviewList",
    ).lean(),
    knowledgePointVectors(userId),
  ]);
  const ids = new Set(knowledgePoints.map((kp) => String(kp._id)));
  // 只保留还存在的知识点的向量（防止删除途中的孤儿块混进来）
  for (const key of vectors.keys()) if (!ids.has(key)) vectors.delete(key);

  const nodes = knowledgePoints.map((kp) => ({
    id: String(kp._id),
    name: kp.title,
    value: kp.content.slice(0, 100),
    // 内容越长节点越大，限制在 20–50 之间
    symbolSize: Math.round(20 + Math.min(kp.content.length / 50, 30)),
    status: kp.status,
    indexed: vectors.has(String(kp._id)),
  }));
  return {
    nodes,
    links: [...referenceLinks(knowledgePoints), ...similarLinks(vectors)],
    meta: {
      similarNeighbors: SIMILAR_NEIGHBORS,
      unindexed: nodes.filter((node) => !node.indexed).length,
    },
  };
}

module.exports = { SIMILAR_NEIGHBORS, buildKnowledgeMap, similarLinks };
