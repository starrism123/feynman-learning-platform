const { startLearningDemo } = require("../scripts/start-learning-demo");

jest.setTimeout(120000);

let demo;

beforeAll(async () => {
  demo = await startLearningDemo({ apiPort: 0, webPort: 0, silent: true });
});

afterAll(async () => {
  await demo?.close();
});

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${demo.apiBaseUrl}${path}`, options);
  return { response, body: await response.json() };
}

test("学习网页和动态 API 配置可以访问", async () => {
  const page = await fetch(demo.webUrl);
  const html = await page.text();
  const config = await fetch(`${demo.webUrl}/demo-config.js`);
  const configText = await config.text();

  expect(page.status).toBe(200);
  expect(html).toContain("从一次点击，看懂 AJAX");
  expect(configText).toContain(demo.apiBaseUrl);
});

test("演示环境完成健康检查、注册、登录与知识点 CRUD", async () => {
  const health = await jsonRequest("/health");
  expect(health.response.status).toBe(200);
  expect(health.body.data.status).toBe("ok");

  const missingToken = await jsonRequest("/api/knowledge-points");
  expect(missingToken.response.status).toBe(401);
  expect(missingToken.body.error.code).toBe("AUTH_REQUIRED");

  const badRegistration = await jsonRequest("/api/users/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "a", email: "bad", password: "123" }),
  });
  expect(badRegistration.response.status).toBe(400);
  expect(badRegistration.body.error.code).toBe("VALIDATION_ERROR");

  const credentials = {
    username: "ajax_learner",
    email: "ajax-learner@test.com",
    password: "password123",
  };
  const registration = await jsonRequest("/api/users/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  expect(registration.response.status).toBe(201);

  const login = await jsonRequest("/api/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  });
  expect(login.response.status).toBe(200);
  const token = login.body.data.token;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const created = await jsonRequest("/api/knowledge-points", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: "理解 AJAX",
      content: "浏览器通过 fetch 调用后端。",
    }),
  });
  expect(created.response.status).toBe(201);
  const id = created.body.data.knowledgePoint._id;

  const list = await jsonRequest("/api/knowledge-points", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(list.body.data.count).toBe(1);

  const updated = await jsonRequest(`/api/knowledge-points/${id}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ status: "mastered", reviewList: true }),
  });
  expect(updated.body.data.knowledgePoint.status).toBe("mastered");

  const removed = await jsonRequest(`/api/knowledge-points/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(removed.response.status).toBe(200);

  const missing = await jsonRequest(`/api/knowledge-points/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(missing.response.status).toBe(404);
  expect(missing.body.error.code).toBe("KNOWLEDGE_POINT_NOT_FOUND");
});

test("伪造 Token 与错误路径返回稳定机器错误码", async () => {
  const invalidToken = await jsonRequest("/api/knowledge-points", {
    headers: { Authorization: "Bearer not-a-token" },
  });
  expect(invalidToken.response.status).toBe(401);
  expect(invalidToken.body.error.code).toBe("INVALID_TOKEN");

  const wrongRoute = await jsonRequest("/api/not-exists");
  expect(wrongRoute.response.status).toBe(404);
  expect(wrongRoute.body.error.code).toBe("ROUTE_NOT_FOUND");
});
