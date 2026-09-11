function sendSuccess(res, status, data, message) {
  const body = { success: true, data };
  if (message) body.message = message;
  return res.status(status).json(body);
}

module.exports = { sendSuccess };
