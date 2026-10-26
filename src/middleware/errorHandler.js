const { AppError } = require("../utils/appError");

function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: { code: "ROUTE_NOT_FOUND", message: "请求的接口不存在" },
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    const error = { code: err.code, message: err.message };
    if (err.details) error.details = err.details;
    return res.status(err.status).json({ success: false, error });
  }

  if (err?.name === "MulterError") {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      success: false,
      error: {
        code: tooLarge ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
        message: tooLarge ? "录音文件不能超过 25MB" : "文件上传格式不正确",
      },
    });
  }

  if (err?.code === 11000) {
    return res.status(409).json({
      success: false,
      error: { code: "DUPLICATE_RESOURCE", message: "用户名或邮箱已存在" },
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
  });
}

module.exports = { notFound, errorHandler };
