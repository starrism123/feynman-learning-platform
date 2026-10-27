const { Readable } = require("stream");
const axios = require("axios");
const request = require("supertest");
const { createApp } = require("../src/app");
const embeddingService = require("../src/services/embeddingService");
const llmService = require("../src/services/llmService");
const ragService = require("../src/services/ragService");
const vectorStoreService = require("../src/services/vectorStoreService");
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

// 假的向量化：按关键词生成三维向量。同主题相似度接近 1，不同主题约 0.1，低于相关度门槛
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
      username: `qa_student_${userCounter}`,
      email: `qa${userCounter}@test.com`,
      password: "password123",
    });
  return { Authorization: `Bearer ${body.data.token}` };
}

// 建两个知识点并建好索引；另一个用户也有一条 JWT 笔记，用来验证不会串到别人的
async function prepareKnowledgeBase() {
  jest.spyOn(embeddingService, "embed").mockImplementation(fakeEmbed);
  const headers = await registerUser();
  const other = await registerUser();
  const create = (h, title, content) =>
    request(app).post("/api/knowledge-points").set(h).send({ title, content });
  await create(headers, "JWT 认证", "令牌带签名，过期后要重新登录。");
  await create(headers, "React 状态", "状态改变后组件重新渲染。");
  await create(other, "JWT 别人的", "别人的笔记。");
  await request(app).post("/api/rag/reindex").set(headers);
  await request(app).post("/api/rag/reindex").set(other);
  return headers;
}

// SSE 响应是纯文本，按空行切成一个个事件
function parseEvents(text) {
  return text
    .trim()
    .split("\n\n")
    .map((block) => {
      const [eventLine, dataLine] = block.split("\n");
      return {
        event: eventLine.replace("event: ", ""),
        data: JSON.parse(dataLine.replace("data: ", "")),
      };
    });
}

const streamRequest = (headers, question) =>
  request(app)
    .post("/api/ai/rag-qa/stream")
    .set(headers)
    .send({ question })
    .buffer(true)
    .parse((res, callback) => {
      let text = "";
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => callback(null, text));
    });

describe("第 11 课 知识库问答", () => {
  test("检索自己的笔记拼进提示词，回答附带编号的引用来源", async () => {
    const headers = await prepareKnowledgeBase();
    const chat = jest.spyOn(llmService, "chatText").mockResolvedValue({
      text: " token 过期后要重新登录 [1]。 ",
      provider: "测试模型",
      model: "fake",
      latencyMs: 5,
    });

    const res = await request(app)
      .post("/api/ai/rag-qa")
      .set(headers)
      .send({ question: "JWT 过期了怎么办？" });

    expect(res.status).toBe(200);
    expect(res.body.data.answer).toBe("token 过期后要重新登录 [1]。");
    expect(res.body.data.sources).toHaveLength(1);
    expect(res.body.data.sources[0]).toMatchObject({
      id: 1,
      title: "JWT 认证",
    });
    const [system, user] = chat.mock.calls[0][0];
    expect(system.content).toContain("不要编造");
    expect(user.content).toContain('<source id="1" title="JWT 认证">');
    expect(user.content).toContain("<question>\nJWT 过期了怎么办？");
    expect(user.content).not.toContain("别人的笔记");
  });

  test("没有足够相关的笔记时不调用大模型，直接说知识库里没有", async () => {
    const headers = await prepareKnowledgeBase();
    const chat = jest.spyOn(llmService, "chatText");

    const res = await request(app)
      .post("/api/ai/rag-qa")
      .set(headers)
      .send({ question: "数据库索引怎么建？" });

    expect(res.status).toBe(200);
    expect(res.body.data.answer).toBe(ragService.NO_CONTEXT_ANSWER);
    expect(res.body.data.sources).toEqual([]);
    expect(chat).not.toHaveBeenCalled();
  });

  test("流式接口先推来源，再一段段推回答，最后推 done", async () => {
    const headers = await prepareKnowledgeBase();
    jest
      .spyOn(llmService, "chatStream")
      .mockImplementation(async (messages, { onToken }) => {
        onToken("要重新");
        onToken("登录 [1]");
        return { text: "要重新登录 [1]", provider: "测试模型", model: "fake" };
      });

    const res = await streamRequest(headers, "JWT 过期了怎么办？");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    const events = parseEvents(res.body);
    expect(events.map((e) => e.event)).toEqual([
      "sources",
      "token",
      "token",
      "done",
    ]);
    expect(events[0].data.sources[0].title).toBe("JWT 认证");
    expect(events[1].data.text + events[2].data.text).toBe("要重新登录 [1]");
    expect(events[3].data.provider).toBe("测试模型");
  });

  test("回答到一半大模型出错，用 error 事件告诉前端", async () => {
    const headers = await prepareKnowledgeBase();
    jest
      .spyOn(llmService, "chatStream")
      .mockImplementation(async (messages, { onToken }) => {
        onToken("要重新");
        throw new Error("连接断了");
      });

    const res = await streamRequest(headers, "JWT 过期了怎么办？");
    const events = parseEvents(res.body);

    expect(events.map((e) => e.event)).toEqual(["sources", "token", "error"]);
    expect(events[2].data.code).toBe("LLM_STREAM_ERROR");
  });

  test("问题必填、不超过 500 字，并且要登录", async () => {
    const headers = await registerUser();
    const empty = await request(app)
      .post("/api/ai/rag-qa")
      .set(headers)
      .send({ question: " " });
    const tooLong = await request(app)
      .post("/api/ai/rag-qa/stream")
      .set(headers)
      .send({ question: "问".repeat(501) });
    const noAuth = await request(app)
      .post("/api/ai/rag-qa")
      .send({ question: "JWT 是什么？" });

    expect(empty.status).toBe(400);
    expect(tooLong.status).toBe(400);
    expect(noAuth.status).toBe(401);
  });
});

describe("第 11 课 标题点名保底", () => {
  const chunk = (id, title, embedding) => ({
    knowledgePointId: id,
    title,
    text: "",
    embedding,
  });
  const chunks = [
    chunk("jwt", "JWT 登录认证", [1, 0]),
    chunk("jwt", "JWT 登录认证", [0.9, 0.44]),
    chunk("cors", "跨域与 CORS", [0, 1]),
  ];

  test("问题点名了标题里的术语，这个知识点最相关的一块一定入选", () => {
    const picked = vectorStoreService.rankChunks(
      "JWT 和 cors 有什么区别？",
      [1, 0],
      chunks,
      { minScore: 0.3 },
    );
    expect(picked.map((c) => c.knowledgePointId)).toEqual([
      "jwt",
      "jwt",
      "cors",
    ]);
  });

  test("没点名时，低于门槛的块照样被挡掉", () => {
    const picked = vectorStoreService.rankChunks(
      "JWT 是什么？",
      [1, 0],
      chunks,
      { minScore: 0.3 },
    );
    expect(picked.map((c) => c.knowledgePointId)).toEqual(["jwt", "jwt"]);
  });
});

describe("第 11 课 大模型流式读取", () => {
  const sse = (...lines) => lines.map((l) => `data: ${l}\n\n`).join("");
  const delta = (content) =>
    JSON.stringify({ choices: [{ delta: { content } }] });

  test("按 SSE 行拼出回答，汉字被拆在两个数据包里也不会乱码", async () => {
    const body = Buffer.from(sse(delta("你好"), delta("世界"), "[DONE]"));
    // 「你」是 3 个字节，从第 2 个字节处切开，模拟网络分包
    const cut = body.indexOf(Buffer.from("你")) + 1;
    jest.spyOn(axios, "post").mockResolvedValue({
      data: Readable.from([body.subarray(0, cut), body.subarray(cut)]),
    });
    const tokens = [];

    const result = await llmService.chatStream([], {
      onToken: (t) => tokens.push(t),
    });

    expect(tokens).toEqual(["你好", "世界"]);
    expect(result.text).toBe("你好世界");
  });

  test("还没开始输出时出错就换下一个模型；输出到一半出错就不换", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const post = jest
        .spyOn(axios, "post")
        .mockRejectedValueOnce(new Error("DeepSeek 连不上"))
        .mockResolvedValueOnce({
          data: Readable.from([Buffer.from(sse(delta("好"), "[DONE]"))]),
        });
      const result = await llmService.chatStream([], { onToken: () => {} });
      expect(post).toHaveBeenCalledTimes(2);
      expect(result.provider).toBe("Ollama 本地模型");

      post.mockReset();
      post.mockResolvedValueOnce({
        data: Readable.from([Buffer.from(sse(delta("一半"), "{坏数据"))]),
      });
      await expect(
        llmService.chatStream([], { onToken: () => {} }),
      ).rejects.toThrow();
      expect(post).toHaveBeenCalledTimes(1);
    } finally {
      delete process.env.DEEPSEEK_API_KEY;
    }
  });
});
