const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("缺少 JWT_SECRET，或密钥不足 32 个字符");
  }
  return secret;
}

function createToken(userId, options = {}) {
  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || "5h";
  return jwt.sign({ user: { id: userId } }, getJwtSecret(), { expiresIn });
}

module.exports = { getJwtSecret, createToken };
