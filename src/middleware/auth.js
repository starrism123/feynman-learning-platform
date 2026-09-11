const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../config/auth");
const { AppError } = require("../utils/appError");

function readToken(req) {
  const authorization = req.get("authorization");
  const legacyToken = req.get("x-auth-token");
  let bearerToken;

  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new AppError(
        401,
        "INVALID_AUTH_SCHEME",
        "Authorization 必须使用 Bearer Token",
      );
    }
    bearerToken = match[1].trim();
  }

  if (bearerToken && legacyToken && bearerToken !== legacyToken.trim()) {
    throw new AppError(
      401,
      "AUTH_HEADER_CONFLICT",
      "两个认证头中的 Token 不一致",
    );
  }

  const token = bearerToken || legacyToken?.trim();
  if (!token)
    throw new AppError(401, "AUTH_REQUIRED", "需要登录后才能访问此接口");
  return token;
}

function auth(req, res, next) {
  try {
    const decoded = jwt.verify(readToken(req), getJwtSecret());
    if (!decoded.user?.id) throw new Error("Token 缺少用户标识");
    req.user = decoded.user;
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    if (error.name === "TokenExpiredError") {
      return next(
        new AppError(401, "TOKEN_EXPIRED", "Token 已过期，请重新登录"),
      );
    }
    return next(new AppError(401, "INVALID_TOKEN", "Token 无效"));
  }
}

module.exports = { auth, readToken };
