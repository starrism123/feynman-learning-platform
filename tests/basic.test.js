const request = require("supertest");
const { createApp } = require("../src/app");

describe("第一课基础接口", () => {
  test("GET / 返回 Hello World", async () => {
    const response = await request(createApp()).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toBe("Hello, Feynman Learner!");
  });

  test("GET /user 返回可配置的学生信息", async () => {
    process.env.STUDENT_NAME = "测试学生";
    process.env.STUDENT_MAJOR = "软件工程";

    const response = await request(createApp()).get("/user");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: "测试学生", major: "软件工程" });
  });

  test("GET /health 返回健康状态", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: "ok" } });
  });
});
