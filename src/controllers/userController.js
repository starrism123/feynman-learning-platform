const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { AppError } = require("../utils/appError");
const { sendSuccess } = require("../utils/response");
const {
  normalizeRegistration,
  normalizeLogin,
} = require("../validators/userValidator");

async function register(req, res) {
  const { username, email, password } = normalizeRegistration(req.body);
  const duplicate = await User.findOne({ $or: [{ email }, { username }] });

  if (duplicate) {
    const field = duplicate.email === email ? "邮箱" : "用户名";
    throw new AppError(409, "USER_ALREADY_EXISTS", `${field}已存在`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, email, password: passwordHash });

  return sendSuccess(res, 201, { user }, "注册成功");
}

async function login(req, res) {
  const { email, password } = normalizeLogin(req.body);
  const user = await User.findOne({ email }).select("+password");
  const matches = user ? await bcrypt.compare(password, user.password) : false;

  if (!matches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "邮箱或密码错误");
  }

  user.password = undefined;
  return sendSuccess(res, 200, { user }, "登录成功");
}

module.exports = { register, login };
