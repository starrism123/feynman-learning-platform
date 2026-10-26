const request = require("supertest");
const { createApp } = require("../src/app");
const llmService = require("../src/services/llmService");
const speechService = require("../src/services/speechService");
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

async function registerWithKnowledgePoint() {
  userCounter += 1;
  const { body } = await request(app)
    .post("/api/users/register")
    .send({
      username: `ai_student_${userCounter}`,
      email: `ai${userCounter}@test.com`,
      password: "password123",
    });
  const headers = { Authorization: `Bearer ${body.data.token}` };
  const created = await request(app)
    .post("/api/knowledge-points")
    .set(headers)
    .send({ title: "JWT", content: "JWT 是带签名的令牌，用于无状态认证。" });
  return { headers, kp: created.body.data.knowledgePoint };
}

describe("第 7 课 录音转文字", () => {
  test("上传录音后返回识别文字", async () => {
    const { headers } = await registerWithKnowledgePoint();
    jest
      .spyOn(speechService, "transcribe")
      .mockResolvedValue("JWT 是一张通行证");

    const response = await request(app)
      .post("/api/audio/transcribe")
      .set(headers)
      .attach("audio", Buffer.from("fake-audio"), "record.webm");

    expect(response.status).toBe(200);
    expect(response.body.data.result).toBe("JWT 是一张通行证");
  });

  test("没有文件或未登录时拒绝", async () => {
    const { headers } = await registerWithKnowledgePoint();
    const noFile = await request(app)
      .post("/api/audio/transcribe")
      .set(headers);
    const noAuth = await request(app).post("/api/audio/transcribe");
    expect(noFile.status).toBe(400);
    expect(noAuth.status).toBe(401);
  });
});

describe("第 8 课 AI 润色与评价", () => {
  test("低分时保存复述记录并加入复习列表", async () => {
    const { headers, kp } = await registerWithKnowledgePoint();
    jest.spyOn(llmService, "chatJson").mockResolvedValue({
      data: {
        polishedText: "JWT 是带签名的令牌。",
        dimensions: {
          accuracy: 5,
          clarity: 6,
          completeness: 4,
          conciseness: 7,
        },
        score: 52,
        evaluation: "讲到了签名，但没讲无状态。",
        strengths: ["提到了签名"],
        weaknesses: ["漏掉无状态认证"],
      },
      provider: "DeepSeek",
      model: "deepseek-chat",
      latencyMs: 1200,
    });

    const response = await request(app)
      .post("/api/ai/evaluate")
      .set(headers)
      .send({ knowledgePointId: kp._id, transcribedText: "JWT 就是一个令牌" });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      score: 52,
      provider: "DeepSeek",
      reviewList: true,
      status: "in_progress",
    });

    const attempts = await request(app)
      .get(`/api/knowledge-points/${kp._id}/attempts`)
      .set(headers);
    expect(attempts.body.data.count).toBe(1);
    expect(attempts.body.data.attempts[0].transcribedText).toBe(
      "JWT 就是一个令牌",
    );
  });

  test("不能评价别人的知识点", async () => {
    const owner = await registerWithKnowledgePoint();
    const other = await registerWithKnowledgePoint();
    const response = await request(app)
      .post("/api/ai/evaluate")
      .set(other.headers)
      .send({ knowledgePointId: owner.kp._id, transcribedText: "随便说说" });
    expect(response.status).toBe(404);
  });
});

describe("第 9 课 AI 出题与评分", () => {
  test("生成单选题并校验格式", async () => {
    const { headers, kp } = await registerWithKnowledgePoint();
    jest.spyOn(llmService, "chatJson").mockResolvedValue({
      data: {
        question: "JWT 主要用于？",
        options: { A: "存图片", B: "认证", C: "排序", D: "压缩" },
        answer: "B",
        explanation: "JWT 用于认证。",
      },
      provider: "DeepSeek",
    });

    const response = await request(app)
      .post("/api/ai/generate-question")
      .set(headers)
      .send({ knowledgePointId: kp._id, difficulty: "基础" });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      type: "single-choice",
      answer: "B",
    });
  });

  test("AI 返回残缺题目时报错，非法难度直接拒绝", async () => {
    const { headers, kp } = await registerWithKnowledgePoint();
    jest.spyOn(llmService, "chatJson").mockResolvedValue({
      data: { question: "缺选项" },
      provider: "DeepSeek",
    });

    const broken = await request(app)
      .post("/api/ai/generate-question")
      .set(headers)
      .send({ knowledgePointId: kp._id, difficulty: "中等" });
    const badDifficulty = await request(app)
      .post("/api/ai/generate-question")
      .set(headers)
      .send({ knowledgePointId: kp._id, difficulty: "地狱" });

    expect(broken.status).toBe(502);
    expect(badDifficulty.status).toBe(400);
  });

  test("简答题交给 AI 阅卷", async () => {
    const { headers } = await registerWithKnowledgePoint();
    jest.spyOn(llmService, "chatJson").mockResolvedValue({
      data: { isCorrect: true, score: 90, explanation: "要点齐全" },
      provider: "Ollama 本地模型",
    });

    const response = await request(app)
      .post("/api/ai/grade-answer")
      .set(headers)
      .send({
        question: "JWT 有什么用？",
        answerKeyPoints: ["认证", "无状态"],
        studentAnswer: "用来认证，服务器不用存会话",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ isCorrect: true, score: 90 });
  });
});

describe("多 LLM 回退", () => {
  test("从代码块里解析 JSON", () => {
    expect(llmService.parseJson('好的：\n```json\n{"a": 1}\n```')).toEqual({
      a: 1,
    });
  });
});
