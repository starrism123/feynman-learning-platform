const request = require("supertest");
const { createApp } = require("../src/app");
const KnowledgeChunk = require("../src/models/KnowledgeChunk");
const { similarLinks } = require("../src/services/graphService");
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
afterAll(stopTestDatabase);

async function registerUser() {
  userCounter += 1;
  const { body } = await request(app)
    .post("/api/users/register")
    .send({
      username: `graph_student_${userCounter}`,
      email: `graph${userCounter}@test.com`,
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

// 直接写入一个块，向量由测试指定（不调用向量化服务）
const addChunk = (kp, embedding) =>
  KnowledgeChunk.create({
    user: kp.user,
    knowledgePoint: kp._id,
    index: 0,
    text: kp.content,
    embedding,
    model: "fake-embedding",
    contentHash: "x",
  });

describe("第 12 课 知识图谱", () => {
  test("节点是自己的知识点；正文提到别的标题连引用边，向量互为近邻连相似边", async () => {
    const headers = await registerUser();
    const other = await registerUser();
    const jwt = await createKnowledgePoint(
      headers,
      "JWT 登录认证",
      "签名令牌。",
    );
    const cors = await createKnowledgePoint(
      headers,
      "跨域与 CORS",
      "接口安全靠认证，见「JWT 登录认证」。",
    );
    const feynman = await createKnowledgePoint(
      headers,
      "费曼学习法",
      "讲给别人听。",
    );
    await createKnowledgePoint(other, "别人的笔记", "提到 JWT 登录认证。");
    await addChunk(jwt, [1, 0]);
    await addChunk(cors, [0.8, 0.6]);

    const res = await request(app).get("/api/graph/knowledge-map").set(headers);

    expect(res.status).toBe(200);
    const { nodes, links, meta } = res.body.data;
    expect(nodes.map((n) => n.name).sort()).toEqual([
      "JWT 登录认证",
      "费曼学习法",
      "跨域与 CORS",
    ]);
    expect(links).toContainEqual({
      source: cors._id,
      target: jwt._id,
      type: "reference",
    });
    // 只有两个知识点有向量，它们互为最近邻
    expect(links.filter((l) => l.type === "similar")).toEqual([
      expect.objectContaining({ type: "similar", score: 0.8 }),
    ]);
    expect(meta.unindexed).toBe(1);
    expect(nodes.find((n) => n.id === feynman._id).indexed).toBe(false);
  });

  test("相似边要求互为前 K 名：和谁都沾一点的点不会连上", () => {
    const vectors = new Map([
      ["a", [1, 0, 0]],
      ["b", [0.99, 0.141, 0]],
      ["c", [0, 1, 0]],
      ["d", [0, 0.99, 0.141]],
      // e 离 a、c 都不远，但 a 最近的是 b、c 最近的是 d
      ["e", [0.6, 0.6, 0.529]],
    ]);
    const links = similarLinks(vectors, 1);
    expect(links.map((l) => [l.source, l.target])).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  test("要求登录", async () => {
    const res = await request(app).get("/api/graph/knowledge-map");
    expect(res.status).toBe(401);
  });
});
