const jwt = require("jsonwebtoken");
const request = require("supertest");
const { createApp } = require("../src/app");
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

async function register(overrides = {}) {
  userCounter += 1;
  const unique = `user${userCounter}`;
  const response = await request(app)
    .post("/api/users/register")
    .send({
      username: `student_${unique}`,
      email: `${unique}@test.com`,
      password: "password123",
      ...overrides,
    });
  return response.body.data;
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

describe("第三课 JWT 认证", () => {
  test("缺少、伪造和过期 Token 均返回明确错误", async () => {
    const missing = await request(app).get("/api/knowledge-points");
    const invalid = await request(app)
      .get("/api/knowledge-points")
      .set("Authorization", "Bearer not-a-token");
    const expiredToken = jwt.sign(
      { user: { id: "507f1f77bcf86cd799439011" } },
      process.env.JWT_SECRET,
      { expiresIn: -1 },
    );
    const expired = await request(app)
      .get("/api/knowledge-points")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(missing.body.error.code).toBe("AUTH_REQUIRED");
    expect(invalid.body.error.code).toBe("INVALID_TOKEN");
    expect(expired.body.error.code).toBe("TOKEN_EXPIRED");
  });

  test("兼容 x-auth-token，冲突的双认证头会被拒绝", async () => {
    const { token } = await register();
    const legacy = await request(app)
      .get("/api/knowledge-points")
      .set("x-auth-token", token);
    const conflict = await request(app)
      .get("/api/knowledge-points")
      .set("Authorization", `Bearer ${token}`)
      .set("x-auth-token", "different-token");

    expect(legacy.status).toBe(200);
    expect(conflict.status).toBe(401);
    expect(conflict.body.error.code).toBe("AUTH_HEADER_CONFLICT");
  });

  test("Authorization 使用非 Bearer 格式时明确拒绝", async () => {
    const { token } = await register();
    const response = await request(app)
      .get("/api/knowledge-points")
      .set("Authorization", `Token ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_AUTH_SCHEME");
  });
});

describe("第三课知识点 CRUD", () => {
  test("完成创建、列表、详情、PATCH、PUT 和删除闭环", async () => {
    const { token } = await register();
    const headers = bearer(token);

    const created = await request(app)
      .post("/api/knowledge-points")
      .set(headers)
      .send({ title: "什么是 JWT", content: "JWT 是一种 Token 格式。" });
    const id = created.body.data.knowledgePoint._id;

    expect(created.status).toBe(201);
    expect(created.body.data.knowledgePoint.status).toBe("not_started");

    const list = await request(app).get("/api/knowledge-points").set(headers);
    const detail = await request(app)
      .get(`/api/knowledge-points/${id}`)
      .set(headers);
    const patched = await request(app)
      .patch(`/api/knowledge-points/${id}`)
      .set(headers)
      .send({ status: "in_progress", reviewList: true });
    const put = await request(app)
      .put(`/api/knowledge-points/${id}`)
      .set(headers)
      .send({ title: "JWT 认证", status: "mastered" });
    const removed = await request(app)
      .delete(`/api/knowledge-points/${id}`)
      .set(headers);
    const missing = await request(app)
      .get(`/api/knowledge-points/${id}`)
      .set(headers);

    expect(list.body.data.count).toBe(1);
    expect(detail.body.data.knowledgePoint._id).toBe(id);
    expect(patched.body.data.knowledgePoint.reviewList).toBe(true);
    expect(put.body.data.knowledgePoint.title).toBe("JWT 认证");
    expect(put.body.data.knowledgePoint.content).toBe(
      "JWT 是一种 Token 格式。",
    );
    expect(removed.status).toBe(200);
    expect(missing.status).toBe(404);
  });

  test("拒绝非法状态、空更新、额外字段和非法 ID", async () => {
    const { token } = await register();
    const headers = bearer(token);
    const created = await request(app)
      .post("/api/knowledge-points")
      .set(headers)
      .send({ title: "Express", content: "Web 框架" });
    const id = created.body.data.knowledgePoint._id;

    const badStatus = await request(app)
      .patch(`/api/knowledge-points/${id}`)
      .set(headers)
      .send({ status: "unknown" });
    const empty = await request(app)
      .patch(`/api/knowledge-points/${id}`)
      .set(headers)
      .send({});
    const extra = await request(app)
      .patch(`/api/knowledge-points/${id}`)
      .set(headers)
      .send({ user: "507f1f77bcf86cd799439011" });
    const badBoolean = await request(app)
      .patch(`/api/knowledge-points/${id}`)
      .set(headers)
      .send({ reviewList: "false" });
    const invalidId = await request(app)
      .get("/api/knowledge-points/not-an-id")
      .set(headers);

    expect(badStatus.body.error.code).toBe("VALIDATION_ERROR");
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");
    expect(extra.body.error.code).toBe("VALIDATION_ERROR");
    expect(badBoolean.body.error.code).toBe("VALIDATION_ERROR");
    expect(invalidId.body.error.code).toBe("INVALID_ID");
  });

  test("不同用户无法读取、更新或删除彼此的知识点", async () => {
    const owner = await register();
    const stranger = await register();
    const created = await request(app)
      .post("/api/knowledge-points")
      .set(bearer(owner.token))
      .send({ title: "私有知识", content: "只属于创建者" });
    const id = created.body.data.knowledgePoint._id;

    const list = await request(app)
      .get("/api/knowledge-points")
      .set(bearer(stranger.token));
    const detail = await request(app)
      .get(`/api/knowledge-points/${id}`)
      .set(bearer(stranger.token));
    const update = await request(app)
      .patch(`/api/knowledge-points/${id}`)
      .set(bearer(stranger.token))
      .send({ title: "越权修改" });
    const remove = await request(app)
      .delete(`/api/knowledge-points/${id}`)
      .set(bearer(stranger.token));

    expect(list.body.data.count).toBe(0);
    expect(detail.status).toBe(404);
    expect(update.status).toBe(404);
    expect(remove.status).toBe(404);
  });
});
