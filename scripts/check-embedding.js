// 向量模型体检：用几组「答案已知」的句子，检查本机向量化服务算出来的相似度是否靠谱。
// 用法：先启动 whisper-service，再运行 npm run rag:check
// 换模型、升级依赖、换机器之后都跑一次。向量化出错时不会报错，只会让检索结果悄悄变乱，
// 第 10 课试 Ollama 时就是靠这种对照发现「红烧肉」比 JWT 还像登录问题。
const embeddingService = require("../src/services/embeddingService");

const CASES = [
  {
    query: "登录以后服务器怎么知道我是谁？",
    related:
      "JWT 是服务器签发的令牌，浏览器每次请求都带上它，服务器验证签名就知道是哪个用户。",
    unrelated: "红烧肉要先焯水去血沫，再放冰糖炒糖色，小火慢炖一个小时。",
  },
  {
    query: "React 组件什么时候会重新渲染？",
    related: "调用 setState 改变状态后，React 会重新执行组件函数，更新页面。",
    unrelated: "MongoDB 把数据存成文档，一个集合里可以放很多文档。",
  },
  {
    query: "密码为什么不能明文存进数据库？",
    related: "bcrypt 先给密码加盐再做慢哈希，数据库泄露了也很难反推出原密码。",
    unrelated: "跨域时浏览器会检查响应里的 Access-Control-Allow-Origin 头。",
  },
];
// 相关句子至少要比无关句子高出这么多，才算拉得开
const MIN_GAP = 0.1;

const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);

async function main() {
  let failed = 0;
  for (const { query, related, unrelated } of CASES) {
    const {
      embeddings: [q],
      model,
    } = await embeddingService.embed([query], { type: "query" });
    const {
      embeddings: [r, u],
    } = await embeddingService.embed([related, unrelated]);
    const norm = Math.hypot(...q);
    const gap = dot(q, r) - dot(q, u);
    const ok = gap >= MIN_GAP && Math.abs(norm - 1) < 1e-3;
    if (!ok) failed += 1;
    console.log(
      `${ok ? "通过" : "失败"}｜${model}，${q.length} 维，长度 ${norm.toFixed(3)}｜` +
        `相关 ${dot(q, r).toFixed(3)}，无关 ${dot(q, u).toFixed(3)}，差 ${gap.toFixed(3)}｜${query}`,
    );
  }
  if (failed) {
    console.error(`${failed} 组没通过：相似度不可信，先别用这个模型建索引`);
    process.exitCode = 1;
  } else {
    console.log("全部通过");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
