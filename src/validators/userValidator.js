const { AppError } = require("../utils/appError");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeRegistration(body = {}) {
  const canonical =
    typeof body.username === "string" ? body.username.trim() : "";
  const compatible = typeof body.name === "string" ? body.name.trim() : "";

  if (canonical && compatible && canonical !== compatible) {
    throw new AppError(
      400,
      "USERNAME_CONFLICT",
      "username 与 name 不能填写不同内容",
    );
  }

  const username = canonical || compatible;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const details = [];

  if (username.length < 2 || username.length > 50) {
    details.push("username 长度必须为 2 到 50 个字符");
  }
  if (!EMAIL_PATTERN.test(email)) details.push("email 格式不正确");
  if (password.length < 8) details.push("password 至少需要 8 个字符");

  if (details.length) {
    throw new AppError(400, "VALIDATION_ERROR", "注册参数不符合要求", details);
  }

  return { username, email, password };
}

function normalizeLogin(body = {}) {
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!EMAIL_PATTERN.test(email) || !password) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "请提供有效的 email 和 password",
    );
  }
  return { email, password };
}

module.exports = { normalizeRegistration, normalizeLogin };
