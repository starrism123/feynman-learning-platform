const request = require("supertest");
const { createApp } = require("../src/app");
const embeddingService = require("../src/services/embeddingService");
const vectorStoreService = require("../src/services/vectorStoreService");
const KnowledgePoint = require("../src/models/KnowledgePoint");
const KnowledgeChunk = require("../src/models/KnowledgeChunk");
const {
  startTestDatabase,
  clearTestDatabase,
  stopTestDatabase,
} = require("./helpers/database");

process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-the-course";
const app = createApp();
let userCounter = 0;

beforeAll(startTestDatabase, 60000);
beforeEach(clearTestDatabase);
afterEach(() => jest.restoreAllMocks());
afterAll(stopTestDatabase);

// 假的向量化：按文本里出现的关键词生成三维向量并归一化，
// 足够验证「相关的排在前面」，又不需要真的启动模型
const TOPICS = ["JWT", "React", "数据库"];
function fakeEmbed(texts) {
  const embeddings = texts.map((text) => {
    const v = TOPICS.map((topic) => (text.includes(topic) ? 1 : 0.05));
    const length = Math.hypot(...v);
    return v.map((x) => x / length);
  });
  return Promise.resolve({ embeddings, model: "fake-embedding" });
}

async function registerUser() {
  userCounter += 1;
  const { body } = await request(app)
    .post("/api/users/register")
    .send({
      username: `rag_student_${userCounter}`,
      email: `rag${userCounter}@test.com`,
      password: "password123",
    });
  return { Authorization: `Bearer ${body.data.token}` };
}

async function createKnowledgePoint(headers, title, content) {
  const { body } = await request(app)
    .post("/api/knowledge-points")
    .set(headers)
    .send({ title, content });
  return body.data.knowledgePoint;
}

describe("第 10 课 文本切分", () => {
  test("按中文句子切分，句号留在句末，块长不超过上限", async () => {
    const sentence = "JWT 是服务器签发的令牌，浏览器每次请求都带上它。";
    const text = `# 标题\n\n${sentence.repeat(30)}`;
    const chunks = await vectorStoreService.createSplitter().splitText(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      // 每块开头是所在小节的标题路径，后面才是正文
      const prefix = "【标题】\n";
      expect(chunk.startsWith(prefix)).toBe(true);
      const body = chunk.slice(prefix.length);
      expect(body.length).toBeLessThanOrEqual(vectorStoreService.CHUNK_SIZE);
      expect(body).not.toMatch(/^[。，]/);
      expect(body).not.toContain("⁣");
    }
    expect(chunks.at(-1)).toMatch(/。$/);
  });
});

describe("第 10 课 向量库", () => {
  test("建索引时带上标题向量化，重建时整组替换不留旧块", async () => {
    const headers = await registerUser();
    const kp = await createKnowledgePoint(
      headers,
      "JWT 登录认证",
      "服务器验证签名后就知道请求来自哪个用户。",
    );
    const embed = jest
      .spyOn(embeddingService, "embed")
      .mockImplementation(fakeEmbed);

    const doc = await KnowledgePoint.findById(kp._id);
    await vectorStoreService.indexKnowledgePoint(doc);
    await vectorStoreService.indexKnowledgePoint(doc);

    expect(embed.mock.calls[0][0][0]).toBe(
      "JWT 登录认证\n服务器验证签名后就知道请求来自哪个用户。",
    );
    const chunks = await KnowledgeChunk.find({ knowledgePoint: kp._id });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].model).toBe("fake-embedding");
    expect(chunks[0].embedding).toHaveLength(3);
  });

  test("向量化失败时保留旧的块", async () => {
    const headers = await registerUser();
    const kp = await createKnowledgePoint(headers, "JWT", "签名令牌。");
    const doc = await KnowledgePoint.findById(kp._id);
    jest.spyOn(embeddingService, "embed").mockImplementationOnce(fakeEmbed);
    await vectorStoreService.indexKnowledgePoint(doc);

    jest
      .spyOn(embeddingService, "embed")
      .mockRejectedValueOnce(new Error("服务没启动"));
    await expect(vectorStoreService.indexKnowledgePoint(doc)).rejects.toThrow();
    expect(await KnowledgeChunk.countDocuments()).toBe(1);
  });

  test("只有标题或内容变化才重新向量化，删除知识点时一起删掉向量", async () => {
    const headers = await registerUser();
    const index = jest
      .spyOn(vectorStoreService, "indexInBackground")
      .mockImplementation(() => {});
    const kp = await createKnowledgePoint(headers, "JWT", "签名令牌。");
    expect(index).toHaveBeenCalledTimes(1);

    await request(app)
      .patch(`/api/knowledge-points/${kp._id}`)
      .set(headers)
      .send({ status: "mastered" });
    expect(index).toHaveBeenCalledTimes(1);

    await request(app)
      .patch(`/api/knowledge-points/${kp._id}`)
      .set(headers)
      .send({ content: "JWT 是签过名的令牌。" });
    expect(index).toHaveBeenCalledTimes(2);

    await KnowledgeChunk.create({
      user: kp.user,
      knowledgePoint: kp._id,
      index: 0,
      text: "旧块",
      embedding: [1, 0, 0],
      model: "fake-embedding",
    });
    await request(app).delete(`/api/knowledge-points/${kp._id}`).set(headers);
    expect(await KnowledgeChunk.countDocuments()).toBe(0);
  });
});

describe("第 10 课 知识库接口", () => {
  test("重建索引后能看到每个知识点的块数，检索只返回自己的、按相似度排序", async () => {
    jest.spyOn(embeddingService, "embed").mockImplementation(fakeEmbed);
    const headers = await registerUser();
    const other = await registerUser();
    await createKnowledgePoint(headers, "JWT 认证", "令牌带签名。");
    await createKnowledgePoint(headers, "React 状态", "组件重新渲染。");
    await createKnowledgePoint(other, "JWT 别人的", "别人的笔记。");

    const empty = await request(app).get("/api/rag/status").set(headers);
    expect(empty.body.data.missing).toBe(2);

    const rebuilt = await request(app).post("/api/rag/reindex").set(headers);
    expect(rebuilt.status).toBe(200);
    expect(rebuilt.body.data).toEqual({ knowledgePoints: 2, chunks: 2 });
    await request(app).post("/api/rag/reindex").set(other);

    const status = await request(app).get("/api/rag/status").set(headers);
    expect(status.body.data.totalChunks).toBe(2);
    expect(status.body.data.missing).toBe(0);

    const search = await request(app)
      .post("/api/rag/search")
      .set(headers)
      .send({ query: "JWT 怎么验证" });
    expect(search.status).toBe(200);
    const titles = search.body.data.results.map((r) => r.title);
    expect(titles).toEqual(["JWT 认证", "React 状态"]);
  });

  test("检索参数校验和登录要求", async () => {
    const headers = await registerUser();
    const empty = await request(app)
      .post("/api/rag/search")
      .set(headers)
      .send({ query: "  " });
    const noAuth = await request(app).get("/api/rag/status");
    expect(empty.status).toBe(400);
    expect(noAuth.status).toBe(401);
  });
});
