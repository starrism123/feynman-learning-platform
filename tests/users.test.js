const bcrypt = require("bcryptjs");
const request = require("supertest");
const { createApp } = require("../src/app");
const User = require("../src/models/User");
const {
  startTestDatabase,
  clearTestDatabase,
  stopTestDatabase,
} = require("./helpers/database");

const app = createApp();
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-the-course";
const validUser = {
  username: "test_student",
  email: "student@test.com",
  password: "password123",
};

beforeAll(startTestDatabase, 60000);
beforeEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe("第二课用户注册和登录", () => {
  test("注册成功，数据库保存哈希且响应不泄露密码", async () => {
    const response = await request(app)
      .post("/api/users/register")
      .send(validUser);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user.password).toBeUndefined();

    const saved = await User.findOne({ email: validUser.email }).select(
      "+password",
    );
    expect(saved.password).not.toBe(validUser.password);
    await expect(
      bcrypt.compare(validUser.password, saved.password),
    ).resolves.toBe(true);
  });

  test("兼容 name 字段和旧注册路径", async () => {
    const response = await request(app).post("/api/register").send({
      name: "legacy_student",
      email: "legacy@test.com",
      password: "password123",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.username).toBe("legacy_student");
  });

  test("username 与 name 冲突时拒绝注册", async () => {
    const response = await request(app)
      .post("/api/users/register")
      .send({ ...validUser, name: "different_name" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("USERNAME_CONFLICT");
  });

  test("非法参数返回统一验证错误", async () => {
    const response = await request(app)
      .post("/api/users/register")
      .send({ username: "a", email: "bad", password: "123" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  test("重复邮箱或用户名返回 409", async () => {
    await request(app).post("/api/users/register").send(validUser);

    const sameEmail = await request(app)
      .post("/api/users/register")
      .send({ ...validUser, username: "another_student" });
    const sameUsername = await request(app)
      .post("/api/users/register")
      .send({ ...validUser, email: "another@test.com" });

    expect(sameEmail.status).toBe(409);
    expect(sameUsername.status).toBe(409);
  });

  test("正确密码可以从新旧路径登录，错误凭据统一拒绝", async () => {
    await request(app).post("/api/users/register").send(validUser);

    const login = await request(app).post("/api/users/login").send({
      email: validUser.email,
      password: validUser.password,
    });
    const legacyLogin = await request(app).post("/api/login").send({
      email: validUser.email,
      password: validUser.password,
    });
    const wrong = await request(app).post("/api/users/login").send({
      email: validUser.email,
      password: "wrong-password",
    });
    const unknown = await request(app).post("/api/users/login").send({
      email: "unknown@test.com",
      password: validUser.password,
    });

    expect(login.status).toBe(200);
    expect(login.body.data.token).toEqual(expect.any(String));
    expect(login.body.data.user.password).toBeUndefined();
    expect(legacyLogin.status).toBe(200);
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});
